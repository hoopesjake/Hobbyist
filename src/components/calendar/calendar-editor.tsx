"use client";
import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { X, Check, LockKeyhole, Trash2, Camera, NotebookPen } from "lucide-react";
import { saveCalendarEntry, deleteCalendarEntry, type CalendarActionState } from "@/app/calendar/actions";
import { calendarCategories, categoryLabels, planStatuses, dateInZone, possibleInstants, calendarTime, type CalendarCategory, type CalendarEntry, type LibraryOption } from "@/lib/calendar-domain";
import { QuickPhotoAdd } from "./quick-photo-add";
import { QuickMemoryAdd } from "./quick-memory-add";

import { ActivityPhotos, type ActivityPhotoHandle } from "@/components/calendar/activity-photos";
import { TvEpisodePicker } from "@/components/calendar/tv-episode-picker";
import { ActivityDetails } from "@/components/calendar/activity-details";
import { HobbyPicker } from "@/components/calendar/hobby-picker";
import { MediaImage } from "@/components/movies/media-image";
import { RatingStars } from "@/components/movies/rating-stars";

export type CalendarDraft = Partial<CalendarEntry> & { id: string; kind: "plan" | "actual"; event_date: string; time_zone: string };
type Props = { draft: CalendarDraft; onClose: () => void; onSaved: (message: string) => void; onLog?: () => void; related?: CalendarEntry; originalPlan?: CalendarEntry; onOpenPlan?: () => void };

