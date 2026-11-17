"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listFields, listId, listItem } from "@/lib/list-validation";
import { getTitle, TmdbError } from "@/lib/tmdb";
import { getGame, IgdbError } from "@/lib/igdb";
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
export async function createList(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: "Sign in to create a list." };
  const fields = listFields(form);
  if (fields.error) return { error: fields.error };
  const client = await createClient();
  const { data, error } = await client.from("media_lists").insert({ user_id: user.id, name: fields.name, description: fields.description, visibility: fields.visibility }).select("id").single();
  if (error) { console.error("List creation failed:", error.code); return { error: unavailable }; }
  refresh();
  redirect(`/lists/${data.id}`);
}
export async function updateList(_: FormState, form: FormData): Promise<FormState> {
  const fields = listFields(form);
  if (fields.error) return { error: fields.error };
  const context = await ownedList(form);
  if (context.error) return { error: context.error };
  const { error } = await context.client.from("media_lists").update({ name: fields.name, description: fields.description, visibility: fields.visibility }).eq("id", context.id).eq("user_id", context.user.id);
  if (error) return { error: unavailable };
  refresh(context.id);
  return { message: "List saved." };
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
  if (!item) return { error: "Choose a movie or TV show." };
  const context = await ownedList(form);
  if (context.error) return { error: context.error };
  try {
    const title = item.media_type === "game" ? await getGame(item.igdb_id) : await getTitle(item.media_type, item.tmdb_id);
    if ("adult" in title && title.adult) return { error: "This title is unavailable." };
  } catch (error) { return { error: error instanceof TmdbError || error instanceof IgdbError ? error.message : unavailable }; }
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
  const { error } = await context.client.from("media_list_items").delete().eq("list_id", context.id).eq("media_type", item.media_type).eq(item.media_type === "game" ? "igdb_id" : "tmdb_id", item.media_type === "game" ? item.igdb_id : item.tmdb_id);
  if (error) return { error: unavailable };
  refresh(context.id);
  return { message: "Removed from list." };
}
export async function moveListItem(_: FormState, form: FormData): Promise<FormState> {
  const item = listItem(form), direction = Number(form.get("direction"));
  if (!item || ![-1, 1].includes(direction)) return { error: "Invalid list movement." };
  const context = await ownedList(form);
  if (context.error) return { error: context.error };
  const { error } = await context.client.rpc("move_media_list_item", { p_list: context.id, p_type: item.media_type, p_id: item.media_type === "game" ? item.igdb_id : item.tmdb_id, p_direction: direction });
  if (error) return { error: unavailable };
  refresh(context.id);
  return { message: "List order saved." };
}
