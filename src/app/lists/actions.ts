"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listFields, listId, listItem, draftListItems } from "@/lib/list-validation";
import { getTitle, TmdbError } from "@/lib/tmdb";
import { getGame, IgdbError } from "@/lib/igdb";
import { getBook, BookCatalogError } from "@/lib/open-library";
import type { FormState } from "@/components/auth/action-form";
const unavailable = "Your list could not be saved. Please try again.";
async function ownedList(form: FormData) {
  const user = await currentUser();
  if (!user) return { error: "Sign in to manage your lists." } as const;
  const id = listId(form.get("list_id"));
  if (!id) return { error: "Invalid list." } as const;
  const client = await createClient();
  const { data, error } = await client.from("media_lists").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) return { error: unavailable } as const;
  if (!data) return { error: "This list is unavailable or belongs to someone else." } as const;
  return { id, user, client } as const;
}
function refresh(id?: string) {
  revalidatePath("/lists");
  if (id) revalidatePath(`/lists/${id}`);
}
export type BuilderInput = { name: string; description: string; visibility: "private" | "public"; items: { media_type: "movie" | "tv" | "game" | "book"; id: number }[] };
function builderFields(input: BuilderInput) {
  const form = new FormData();
  form.set("name", input.name); form.set("description", input.description);
  if (input.visibility === "public") form.set("is_public", "on");
  return listFields(form);
}
// Create the list and every drafted item together: nothing is persisted until this call
// succeeds, so there is never a name-only list sitting empty in "View Lists".
export async function createListWithItems(input: BuilderInput): Promise<FormState & { id?: string }> {
  const user = await currentUser();
  if (!user) return { error: "Sign in to create a list." };
  const fields = builderFields(input);
  if (fields.error) return { error: fields.error };
  const items = draftListItems(input.items);
  if (!items) return { error: "One of the items you added is invalid. Please try again." };
  const client = await createClient();
  const { data, error } = await client.rpc("create_media_list_with_items", { p_name: fields.name, p_description: fields.description, p_visibility: fields.visibility, p_items: items });
  if (error) { console.error("List creation failed:", error.code); return { error: unavailable }; }
  refresh();
  redirect(`/lists/${data}`);
}
// Editing reuses the same atomic shape: fields and the full item set are replaced together.
export async function updateListWithItems(listIdValue: string, input: BuilderInput): Promise<FormState> {
  const id = listId(listIdValue);
  if (!id) return { error: "Invalid list." };
  const user = await currentUser();
  if (!user) return { error: "Sign in to manage your lists." };
  const fields = builderFields(input);
  if (fields.error) return { error: fields.error };
  const items = draftListItems(input.items);
  if (!items) return { error: "One of the items you added is invalid. Please try again." };
  const client = await createClient();
  const { error } = await client.rpc("update_media_list_with_items", { p_list: id, p_name: fields.name, p_description: fields.description, p_visibility: fields.visibility, p_items: items });
  if (error) { console.error("List update failed:", error.code); return { error: unavailable }; }
  refresh(id);
  redirect(`/lists/${id}`);
}
export async function deleteList(_: FormState, form: FormData): Promise<FormState> {
  const context = await ownedList(form);
  if (context.error) return { error: context.error };
  const { error } = await context.client.from("media_lists").delete().eq("id", context.id).eq("user_id", context.user.id);
  if (error) return { error: unavailable };
  refresh(context.id);
  redirect("/lists");
}
export async function addListItem(_: FormState, form: FormData): Promise<FormState> {
  const item = listItem(form);
  if (!item) return { error: "Choose a movie, TV show, game, or book." };
  const context = await ownedList(form);
  if (context.error) return { error: context.error };
  try {
    const title = item.media_type === "game" ? await getGame(item.igdb_id) : item.media_type === "book" ? await getBook(item.ol_id) : await getTitle(item.media_type, item.tmdb_id);
    if ("adult" in title && title.adult) return { error: "This title is unavailable." };
  } catch (error) { return { error: error instanceof TmdbError || error instanceof IgdbError || error instanceof BookCatalogError ? error.message : unavailable }; }
  const { error } = await context.client.from("media_list_items").insert({ list_id: context.id, ...item });
  if (error?.code === "23505") return { message: "Already on this list." };
  if (error) return { error: unavailable };
  refresh(context.id);
  return { message: "Added to list." };
}
export async function removeListItem(_: FormState, form: FormData): Promise<FormState> {
  const item = listItem(form);
  if (!item) return { error: "Invalid list item." };
  const context = await ownedList(form);
  if (context.error) return { error: context.error };
  const idColumn = item.media_type === "game" ? "igdb_id" : item.media_type === "book" ? "ol_id" : "tmdb_id";
  const idValue = item.media_type === "game" ? item.igdb_id : item.media_type === "book" ? item.ol_id : item.tmdb_id;
  const { error } = await context.client.from("media_list_items").delete().eq("list_id", context.id).eq("media_type", item.media_type).eq(idColumn, idValue);
  if (error) return { error: unavailable };
  refresh(context.id);
  return { message: "Removed from list." };
}
export async function moveListItem(_: FormState, form: FormData): Promise<FormState> {
  const item = listItem(form), direction = Number(form.get("direction"));
  if (!item || ![-1, 1].includes(direction)) return { error: "Invalid list movement." };
  const context = await ownedList(form);
  if (context.error) return { error: context.error };
  const moveId = item.media_type === "game" ? item.igdb_id : item.media_type === "book" ? item.ol_id : item.tmdb_id;
  const { error } = await context.client.rpc("move_media_list_item", { p_list: context.id, p_type: item.media_type, p_id: moveId, p_direction: direction });
  if (error) return { error: unavailable };
  refresh(context.id);
  return { message: "List order saved." };
}
