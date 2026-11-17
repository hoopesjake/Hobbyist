import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calendarId } from "@/lib/calendar-domain";
import { activityPhotoBucket } from "@/lib/activity-photo-validation";
import { cleanActivityPhotos } from "@/lib/activity-photo-storage";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const user = await currentUser(), { id } = await params;
  const reply = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  if (!user) return reply({ error: "Sign in to edit captions." }, 401);
  if (!calendarId(id)) return reply({ error: "Invalid photo." }, 400);
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "Add a valid caption." }, 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    size += chunk.value.length;
    if (size > 8192) { await reader.cancel(); return reply({ error: "Caption is too long." }, 413); }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let caption: string;
  try { const body = JSON.parse(new TextDecoder().decode(bytes)); if (typeof body.caption !== "string") throw Error(); caption = body.caption.trim(); }
  catch { return reply({ error: "Add a valid caption." }, 400); }
  if ([...caption].length > 500) return reply({ error: "Captions can contain up to 500 characters." }, 400);
  const client = await createClient();
  const { data, error } = await client.from("activity_photos").update({ caption }).eq("id", id).eq("user_id", user.id).select("id,entry_id,caption").maybeSingle();
  if (error) return reply({ error: "Caption could not be saved. Try again." }, 503);
  if (!data) return reply({ error: "Photo unavailable." }, 404);
  return reply({ photo: data }, 200);
}

export async function GET(_: Request, { params }: Context) {
  const user = await currentUser(), { id } = await params;
  if (!user || !calendarId(id)) return new Response(null, { status: 404 });
  const client = await createClient();
  const { data } = await client.from("activity_photos").select("storage_path,content_type").eq("id", id).eq("user_id", user.id).eq("state", "ready").maybeSingle();
  if (!data) return new Response(null, { status: 404 });
  const file = await client.storage.from(activityPhotoBucket).download(data.storage_path);
  if (file.error) return new Response(null, { status: 404 });
  return new Response(file.data, { headers: { "Content-Type": data.content_type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
}

export async function DELETE(request: Request, { params }: Context) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const user = await currentUser(), { id } = await params;
  if (!user) return Response.json({ error: "Sign in to remove photos." }, { status: 401 });
  if (!calendarId(id)) return new Response(null, { status: 400 });
  const client = await createClient();
  const { error } = await client.from("activity_photos").delete().eq("id", id).eq("user_id", user.id);
  if (error) return Response.json({ error: "Photo could not be removed. Try again." }, { status: 503 });
  await cleanActivityPhotos(client, user.id);
  return new Response(null, { status: 204 });
}
