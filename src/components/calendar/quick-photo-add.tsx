"use client";
import { useRef, useState } from "react";
import { ActivityPhotos, type ActivityPhotoHandle } from "./activity-photos";

// Photos live in their own table keyed by entry id, independent of the calendar entry's
// other fields, so adding one doesn't need the full edit form's save pipeline at all.
export function QuickPhotoAdd({ entryId, onDone }: { entryId: string; onDone: () => void }) {
  const photos = useRef<ActivityPhotoHandle>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setSaving(true); setError("");
    try {
      const result = await photos.current?.upload(entryId);
      if (result) { setError(result); return; }
      onDone();
    } finally { setSaving(false); }
  }
  return <div className="quick-photo-add">
    <ActivityPhotos ref={photos} entryId={entryId} onBusyChange={setBusy}/>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="list-builder-actions">
      <button type="button" className="account-button" disabled={busy || saving} onClick={save}>{saving ? "Saving…" : "Save photos"}</button>
      <button type="button" className="calendar-secondary" disabled={saving} onClick={onDone}>Cancel</button>
    </div>
  </div>;
}
