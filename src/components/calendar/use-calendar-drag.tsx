"use client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

const HOLD_MS = 280;
const MOVE_CANCEL_PX = 8;

export type DropResult = { entryId: string; date: string; startTime?: string | null };
type Options = { onDrop: (result: DropResult) => void };

// One pointer-based drag works identically for mouse and touch: a short press-and-hold
// (so ordinary taps/scrolling are unaffected) starts the drag, a ghost chip follows the
// pointer for feedback, and drop targets are read from the nearest [data-drop-date]
// ancestor under the release point instead of relying on native HTML5 DnD (mouse-only).
export function useCalendarDrag({ onDrop }: Options) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [overDate, setOverDate] = useState<string | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const activeId = useRef<string | null>(null);
  const snapTime = useRef<((target: HTMLElement, y: number) => string | null) | null>(null);

  function cancelHold() { if (holdTimer.current) clearTimeout(holdTimer.current); holdTimer.current = null; }

  function pointerMove(event: PointerEvent) {
    setGhost({ x: event.clientX, y: event.clientY });
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-drop-date]");
    setOverDate(target?.dataset.dropDate || null);
  }
  function pointerUp(event: PointerEvent) {
    window.removeEventListener("pointermove", pointerMove);
    window.removeEventListener("pointerup", pointerUp);
    window.removeEventListener("pointercancel", pointerUp);
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-drop-date]");
    const date = target?.dataset.dropDate;
    const id = activeId.current;
    setDraggingId(null); setGhost(null); setOverDate(null); activeId.current = null;
    if (date && id) onDrop({ entryId: id, date, startTime: target && snapTime.current ? snapTime.current(target, event.clientY) : undefined });
  }

  function beginDrag(entryId: string, title: string, event: { clientX: number; clientY: number }, timeSnap?: (target: HTMLElement, y: number) => string | null) {
    activeId.current = entryId; setDraggingId(entryId); setLabel(title); setGhost({ x: event.clientX, y: event.clientY });
    snapTime.current = timeSnap || null;
    window.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerUp);
  }

  function dragHandlers(entryId: string, title: string, timeSnap?: (target: HTMLElement, y: number) => string | null) {
    return {
      onPointerDown(event: React.PointerEvent) {
        if (event.button !== undefined && event.button !== 0) return;
        startPoint.current = { x: event.clientX, y: event.clientY };
        cancelHold();
        holdTimer.current = setTimeout(() => beginDrag(entryId, title, event, timeSnap), HOLD_MS);
        const cancel = () => { cancelHold(); window.removeEventListener("pointermove", moveCheck); window.removeEventListener("pointerup", cancel); };
        const moveCheck = (moveEvent: PointerEvent) => {
          if (!startPoint.current) return;
          const dx = moveEvent.clientX - startPoint.current.x, dy = moveEvent.clientY - startPoint.current.y;
          if (Math.hypot(dx, dy) > MOVE_CANCEL_PX && activeId.current !== entryId) cancel();
        };
        window.addEventListener("pointermove", moveCheck);
        window.addEventListener("pointerup", cancel, { once: true });
      },
      "data-dragging": draggingId === entryId ? "true" : undefined,
    };
  }

  const ghostNode = draggingId && ghost && typeof document !== "undefined" ? createPortal(
    <div className="calendar-drag-ghost" style={{ left: ghost.x, top: ghost.y }}>{label}</div>,
    document.body,
  ) : null;

  return { dragHandlers, draggingId, overDate, ghostNode };
}
