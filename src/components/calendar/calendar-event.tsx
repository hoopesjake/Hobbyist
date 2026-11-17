"use client";

import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Clock3 } from "lucide-react";
import { MediaImage } from "@/components/movies/media-image";
import { calendarTime, categoryLabels, durationLabel, type CalendarEntry } from "@/lib/calendar-domain";

const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function CalendarEvent({ entry, children, onClick, ...props }: ComponentProps<"button"> & { entry: CalendarEntry }) {
  const id = useId();
  const [position, setPosition] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focused = useRef(false);
  function cancelClose() { if (timer.current) clearTimeout(timer.current); }
  function closeSoon() { cancelClose(); timer.current = setTimeout(() => { if (!focused.current) setPosition(null); }, 140); }
  function show(element: HTMLButtonElement) {
    cancelClose();
    const rect = element.getBoundingClientRect();
    const above = rect.bottom + 240 > window.innerHeight && rect.top > 240;
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)), top: above ? rect.top - 8 : rect.bottom + 8, above });
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!position) return;
    const dismiss = () => setPosition(null);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("scroll", dismiss, true); window.removeEventListener("resize", dismiss); };
  }, [position]);
  return <>
    <button {...props} aria-describedby={position ? id : undefined}
      onPointerEnter={event => { if (event.pointerType !== "touch") show(event.currentTarget); }} onPointerLeave={closeSoon}
      onFocus={event => { focused.current = true; show(event.currentTarget); }} onBlur={() => { focused.current = false; closeSoon(); }}
      onClick={event => { cancelClose(); setPosition(null); onClick?.(event); }}>{children}</button>
    {position && createPortal(<div id={id} role="tooltip" className={`calendar-event-preview calendar-category-${entry.category}`} style={{ left: position.left, top: position.top, transform: position.above ? "translateY(-100%)" : undefined }} onPointerEnter={cancelClose} onPointerLeave={closeSoon}>
      <div className="calendar-preview-cover">{entry.media_image ? <MediaImage src={entry.media_image} alt={`${entry.media_title || entry.title} cover`} width={76} height={110} unoptimized/> : <BookOpen size={24}/>}</div>
      <div className="calendar-preview-info">
        <span className="calendar-preview-category">{categoryLabels[entry.category]} · {entry.kind === "actual" ? "Logged" : entry.status || "Planned"}</span>
        <strong>{entry.title}</strong>
        {entry.media_title && entry.media_title !== entry.title && <span>{entry.media_title}</span>}
        <p>{dayLabel(entry.event_date)}{entry.end_date && entry.end_date !== entry.event_date ? ` – ${dayLabel(entry.end_date)}` : ""}</p>
        <p className="calendar-preview-time"><Clock3 size={12}/>{calendarTime(entry.start_time)}{entry.end_time ? ` – ${calendarTime(entry.end_time)}` : ""}</p>
        {entry.start_time && <small>{entry.time_zone.replaceAll("_", " ")}</small>}
        {entry.duration_minutes !== null && <span>{entry.approximate ? "About " : ""}{durationLabel(entry.duration_minutes)}</span>}
        {entry.participants && <span>With {entry.participants}</span>}
      </div>
    </div>, document.body)}
  </>;
}
