"use client";
import { useActionState, useState } from "react";
import { saveBook } from "@/app/books/actions";
import { StarRating } from "@/components/movies/star-rating";
import { readingStatuses } from "@/lib/book-validation";
import type { BookTracking } from "@/lib/books";
import type { BookEdition } from "@/lib/open-library";

export function BookTrackingForm({ id, entry, editions, defaultEditionId, unavailable }: { id: number; entry: BookTracking | null; editions: BookEdition[]; defaultEditionId?: string; unavailable?: boolean }) {
  const [state, action, pending] = useActionState(saveBook, {});
  const initialEdition = entry?.edition_id || (!entry || entry.current_page === 0 ? defaultEditionId || "" : "");
  const [edition, setEdition] = useState(initialEdition);
  const [status, setStatus] = useState(entry?.effective_status || "want_to_read");
  const [startedOn, setStartedOn] = useState(entry?.effective_started_on || "");
  const [finishedOn, setFinishedOn] = useState(entry?.effective_finished_on || "");
  const [datesChanged, setDatesChanged] = useState(false);
  const [totalPages, setTotalPages] = useState(String(entry?.total_pages || editions.find(edition => edition.id === initialEdition)?.pages || ""));
  const [page, setPage] = useState(String(entry?.current_page || 0));
  const [progressChanged, setProgressChanged] = useState(false);
  const [statusChanged, setStatusChanged] = useState(false);
  return <form action={action} className="account-form book-tracking-form">
    <h3>Your reading</h3><input type="hidden" name="work_id" value={`OL${id}W`}/><input type="hidden" name="progress_changed" value={progressChanged ? "on" : ""}/><input type="hidden" name="status_changed" value={statusChanged ? "on" : ""}/><input type="hidden" name="dates_changed" value={datesChanged ? "on" : ""}/>
    <div className="calendar-form-row"><label>Reading status<select aria-label="Reading status" name="status" value={status} onChange={event => { const next = event.target.value as keyof typeof readingStatuses; setStatus(next); setStatusChanged(true); if (next !== "finished" && finishedOn) { setFinishedOn(""); setDatesChanged(true); } if (next === "want_to_read" && startedOn) { setStartedOn(""); setDatesChanged(true); } }}>{Object.entries(readingStatuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Your edition<select aria-label="Your edition" name="edition_id" value={edition} onChange={event => { const selected = editions.find(e => e.id === event.target.value); setEdition(event.target.value); setTotalPages(String(selected?.pages || "")); setPage("0"); setProgressChanged(true); }}><option value="">Edition not specified</option>{entry?.edition_id && !editions.some(e => e.id === entry.edition_id) && <option value={entry.edition_id}>{entry.edition_id} · Saved edition</option>}{editions.map(e => <option key={e.id} value={e.id}>{e.id} · {e.publishers[0] || e.title}{e.pages ? ` · ${e.pages} pages` : ""}{e.publish_date ? ` · ${e.publish_date}` : ""}</option>)}</select></label></div>
    <div className="calendar-form-row"><label>Pages in your edition<input name="total_pages" type="number" min={1} max={100000} value={totalPages} onChange={event => setTotalPages(event.target.value)} placeholder="Unknown"/></label><label>Current page<input name="current_page" type="number" min={0} max={totalPages || 100000} value={status === "finished" && totalPages ? totalPages : page} onChange={event => { setPage(event.target.value); setProgressChanged(true); }}/></label></div>
    <div className="calendar-form-row"><label>Date started<input aria-label="Date started" name="started_on" type="date" value={startedOn} onChange={event => { setStartedOn(event.target.value); setDatesChanged(true); setStatusChanged(true); if (!finishedOn) setStatus(event.target.value ? "reading" : "want_to_read"); }}/></label><label>Date finished<input aria-label="Date finished" name="finished_on" type="date" min={startedOn || undefined} value={finishedOn} onChange={event => { setFinishedOn(event.target.value); setDatesChanged(true); setStatusChanged(true); setStatus(event.target.value ? "finished" : "reading"); }}/></label></div>
    <StarRating defaultValue={entry?.rating ?? null}/>
    <label>Book review<textarea aria-label="Book review" name="review" rows={4} maxLength={10000} defaultValue={entry?.review || ""}/></label><label className="check-label"><input type="checkbox" name="contains_spoilers" defaultChecked={entry?.contains_spoilers}/>Contains spoilers</label>
    <label>Private reading notes<textarea aria-label="Private reading notes" name="private_notes" rows={4} maxLength={10000} defaultValue={entry?.private_notes || ""}/></label>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}{state.message && <p role="status">{state.message}</p>}
    <button className="account-button" disabled={pending || unavailable}>{pending ? "Saving…" : entry ? "Save reading record" : "Add to my library"}</button>
  </form>;
}
