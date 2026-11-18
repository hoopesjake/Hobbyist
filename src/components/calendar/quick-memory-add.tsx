"use client";
import { useActionState } from "react";
import { saveCalendarEntry, type CalendarActionState } from "@/app/calendar/actions";
import type { CalendarDraft } from "./calendar-editor";

// Mirrors every other saved field unchanged and only exposes notes, so jotting a memory
// doesn't require opening the full edit form (and can never touch rating/review/episodes,
// since those fields are simply omitted here rather than sent as "no change").
export function QuickMemoryAdd({ draft, onSaved, onCancel }: { draft: CalendarDraft; onSaved: (message: string) => void; onCancel: () => void }) {
  async function save(state: CalendarActionState, form: FormData) {
    const result = await saveCalendarEntry(state, form);
    if (result.message) onSaved(result.message);
    return result;
  }
  const [state, action, pending] = useActionState(save, {});
  const media = draft.media_type && draft.provider_id ? `${draft.media_type}:${draft.provider_id}` : "";
  return <form action={action} className="account-form quick-memory-add">
    <input type="hidden" name="id" value={draft.id}/>
    <input type="hidden" name="updated_at" value={draft.updated_at || ""}/>
    <input type="hidden" name="plan_id" value={draft.plan_id || ""}/>
    <input type="hidden" name="privacy" value="private"/>
    <input type="hidden" name="kind" value={draft.kind}/>
    <input type="hidden" name="title" value={draft.title || ""}/>
    <input type="hidden" name="category" value={draft.category}/>
    <input type="hidden" name="event_date" value={draft.event_date}/>
    <input type="hidden" name="time_zone" value={draft.time_zone}/>
    <input type="hidden" name="start_time" value={draft.start_time?.slice(0, 5) || ""}/>
    <input type="hidden" name="end_time" value={draft.end_time?.slice(0, 5) || ""}/>
    <input type="hidden" name="end_date" value={draft.end_date || ""}/>
    <input type="hidden" name="duration_minutes" value={draft.duration_minutes ?? ""}/>
    {draft.approximate && <input type="hidden" name="approximate" value="on"/>}
    <input type="hidden" name="participants" value={draft.participants || ""}/>
    <input type="hidden" name="media" value={media}/>
    <input type="hidden" name="media_image" value={draft.media_image || ""}/>
    <input type="hidden" name="media_title" value={draft.media_title || ""}/>
    {draft.kind === "plan" && <input type="hidden" name="status" value={draft.status || "planned"}/>}
    <label>{draft.kind === "actual" ? "Memory" : "Plan notes"}<textarea name="notes" rows={4} maxLength={10000} autoFocus defaultValue={draft.notes || ""} placeholder="What would you like to remember?"/></label>
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
    <div className="list-builder-actions">
      <button className="account-button" disabled={pending}>{pending ? "Saving…" : "Save memory"}</button>
      <button type="button" className="calendar-secondary" disabled={pending} onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}
