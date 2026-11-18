import "server-only";
import { cache } from "react";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ShowStatus, WatchedEpisode } from "@/lib/tracking-validation";
export type PersonalReview = { rating: number | null; review: string; contains_spoilers: boolean; updated_at: string };
export type MovieTracking = PersonalReview & { tmdb_id: number; on_watchlist: boolean; watched: boolean; watched_on: string | null };
export type ShowTracking = PersonalReview & { tmdb_id: number; status: ShowStatus; started_on: string | null; completed_on: string | null };
export type EpisodeTracking = PersonalReview & { tmdb_show_id: number; tmdb_episode_id: number; season_number: number; episode_number: number; watched: boolean; watched_on: string | null };
const unavailable = "Your tracking data is temporarily unavailable. Please try again later.";
async function readOne<T>(table: string, filters: Record<string, number>) {
  const user = await currentUser();
  if (!user) return { entry: null as T | null, error: null };
  const client = await createClient();
  let query = client.from(table).select("*").eq("user_id",user.id);
  for (const [key,value] of Object.entries(filters)) query = query.eq(key,value);
  const { data,error } = await query.maybeSingle();
  if (error) { console.error("Personal tracking lookup failed:",error.code); return {entry:null as T | null,error:unavailable}; }
  return {entry:data as T | null,error:null};
}
export const getMovieTracking = cache((id: number) => readOne<MovieTracking>("movie_tracking",{tmdb_id:id}));
export const getShowTracking = cache((id: number) => readOne<ShowTracking>("tv_tracking",{tmdb_id:id}));
export const getEpisodeTracking = cache((id: number, season: number, episode: number) => readOne<EpisodeTracking>("tv_episode_tracking",{tmdb_show_id:id,season_number:season,episode_number:episode}));
async function readPage<T>(table: string, page: number, filter: string, limit: number) {
  const user = await currentUser();
  if (!user) return {entries:[] as T[], total:0,error:null};
  const client = await createClient();
  let query = client.from(table).select("*",{count:"exact"}).eq("user_id",user.id);
  if (table === "movie_tracking" && filter !== "all") query=query.eq(filter === "watchlist" ? "on_watchlist" : "watched",true);
  if (table === "tv_tracking" && filter !== "all") query=query.eq("status",filter);
  if(table === "movie_tracking" && filter === "watched") query=query.order("watched_on",{ascending:false,nullsFirst:false});
  const {data,count,error}=await query.order("updated_at",{ascending:false}).order("tmdb_id").range((page-1)*limit,page*limit-1);
  if(error){console.error("Tracking library read failed:",error.code);return {entries:[] as T[],total:0,error:unavailable};}
  return {entries:data as T[],total:count || 0,error:null};
}
export const getMovies = cache((page=1,filter="all",limit=24)=>readPage<MovieTracking>("movie_tracking",page,filter,limit));
export const getMovieHistory = cache(async () => {
  const entries: MovieTracking[] = [];
  for (let page = 1; ; page++) {
    const result = await getMovies(page, "all", 500);
    if (result.error) return { entries: [], error: result.error };
    entries.push(...result.entries);
    if (entries.length >= result.total || !result.entries.length) return { entries, error: null };
  }
});
export const getShows = cache((page=1,filter="all",limit=24)=>readPage<ShowTracking>("tv_tracking",page,filter,limit));
export const getLatestWatchedEpisode = cache(async (showId: number) => {
  const user = await currentUser(); if (!user) return null;
  const client = await createClient();
  const { data, error } = await client.from("tv_episode_tracking").select("season_number,episode_number").eq("user_id", user.id).eq("tmdb_show_id", showId).eq("watched", true)
    .order("season_number", { ascending: false }).order("episode_number", { ascending: false }).limit(1).maybeSingle();
  if (error) { console.error("Latest episode lookup failed:", error.code); return null; }
  return data as { season_number: number; episode_number: number } | null;
});
export const getTVHistory = cache(async () => {
  const user = await currentUser();
  const shows: ShowTracking[] = [];
  const episodes: EpisodeTracking[] = [];
  if (!user) return { shows, episodes, error: null };
  const client = await createClient();
  for (let page = 1; ; page++) {
    const result = await getShows(page, "all", 500);
    if (result.error) return { shows: [], episodes: [], error: result.error };
    shows.push(...result.entries);
    if (shows.length >= result.total || !result.entries.length) break;
  }
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("tv_episode_tracking").select("*").eq("user_id", user.id)
      .order("tmdb_show_id").order("season_number").order("episode_number").range(offset, offset + 499);
    if (error) {
      console.error("TV statistics lookup failed:", error.code);
      return { shows: [], episodes: [], error: unavailable };
    }
    episodes.push(...data as EpisodeTracking[]);
    if (data.length < 500) break;
  }
  return { shows, episodes, error: null };
});
export const getSeasonTracking = cache(async (id:number,season:number) => {
  const user=await currentUser(); if(!user)return {entries:[] as EpisodeTracking[],error:null};
  const client=await createClient(); const entries:EpisodeTracking[]=[];
  for(let offset=0;offset<100000;offset+=500){
    const {data,error}=await client.from("tv_episode_tracking").select("*").eq("user_id",user.id).eq("tmdb_show_id",id).eq("season_number",season).order("episode_number").range(offset,offset+499);
    if(error){console.error("Episode tracking read failed:",error.code);return {entries:[] as EpisodeTracking[],error:unavailable};}
    entries.push(...data as EpisodeTracking[]);if(data.length<500)break;
  }
  return {entries,error:null};
});
export const getWatchedEpisodes = cache(async (id:number) => {
  const user=await currentUser();if(!user)return {episodes:[] as WatchedEpisode[],error:null};
  const client=await createClient();const episodes:WatchedEpisode[]=[];
  for(let offset=0;offset<100000;offset+=500){
    const {data,error}=await client.from("tv_episode_tracking").select("season_number,episode_number").eq("user_id",user.id).eq("tmdb_show_id",id).eq("watched",true).order("season_number").order("episode_number").range(offset,offset+499);
    if(error){console.error("Episode progress read failed:",error.code);return {episodes:[] as WatchedEpisode[],error:unavailable};}
    episodes.push(...data);if(data.length<500)break;
  }
  return {episodes,error:null};
});
export type TrackingStats = { movies: {tracked:number;watchlist:number;watched:number;rated:number;average_rating:number|null}; tv:{tracked:number;watching:number;completed:number;rated:number;average_rating:number|null}; episodes_watched:number };
export const getTrackingStats=cache(async()=>{
  const user=await currentUser();if(!user)return {stats:null,error:null};
  const client=await createClient();const {data,error}=await client.rpc("media_tracking_stats");
  if(error){console.error("Tracking statistics failed:",error.code);return {stats:null,error:unavailable};}
  return {stats:data as TrackingStats,error:null};
});
