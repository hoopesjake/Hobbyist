"use client";
import { useState } from "react";
import type { CalendarDraft } from "@/components/calendar/calendar-editor";
export function ReadingSessionFields({ draft, currentPage, totalPages }: { draft: CalendarDraft; currentPage?: number; totalPages?: number | null }) {
  const [start, setStart] = useState(String(draft.reading_start_page || ""));
  const [end, setEnd] = useState(String(draft.reading_end_page || ""));
  const count = start && end && Number(end) >= Number(start) ? Number(end)-Number(start)+1 : null;
  return <div className="calendar-session-episodes"><h3>Reading progress</h3>{currentPage !== undefined && <p className="calendar-current-rating">Current page: {currentPage}{totalPages ? ` / ${totalPages}` : ""}</p>}<div className="calendar-form-row"><label>Starting page<input name="reading_start_page" type="number" min={1} max={100000} required={!!(start || end)} value={start} placeholder={String(totalPages && (currentPage || 0) >= totalPages ? 1 : (currentPage || 0)+1)} onChange={event => setStart(event.target.value)}/></label><label>Ending page<input name="reading_end_page" type="number" min={start || 1} max={100000} required={!!(start || end)} value={end} placeholder="Optional" onChange={event => setEnd(event.target.value)}/></label></div>{count !== null && <p className="calendar-current-rating">{count} {count === 1 ? "page" : "pages"} read</p>}</div>;
}
