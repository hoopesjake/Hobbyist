import "server-only";
import { cache } from "react";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
export type ActorFollow = { tmdb_person_id: number; name: string; profile_path: string | null; created_at: string };
const libraryUnavailable = "Your followed actors are temporarily unavailable. Please try again later.";
export const getFollows = cache(async (page = 1) => {
  const user = await currentUser();
  if (!user) return { actors: [] as ActorFollow[], total: 0, error: null };
  const supabase = await createClient();
  const { data, count, error } = await supabase.from("actor_follows").select("tmdb_person_id,name,profile_path,created_at", { count: "exact" }).eq("user_id", user.id).order("created_at", { ascending: false }).order("tmdb_person_id").range((page - 1) * 24, page * 24 - 1);
  if (error) { console.error("Actor follows read failed:", error.code); return { actors: [] as ActorFollow[], total: 0, error: libraryUnavailable }; }
  return { actors: data as ActorFollow[], total: count || 0, error: null };
});
export const getActorFollow = cache(async (id: number) => {
  const user = await currentUser();
  if (!user) return { following: false, error: null };
  const supabase = await createClient();
  const { data, error } = await supabase.from("actor_follows").select("tmdb_person_id").eq("user_id", user.id).eq("tmdb_person_id", id).maybeSingle();
  if (error) { console.error("Actor follow read failed:", error.code); return { following: false, error: libraryUnavailable }; }
  return { following: !!data, error: null };
});
