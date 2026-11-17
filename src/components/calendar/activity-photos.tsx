"use client";
import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { MediaImage } from "@/components/movies/media-image";
import { maxActivityPhotos, type ActivityPhoto } from "@/lib/activity-photo-validation";

type Pending = { id: string; file: File; url: string; caption: string; attempted?: boolean };
export type ActivityPhotoHandle = { hasPending: () => boolean; upload: (entryId: string) => Promise<string | null> };

async function preparePhoto(file: File) {
  if ((file.type && !file.type.startsWith("image/")) || file.size > 20 * 1024 * 1024) throw Error("Choose an image smaller than 20 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw Error("This device could not prepare the photo.");
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error("Photo could not be prepared.")), "image/jpeg", 0.88));
    return new File([blob], "activity-photo.jpg", { type: "image/jpeg" });
  } finally { bitmap.close(); }
}

export function ActivityPhotos({ entryId, readOnly = false, ref, onBusyChange }: { entryId?: string; readOnly?: boolean; ref?: Ref<ActivityPhotoHandle>; onBusyChange?: (busy: boolean) => void }) {
  const id = useId();
  const [photos, setPhotos] = useState<ActivityPhoto[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef<Pending[]>([]);
  const alive = useRef(true);
  const [captionEdits, setCaptionEdits] = useState<Record<string, string>>({});
  const captions = useRef<Record<string, string>>({});
  function editCaption(photoId: string, value: string) { captions.current = { ...captions.current, [photoId]: value }; setCaptionEdits(captions.current); }
  function clearCaption(photoId: string) { const next = { ...captions.current }; delete next[photoId]; captions.current = next; setCaptionEdits(next); }
  function setQueue(values: Pending[]) { pendingRef.current = values; setPending(values); }
  function working(value: boolean) { setBusy(value); onBusyChange?.(value); }
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; for (const photo of pendingRef.current) URL.revokeObjectURL(photo.url); };
  }, []);
  useEffect(() => {
    if (!entryId) return;
    let active = true, version = 0;
    function load() {
      const request = ++version;
      fetch(`/api/activity-photos?entry=${encodeURIComponent(entryId!)}`, { cache: "no-store" }).then(async response => {
        const result = await response.json();
        if (active && request === version) { if (response.ok) setPhotos(result.photos); else setError(result.error || "Photos could not be loaded."); }
      }).catch(() => { if (active && request === version) setError("Photos could not be loaded."); });
    }
    const changed = (event: Event) => { if ((event as CustomEvent).detail === entryId) load(); };
    load(); window.addEventListener("activity-photos-changed", changed);
    return () => { active = false; window.removeEventListener("activity-photos-changed", changed); };
  }, [entryId]);
  useImperativeHandle(ref, () => ({ hasPending: () => pendingRef.current.length > 0 || Object.keys(captions.current).length > 0, async upload(savedId) {
    if (!pendingRef.current.length && !Object.keys(captions.current).length) return null;
    working(true); setError("");
    try {
      for (const photo of [...pendingRef.current]) {
        photo.attempted = true;
        const body = new FormData(); body.set("id", photo.id); body.set("entry_id", savedId); body.set("photo", photo.file); body.set("caption", photo.caption);
        const response = await fetch("/api/activity-photos", { method: "POST", body });
        const result = await response.json();
        if (!response.ok) throw Error(result.error || "Photo upload failed.");
        setPhotos(values => [...values.filter(value => value.id !== result.photo.id), result.photo]);
        setQueue(pendingRef.current.filter(value => value.id !== photo.id)); URL.revokeObjectURL(photo.url);
        window.dispatchEvent(new CustomEvent("activity-photos-changed", { detail: savedId }));
      }
      for (const [photoId, caption] of Object.entries(captions.current)) {
        const response = await fetch(`/api/activity-photos/${photoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caption }) });
        const result = await response.json();
        if (!response.ok) throw Error(result.error || "Caption could not be saved.");
        setPhotos(values => values.map(value => value.id === photoId ? { ...value, caption: result.photo.caption } : value));
        clearCaption(photoId);
        window.dispatchEvent(new CustomEvent("activity-photos-changed", { detail: savedId }));
      }
      return null;
    } catch (cause) { const message = cause instanceof Error ? cause.message : "Photo upload failed."; setError(message); return message; }
    finally { working(false); }
  } }));
  async function choose(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    working(true); setError("");
    try {
      if (selected.length + pendingRef.current.length + photos.length > maxActivityPhotos) throw Error("Choose up to six photos per activity.");
      for (const file of selected) {
        let prepared: File;
        try { prepared = await preparePhoto(file); }
        catch (cause) { throw Error(cause instanceof Error && cause.message.includes("20 MB") ? cause.message : "This photo could not be opened. Try a JPEG, PNG, or WebP image."); }
        if (!alive.current) return;
        setQueue([...pendingRef.current, { id: crypto.randomUUID(), file: prepared, caption: "", url: URL.createObjectURL(prepared) }]);
      }
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Photos could not be selected."); }
    finally { if (alive.current) working(false); }
  }
  async function remove(photo: ActivityPhoto | Pending) {
    working(true); setError("");
    try {
      if (!("file" in photo) || photo.attempted) {
        const response = await fetch(`/api/activity-photos/${photo.id}`, { method: "DELETE" });
        if (!response.ok) throw Error("Photo could not be removed. Try again.");
      }
      setPhotos(values => values.filter(value => value.id !== photo.id)); clearCaption(photo.id);
      if ("file" in photo) { setQueue(pendingRef.current.filter(value => value.id !== photo.id)); URL.revokeObjectURL(photo.url); }
      window.dispatchEvent(new CustomEvent("activity-photos-changed", { detail: entryId || ("entry_id" in photo ? photo.entry_id : undefined) }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Photo could not be removed."); }
    finally { working(false); }
  }
  const visible = readOnly ? photos.filter(photo => photo.state === "ready") : photos;
  if (readOnly && !visible.length) return null;
  return <section className={`activity-photos${readOnly ? " activity-photos-readonly" : ""}`} aria-label="Activity photos">
    {!readOnly && <><div className="activity-photo-heading"><strong>Photos</strong><small>Private · {photos.length + pending.length} / {maxActivityPhotos}</small></div><div className="activity-photo-actions"><button type="button" className="calendar-secondary" disabled={busy} onClick={() => document.getElementById(`${id}-library`)?.click()}><ImagePlus size={15}/>Choose photos</button><button type="button" className="calendar-secondary" disabled={busy} onClick={() => document.getElementById(`${id}-camera`)?.click()}><Camera size={15}/>Take photo</button></div><input id={`${id}-library`} className="sr-only" aria-label="Choose activity photos" type="file" accept="image/*" multiple disabled={busy} onChange={event => { void choose(event.target.files); event.target.value = ""; }}/><input id={`${id}-camera`} className="sr-only" aria-label="Take activity photo" type="file" accept="image/*" capture="environment" disabled={busy} onChange={event => { void choose(event.target.files); event.target.value = ""; }}/></>}
    <div className="activity-photo-grid">{visible.map((photo, index) => <figure className="activity-photo-item" key={photo.id}><div className="activity-photo-tile">{photo.state === "ready" ? <a href={`/api/activity-photos/${photo.id}`} target="_blank" rel="noreferrer"><MediaImage src={`/api/activity-photos/${photo.id}`} alt="Activity memory photo" width={180} height={180} unoptimized/></a> : <span>Upload incomplete</span>}{!readOnly && <button type="button" aria-label="Remove activity photo" disabled={busy} onClick={() => void remove(photo)}><X size={14}/></button>}</div>{readOnly ? photo.caption && <figcaption>{photo.caption}</figcaption> : <input className="activity-photo-caption" aria-label={`Caption for photo ${index + 1}`} placeholder="Caption (optional)" maxLength={500} disabled={busy} value={captionEdits[photo.id] ?? photo.caption ?? ""} onChange={event => editCaption(photo.id, event.target.value)}/>}</figure>)}{pending.map((photo, index) => <figure className="activity-photo-item" key={photo.id}><div className="activity-photo-tile"><MediaImage src={photo.url} alt="Selected activity photo" width={180} height={180} unoptimized/><button type="button" aria-label="Remove selected photo" disabled={busy} onClick={() => void remove(photo)}><X size={14}/></button></div><input className="activity-photo-caption" aria-label={`Caption for selected photo ${index + 1}`} placeholder="Caption (optional)" maxLength={500} disabled={busy} value={photo.caption} onChange={event => setQueue(pendingRef.current.map(value => value.id === photo.id ? { ...value, caption: event.target.value } : value))}/></figure>)}</div>
    {!readOnly && busy && <p className="calendar-current-rating" role="status">Preparing photos…</p>}
    {!readOnly && error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
