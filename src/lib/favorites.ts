import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getListCatalogItem, toLibraryOption, type ListCatalogItem } from "@/lib/list-catalog";
import type { LibraryOption } from "@/lib/calendar-domain";

export const favoriteCategories = ["movie", "tv", "game", "book"] as const;
export type FavoriteCategory = typeof favoriteCategories[number];
export type FavoriteRow = { category: FavoriteCategory; position: number; tmdb_id: number | null; igdb_id: number | null; ol_id: number | null };
export const favoritesUnavailable = "Favorites could not be loaded. Please try again later.";

export const getFavoriteRows = cache(async (userId: string) => {
  const client = await createClient();
  const { data, error } = await client.from("profile_favorites").select("category,position,tmdb_id,igdb_id,ol_id").eq("user_id", userId).order("category").order("position");
  if (error) { console.error("Favorites lookup failed:", error.code); return { rows: [] as FavoriteRow[], error: favoritesUnavailable }; }
  return { rows: data as FavoriteRow[], error: null };
});

export type ResolvedFavorite = { row: FavoriteRow; item: ListCatalogItem; option: LibraryOption };
// Resolves every saved favorite to display-ready cover/title data, reusing the exact same
// catalog lookup Lists already uses so a dead TMDB/IGDB/Open Library id degrades the same way.
export async function getFavoritesByCategory(userId: string): Promise<{ favorites: Record<FavoriteCategory, ResolvedFavorite[]>; error: string | null }> {
  const { rows, error } = await getFavoriteRows(userId);
  const empty = { movie: [], tv: [], game: [], book: [] } as Record<FavoriteCategory, ResolvedFavorite[]>;
  if (error) return { favorites: empty, error };
  const resolved = await Promise.all(rows.map(async row => {
    const item = await getListCatalogItem({ list_id: "", media_type: row.category, tmdb_id: row.tmdb_id, igdb_id: row.igdb_id, ol_id: row.ol_id, position: row.position, created_at: "" });
    return { row, item, option: toLibraryOption(item) };
  }));
  for (const favorite of resolved) empty[favorite.row.category].push(favorite);
  return { favorites: empty, error: null };
}
