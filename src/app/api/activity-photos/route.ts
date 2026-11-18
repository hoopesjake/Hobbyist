import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calendarId } from "@/lib/calendar-domain";
import { activityPhotoBucket, activityPhotoType, maxActivityPhotoBytes } from "@/lib/activity-photo-validation";
import { cleanActivityPhotos } from "@/lib/activity-photo-storage";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const sameOrigin = (request: Request) => !request.headers.get("origin") || request.headers.get("origin") === new URL(request.url).origin;

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return json({ error: "Sign in to view photos." }, 401);
  const entry = new URL(request.url).searchParams.get("entry");
  if (!calendarId(entry)) return json({ error: "Invalid activity." }, 400);
  const client = await createClient();
  const { data: owned } = await client.from("calendar_entries").select("id").eq("id", entry).eq("user_id", user.id).maybeSingle();
  if (!owned) return json({ error: "Activity unavailable." }, 404);
  const { data, error } = await client.from("activity_photos").select("id,entry_id,created_at,state,caption").eq("entry_id", entry).eq("user_id", user.id).order("created_at").order("id");
  if (error) return json({ error: "Photos are temporarily unavailable. Please try again." }, 503);
  await cleanActivityPhotos(client, user.id);
  return json({ photos: data });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid photo request." }, 403);
  const user = await currentUser();
  if (!user) return json({ error: "Sign in to add photos." }, 401);
  // Bound the multipart body before parsing, including requests without a length.
  const limit = maxActivityPhotoBytes + 65536;
  const reader = request.body?.getReader();
  if (!reader || Number(request.headers.get("content-length") || 0) > limit) return json({ error: "Photo is too large." }, 413);
  const parts: Uint8Array[] = []; let length = 0;
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    length += chunk.value.length;
    if (length > limit) { await reader.cancel(); return json({ error: "Photos must be smaller than 8 MB." }, 413); }
    parts.push(chunk.value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  let form: FormData;
  try { form = await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData(); }
  catch { return json({ error: "Choose a valid photo." }, 400); }
  const id = form.get("id"), entryId = form.get("entry_id"), file = form.get("photo");
  const caption = String(form.get("caption") || "").trim();
  if ([...caption].length > 500) return json({ error: "Captions can contain up to 500 characters." }, 400);
  if (!calendarId(id) || !calendarId(entryId) || !(file instanceof File) || !file.size || file.size > maxActivityPhotoBytes) return json({ error: "Choose a JPEG, PNG, or WebP photo under 8 MB." }, 400);
  const content = new Uint8Array(await file.arrayBuffer());
  const contentType = activityPhotoType(content);
  if (!contentType || contentType !== file.type) return json({ error: "Choose a JPEG, PNG, or WebP photo." }, 400);
  const client = await createClient();
  await cleanActivityPhotos(client, user.id);
  const { data: parent } = await client.from("calendar_entries").select("id,media_type").eq("id", entryId).eq("user_id", user.id).maybeSingle();
  if (!parent || !parent.media_type) return json({ error: "Save a movie, TV, or game activity before adding photos." }, 400);
  let { data: photo } = await client.from("activity_photos").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!photo) {
    const inserted = await client.from("activity_photos").insert({ id, user_id: user.id, entry_id: entryId, content_type: contentType, byte_size: file.size, caption }).select("*").single();
    if (inserted.error) return json({ error: inserted.error.code === "23514" ? "You can add up to six photos per activity." : "Photo could not be prepared. Please try again." }, 400);
    photo = inserted.data;
  }
  if (photo.entry_id !== entryId || photo.content_type !== contentType || photo.byte_size !== file.size) return json({ error: "Photo details changed. Choose the photo again." }, 409);
  if (form.has("caption") && photo.caption !== caption) {
    const update = await client.from("activity_photos").update({ caption }).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (update.error || !update.data) return json({ error: "Caption could not be saved. Try again." }, 503);
    photo.caption = caption;
  }
  if (photo.state !== "ready") {
    const uploaded = await client.storage.from(activityPhotoBucket).upload(photo.storage_path, content, { contentType, upsert: false });
    if (uploaded.error) {
      // The previous request may have uploaded successfully before disconnecting.
      const existing = await client.storage.from(activityPhotoBucket).download(photo.storage_path);
      if (existing.error || existing.data.size !== file.size) return json({ error: "Photo upload failed. Your activity is saved; try again to retry the photo." }, 503);
    }
    const ready = await client.from("activity_photos").update({ state: "ready" }).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (!ready.error && !ready.data) {
      await client.from("activity_photo_cleanup").upsert({ storage_path: photo.storage_path, user_id: user.id }, { onConflict: "storage_path", ignoreDuplicates: true });
      await cleanActivityPhotos(client, user.id);
      return json({ error: "Activity changed during the upload. Reopen it and try again." }, 409);
    }
    if (ready.error) return json({ error: "Photo uploaded but could not be attached. Try again." }, 503);
  }
  return json({ photo: { id: photo.id, entry_id: photo.entry_id, created_at: photo.created_at, state: "ready", caption: photo.caption || "" } });
}
