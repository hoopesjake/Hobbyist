import "server-only";
import { createClient } from "@/lib/supabase/server";
import { activityPhotoBucket } from "./activity-photo-validation";

// Metadata deletion queues physical deletion durably. Failed Storage removals
// remain queued and are retried on the owner's next photo operation.
export async function cleanActivityPhotos(client: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await client.from("activity_photo_cleanup").select("storage_path").eq("user_id", userId).limit(100);
  if (error || !data?.length) return;
  const paths = data.map(row => row.storage_path as string);
  const removed = await client.storage.from(activityPhotoBucket).remove(paths);
  if (!removed.error) await client.from("activity_photo_cleanup").delete().eq("user_id", userId).in("storage_path", paths);
}