export function CalendarEditor({ draft, onClose, onSaved, onLog, related, originalPlan, onOpenPlan }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [ratingTarget, setRatingTarget] = useState<HTMLDivElement | null>(null);
  const [category, setCategory] = useState<CalendarCategory>(draft.category || "other");
  const [kind, setKind] = useState(draft.kind);
  const [eventDate, setEventDate] = useState(draft.event_date);
  const [title, setTitle] = useState(draft.title || "");
  const [media, setMedia] = useState(draft.media_type && draft.provider_id ? `${draft.media_type}:${draft.provider_id}` : "");
  const [hobby, setHobby] = useState<LibraryOption | null>(() => draft.media_type && draft.provider_id ? { key: `${draft.media_type}:${draft.provider_id}`, title: draft.media_title || draft.title || "Linked hobby", media_type: draft.media_type, provider_id: draft.provider_id, image_url: draft.media_image || null, in_library: true } : null);
  const [addToLibrary, setAddToLibrary] = useState(!!draft.library_add);
  const [ready, setReady] = useState(!!draft.updated_at || !!draft.media_type);
  const [picking, setPicking] = useState(false);
  const [hasEnd, setHasEnd] = useState(!!draft.end_time);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [quickAction, setQuickAction] = useState<"photos" | "memory" | null>(null);
  const [saving, setSaving] = useState(false);
  const [photosBusy, setPhotosBusy] = useState(false);
  const photos = useRef<ActivityPhotoHandle>(null);
  const lastSavedId = useRef<string | null>(null);
  const lastSavedVersion = useRef<string | null>(null);
  async function save(state: CalendarActionState, form: FormData) {
    setSaving(true);
    try {
      if (lastSavedId.current) {
        if (!lastSavedVersion.current) return { error: "Your activity was saved. Reopen it before retrying the remaining photos." };
        form.set("updated_at", lastSavedVersion.current);
      }
      if (photos.current?.hasPending()) form.set("photo_workflow", "on");
      const result = await saveCalendarEntry(state, form);
      if (result.message && result.id) {
        lastSavedId.current = result.id;
        lastSavedVersion.current = result.updated_at || null;
        const photoError = await photos.current?.upload(result.id);
        if (photoError) return { error: `Activity saved. ${photoError} Select Save activity to retry.` };
        onSaved(result.message);
      }
      return result;
    } catch { return { error: "Your activity could not be saved. Check your connection and try again." }; }
    finally { setSaving(false); }
  }
  async function remove(state: CalendarActionState, form: FormData) {
    setSaving(true);
    try {
      const result = await deleteCalendarEntry(state, form);
      if (result.message) onSaved(result.message);
      return result;
    } catch { return { error: "Your activity could not be deleted. Try again." }; }
    finally { setSaving(false); }
  }
  const [state, action, pending] = useActionState(save, {});
  const [removeState, removeAction, removing] = useActionState(remove, {});
  function selectHobby(item: LibraryOption, add: boolean) {
    if (!title.trim() || title === hobby?.title.slice(0, 200)) setTitle(item.title.slice(0, 200));
    setHobby(item); setMedia(item.key); setAddToLibrary(add); setReady(true); setPicking(false);
    setCategory(item.media_type === "movie" ? "movies" : item.media_type === "tv" ? "tv" : item.media_type === "book" ? "books" : "games");
  }
  const existing = !!draft.updated_at;
  const completingPlan = !existing && kind === "actual" && !!draft.plan_id;
  const minimalView = existing && !editing;
  const art = <div className="calendar-minimal-art">{draft.media_image ? <MediaImage src={draft.media_image} alt={`${draft.media_title || title} cover`} width={160} height={240} unoptimized/> : <span className="poster-fallback">No cover</span>}</div>;
  return <dialog ref={element => { dialog.current = element; if (element && !element.open) element.showModal(); }} className="review-dialog calendar-dialog" aria-labelledby="calendar-editor-title" onCancel={event => { if (saving) event.preventDefault(); else onClose(); }}>
    <div className="review-dialog-content"><header className="review-dialog-header"><div><p className="eyebrow">{existing ? "YOUR ACTIVITY" : draft.plan_id ? "FROM YOUR PLAN" : "MAKE A LITTLE TIME"}</p><h2 id="calendar-editor-title">{minimalView ? "Your activity" : completingPlan ? "Complete this plan" : existing ? "Edit activity" : kind === "plan" ? "Plan an activity" : "Log an activity"}</h2></div><button className="icon-button" type="button" aria-label="Close activity" disabled={saving} onClick={onClose}><X size={20}/></button></header>
      {originalPlan && <div className="calendar-log-plan"><p className="welcome-copy">Original plan: <strong>{originalPlan.title}</strong> · {originalPlan.event_date}</p>{onOpenPlan && <button className="calendar-secondary" type="button" onClick={onOpenPlan}>View original plan</button>}</div>}
      {minimalView ? <div className="calendar-minimal">
        {art}
        <RatingStars rating={draft.session_rating ?? null} centered/>
        <h3 className="calendar-minimal-title">{draft.media_title || title}</h3>
        <p className="catalog-kind">{categoryLabels[category]}</p>
        <dl className="calendar-minimal-facts">
          <div><dt>{kind === "actual" ? "Completed" : "Planned"}</dt><dd>{draft.event_date}</dd></div>
          {kind === "plan" && draft.start_time && <div><dt>Time</dt><dd>{calendarTime(draft.start_time)}</dd></div>}
          {draft.season_number != null && <div><dt>Season</dt><dd>{draft.season_number}</dd></div>}
          {draft.episode_number != null && <div><dt>Episode</dt><dd>{draft.episode_number}</dd></div>}
        </dl>
        {quickAction === "photos" ? <QuickPhotoAdd entryId={draft.id} onDone={() => setQuickAction(null)}/>
        : quickAction === "memory" ? <QuickMemoryAdd draft={draft} onSaved={onSaved} onCancel={() => setQuickAction(null)}/>
        : <div className="calendar-minimal-actions">
          <button type="button" className="calendar-secondary" onClick={() => setQuickAction("photos")}><Camera size={14}/>Add photos</button>
          <button type="button" className="calendar-secondary" onClick={() => setQuickAction("memory")}><NotebookPen size={14}/>{kind === "actual" ? "Log memory" : "Edit plan notes"}</button>
          <button type="button" className="calendar-secondary" onClick={() => setEditing(true)}>Edit details</button>
        </div>}
      </div> : <form action={action} className="account-form calendar-form">
        <input type="hidden" name="id" value={draft.id}/><input type="hidden" name="updated_at" value={draft.updated_at || ""}/><input type="hidden" name="plan_id" value={draft.plan_id || ""}/><input type="hidden" name="privacy" value="private"/>
        <input type="hidden" name="media_image" value={hobby?.image_url || ""}/><input type="hidden" name="media" value={media}/><input type="hidden" name="media_title" value={hobby?.title || ""}/><input type="hidden" name="library_add" value={addToLibrary ? "on" : ""}/>
        {completingPlan ? <>
          <input type="hidden" name="kind" value="actual"/><input type="hidden" name="title" value={title}/><input type="hidden" name="category" value={category}/><input type="hidden" name="time_zone" value={draft.time_zone}/>
          <div className="calendar-complete-header">{art}<div><h3 className="calendar-minimal-title">{draft.media_title || title}</h3><p className="catalog-kind">{categoryLabels[category]}</p></div></div>
          <div className="calendar-form-row"><label>Actual date<input type="date" name="event_date" min="1900-01-01" max="2199-12-31" required value={eventDate} onChange={event => setEventDate(event.target.value)}/></label><label>Started at<input type="time" name="start_time" defaultValue={draft.start_time?.slice(0, 5) || ""}/></label></div>
          <label>Finished at<input type="time" name="end_time"/></label>
          <label>Who was there?<input name="participants" maxLength={500} defaultValue={draft.participants || ""} placeholder="Optional"/></label>
          <label>How did it go?<textarea name="notes" rows={3} maxLength={10000} placeholder="Leave a comment (optional)"/></label>
          {hobby && <ActivityPhotos ref={photos} onBusyChange={setPhotosBusy}/>}
          {state.error && <p role="alert" className="form-error">{state.error}</p>}
          <button className="account-button" disabled={pending || photosBusy}><Check size={16}/>{pending ? "Saving…" : "Mark complete"}</button>
        </> : <>
        <HobbyPicker ratingRef={setRatingTarget} initial={hobby} onSelect={selectHobby} onPicking={setPicking} onCustom={() => { setHobby(null); setMedia(""); setAddToLibrary(false); setCategory("other"); setReady(true); setPicking(false); }}/>
        {hobby && !picking && <Link className="text-link calendar-media-link" href={`/${hobby.media_type === "movie" ? "movies" : hobby.media_type === "tv" ? "tv" : hobby.media_type === "book" ? "books" : "games"}/${hobby.media_type === "book" ? `OL${hobby.provider_id}W` : hobby.provider_id}`}>View linked {hobby.media_type === "tv" ? "show" : hobby.media_type}</Link>}
        {ready && <div className={`hobby-event-details${picking ? " hobby-event-details-muted" : ""}`} inert={picking}>
        {existing || draft.plan_id ? <><input type="hidden" name="kind" value={kind}/><p className="calendar-kind-label">{kind === "plan" ? "Planned activity" : "Actual activity log"}{draft.plan_id ? " · Linked to your original plan" : ""}</p></> : <fieldset className="calendar-kind-picker"><legend className="sr-only">Activity type</legend>{(["plan", "actual"] as const).map(value => <label key={value}><input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)}/><span>{value === "plan" ? "Plan activity" : "Log what I did"}</span></label>)}</fieldset>}
        <label>Title<input name="title" required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} placeholder={category === "games" ? "A little gaming time" : category === "movies" ? "Movie night" : "What are you making time for?"}/></label>
        <div className="calendar-form-row"><label>Category{media ? <><input type="hidden" name="category" value={category}/><input aria-label="Category" value={categoryLabels[category]} readOnly/></> : <select aria-label="Category" name="category" value={category} onChange={event => setCategory(event.target.value as CalendarCategory)}>{calendarCategories.map(value => <option key={value} value={value}>{categoryLabels[value]}</option>)}</select>}</label><label>Date<input name="event_date" type="date" min="1900-01-01" max="2199-12-31" required value={eventDate} onChange={event => setEventDate(event.target.value)}/></label></div>
        {hobby?.media_type === "tv" && kind === "plan" && <TvEpisodePicker key={media} showId={hobby.provider_id} initialSeason={media === `${draft.media_type}:${draft.provider_id}` ? draft.season_number ?? null : null} initialEpisode={media === `${draft.media_type}:${draft.provider_id}` ? draft.episode_number ?? null : null}/>}
        {hobby && <ActivityDetails key={`${media}-${kind}`} type={hobby.media_type} id={hobby.provider_id} draft={draft} date={eventDate} planned={kind === "plan"} ratingTarget={ratingTarget}/>}
        <details className="calendar-form-details" open={!!draft.start_time || !!draft.duration_minutes}><summary>Timing <span>Optional</span></summary><div className="calendar-detail-fields">
          <div className="calendar-form-row"><label>Start time<input type="time" name="start_time" defaultValue={draft.start_time?.slice(0, 5) || ""}/></label><label>Duration (minutes)<input type="number" name="duration_minutes" min={1} max={10080} step={1} disabled={hasEnd} defaultValue={draft.duration_minutes || ""} placeholder={hasEnd ? "Calculated from times" : "Optional"}/></label></div>
          {!hasEnd && <label className="check-label"><input type="checkbox" name="approximate" defaultChecked={draft.approximate}/>Approximate duration</label>}
          <div className="calendar-form-row"><label>End time<input type="time" name="end_time" defaultValue={draft.end_time?.slice(0, 5) || ""} onChange={event => setHasEnd(!!event.target.value)}/></label>{hasEnd && <label>End date<input type="date" name="end_date" min="1900-01-01" max="2199-12-31" defaultValue={draft.end_date || ""}/><small>Leave blank for the same day.</small></label>}</div>
          <label>Time zone<input name="time_zone" required list="calendar-time-zones" defaultValue={draft.time_zone} maxLength={100}/><datalist id="calendar-time-zones">{["America/Denver", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Australia/Sydney", "UTC"].map(zone => <option key={zone} value={zone}/>)}</datalist></label>
          <details><summary>When the clocks go back</summary><div className="calendar-form-row"><label>Repeated start time<select name="start_occurrence" defaultValue={draft.starts_at && draft.start_time ? occurrence(draft.starts_at, draft.time_zone) : ""}><option value="">Choose if needed</option><option value="earlier">First occurrence</option><option value="later">Second occurrence</option></select></label><label>Repeated end time<select name="end_occurrence" defaultValue={draft.ends_at && draft.end_time ? occurrence(draft.ends_at, draft.time_zone) : ""}><option value="">Choose if needed</option><option value="earlier">First occurrence</option><option value="later">Second occurrence</option></select></label></div></details>
        </div></details>
        <label>{kind === "actual" ? "Notes & memories" : "Plan notes"}<textarea name="notes" rows={4} maxLength={10000} defaultValue={draft.notes || ""} placeholder={kind === "actual" ? "What would you like to remember?" : "Anything you want to plan ahead?"}/></label>
        {hobby && <ActivityPhotos ref={photos} entryId={draft.updated_at ? draft.id : undefined} onBusyChange={setPhotosBusy}/>}
        <details className="calendar-form-details" open={!!draft.participants || (existing && kind === "plan")}><summary>People & details</summary><div className="calendar-detail-fields"><label>Who was there?<input name="participants" maxLength={500} defaultValue={draft.participants || ""} placeholder="Optional"/></label>{kind === "plan" && <label>Plan status<select name="status" defaultValue={draft.status || "planned"}>{planStatuses.map(status => <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>)}</select></label>}<p className="calendar-private"><LockKeyhole size={14}/>Private · Only you can see this activity and its notes.</p></div></details>
        {state.error && <p role="alert" className="form-error">{state.error}</p>}
        <button className="account-button" disabled={pending || removing || picking || photosBusy}>{pending ? "Saving…" : "Save activity"}</button>
        </div>}
        </>}
      </form>}
      {existing && kind === "plan" && onLog && <div className="calendar-log-plan"><button type="button" className="calendar-secondary" disabled={saving} onClick={onLog}>{related ? "View logged activity" : <><Check size={14}/>Complete event</>}</button>{related && <p className="welcome-copy">Logged: {related.title} · {related.event_date}</p>}</div>}
      {existing && editing && <div className="calendar-delete">{confirmDelete ? <><p>Delete this {kind === "plan" ? "plan? Its linked memory will be kept." : "activity and its private notes?"}</p><form action={removeAction}><input type="hidden" name="id" value={draft.id}/><input type="hidden" name="updated_at" value={draft.updated_at}/><button type="submit" className="calendar-danger" disabled={pending || removing}>{removing ? "Deleting…" : "Delete permanently"}</button><button type="button" className="calendar-secondary" disabled={removing} onClick={() => setConfirmDelete(false)}>Keep activity</button></form>{removeState.error && <p className="form-error" role="alert">{removeState.error}</p>}</> : <button type="button" className="calendar-danger" disabled={saving} onClick={() => setConfirmDelete(true)}><Trash2 size={14}/>Delete activity</button>}</div>}
    </div>
  </dialog>;
}

function occurrence(instant: string, zone: string) {
  // Existing records retain their explicit UTC instant across a DST fold.
  const value = new Date(instant);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value);
  const candidates = possibleInstants(dateInZone(value, zone), time, zone);
  return candidates.length > 1 && candidates[candidates.length - 1] === value.getTime() ? "later" : "earlier";
}
