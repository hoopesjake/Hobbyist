"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { draftListItems } from "@/lib/list-validation";
import { favoriteCategories, type FavoriteCategory } from "@/lib/favorites";

export async function saveFavorites(category: string, items: { media_type: string; id: number }[]): Promise<{ error?: string; message?: string }> {
  await requireUser();
  if (!favoriteCategories.includes(category as FavoriteCategory) || items.some(item => item.media_type !== category)) return { error: "Invalid favorites category." };
  if (items.length > 4) return { error: "Choose up to 4 favorites." };
  const parsed = draftListItems(items);
  if (!parsed) return { error: "One of the items you added is invalid. Please try again." };
  const client = await createClient();
  const { error } = await client.rpc("set_profile_favorites", { p_category: category, p_items: parsed });
  if (error) { console.error("Favorites save failed:", error.code); return { error: "Your favorites could not be saved. Please try again." }; }
  revalidatePath("/profile"); revalidatePath("/", "layout");
  return { message: "Favorites saved." };
}
