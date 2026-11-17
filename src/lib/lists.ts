import "server-only";
import { cache } from "react";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
export type MediaList = { id: string; name: string; description: string; visibility: "private" | "public"; created_at: string; updated_at: string };
export type ListItem = { list_id: string; media_type: "movie" | "tv" | "game"; tmdb_id: number | null; igdb_id: number | null; position: number; created_at: string };
export const listsUnavailable = "Your lists could not be loaded. Please try again later.";
const columns = "id,name,description,visibility,created_at,updated_at";
export const getOwnedLists = cache(async () => {
  const user = await currentUser();
  const lists: MediaList[] = [];
  if (!user) return { lists, error: null };
  const client = await createClient();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("media_lists").select(columns).eq("user_id", user.id).order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) { console.error("Lists lookup failed:", error.code); return { lists: [], error: listsUnavailable }; }
    lists.push(...data as MediaList[]);
    if (data.length < 500) return { lists, error: null };
  }
});
export const getList = cache(async (id: string) => {
  const client = await createClient();
  const { data, error } = await client.from("media_lists").select(columns).eq("id", id).maybeSingle();
  if (error) { console.error("List lookup failed:", error.code); return { list: null, owner: false, error: listsUnavailable }; }
  if (!data) return { list: null, owner: false, error: null };
  const user = await currentUser();
  let owner = false;
  if (user) {
    const result = await client.from("media_lists").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (result.error) return { list: null, owner: false, error: listsUnavailable };
    owner = !!result.data;
  }
  return { list: data as MediaList, owner, error: null };
});
export async function getListItems(id: string, page: number) {
  const client = await createClient();
  const { data, count, error } = await client.from("media_list_items").select("list_id,media_type,tmdb_id,igdb_id,position,created_at", { count: "exact" }).eq("list_id", id)
    .order("position").range((page - 1) * 20, page * 20 - 1);
  if (error) { console.error("List items lookup failed:", error.code); return { items: [], total: 0, error: listsUnavailable }; }
  return { items: data as ListItem[], total: count || 0, error: null };
}
