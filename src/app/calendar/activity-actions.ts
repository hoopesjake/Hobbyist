"use server";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSeason, getTitle } from "@/lib/tmdb";
import { validId } from "@/lib/media-validation";

export async function loadActivitySeasons(showId: number) {
  const user = await currentUser();
  if (!user || !validId(showId)) return { seasons: [], error: "This show is unavailable." };
  try {
    const show = await getTitle("tv", showId);
    return { seasons: (show.seasons || []).filter(s => s.episode_count > 0).map(s => ({ season_number: s.season_number, name: s.name, episode_count: s.episode_count })).sort((a,b) => a.season_number - b.season_number) };
  } catch {
    return { seasons: [], error: "Seasons could not be loaded. Please try again." };
  }
}

export async function loadActivityContext(type: "movie" | "tv" | "game" | "book", id: number, episodeIds: number[] = []) {
  const user = await currentUser();
  if (!user || !["movie", "tv", "game", "book"].includes(type) || !validId(id)) return { error: "This library item is unavailable." };
  const client = await createClient();
  const { data, error } = await client.from(type === "movie" ? "movie_tracking" : type === "tv" ? "tv_tracking" : type === "book" ? "book_library" : "game_tracking")
    .select("*").eq("user_id", user.id).eq(type === "game" ? "igdb_id" : type === "book" ? "ol_work_id" : "tmdb_id", id).maybeSingle();
  if (error) return { error: "Your current rating could not be loaded." };
  const latest = await client.from("calendar_entries").select("event_date").eq("user_id", user.id).eq("media_type", type).eq("provider_id", id).eq("kind", "actual").order("event_date", { ascending: false }).limit(1).maybeSingle();
  if (latest.error) return { error: "Your rating history could not be loaded." };
  const episodeRatings: Record<number, number | null> = {};
  if (type === "tv" && Array.isArray(episodeIds) && episodeIds.length <= 100 && episodeIds.length && episodeIds.every(value => validId(value))) {
    const result = await client.from("tv_episode_tracking").select("tmdb_episode_id,rating").eq("user_id", user.id).eq("tmdb_show_id", id).in("tmdb_episode_id", episodeIds);
    if (result.error) return { error: "Episode ratings could not be loaded." };
    for (const e of result.data || []) episodeRatings[e.tmdb_episode_id] = e.rating;
  }
  return { rating: data?.rating as number | null ?? null, review: String(data?.review || ""), spoilers: !!data?.contains_spoilers, episodeRatings, latestDate: latest.data?.event_date as string | undefined, currentPage: type === "book" ? Number(data?.current_page || 0) : undefined, totalPages: type === "book" ? data?.total_pages as number | null : undefined };
}

export async function loadActivitySeason(showId: number, season: number) {
  const user = await currentUser();
  if (!user || !validId(showId) || !Number.isInteger(season) || season < 0 || season > 99999) return { episodes: [], error: "Choose a valid season." };
  const client = await createClient();
  const tracked: { episode_number: number; tmdb_episode_id: number; rating: number | null }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("tv_episode_tracking").select("episode_number,tmdb_episode_id,rating").eq("user_id", user.id).eq("tmdb_show_id", showId).eq("season_number", season).order("episode_number").range(offset, offset + 499);
    if (error) return { episodes: [], error: "Episode tracking could not be loaded." };
    tracked.push(...data);
    if (data.length < 500) break;
  }
  try {
    const metadata = await getSeason(showId, season);
    return { episodes: (metadata.episodes || []).map(e => ({ season_number: season, episode_number: e.episode_number, tmdb_episode_id: e.id, name: e.name, current_rating: tracked.find(row => row.episode_number === e.episode_number)?.rating ?? null })) };
  } catch {
    return { episodes: tracked.map(e => ({ season_number: season, episode_number: e.episode_number, tmdb_episode_id: e.tmdb_episode_id, name: `Episode ${e.episode_number}`, current_rating: e.rating })), error: "Catalog unavailable. Saved episodes are shown." };
  }
}
