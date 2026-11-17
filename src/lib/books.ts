import "server-only";
import { cache } from "react";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ReadingStatus } from "./book-validation";
import type { ReadingSession } from "./book-statistics";
export type BookTracking = { started_on: string | null; finished_on: string | null; effective_started_on: string | null; effective_finished_on: string | null; ol_work_id: number; work_key: string; title: string; authors: string[]; cover_url: string | null; edition_id: string | null; status: ReadingStatus; status_explicit: boolean; effective_status: ReadingStatus; total_pages: number | null; manual_current_page: number; current_page: number; rating: number | null; review: string; contains_spoilers: boolean; private_notes: string; updated_at: string };
const unavailable = "Your reading library could not be loaded. Please try again.";
export const getBookHistory = cache(async () => {
  const user = await currentUser();
  const entries: BookTracking[] = [], sessions: ReadingSession[] = [];
  if (!user) return { entries, sessions, error: null };
  const client = await createClient();
  for (let offset=0;;offset+=500) {
    const {data,error}=await client.from("book_library").select("*").eq("user_id",user.id).order("ol_work_id").range(offset,offset+499);
    if(error)return {entries:[],sessions:[],error:unavailable};
    entries.push(...data as BookTracking[]);if(data.length<500)break;
  }
  for (let offset=0;;offset+=500) {
    const {data,error}=await client.from("calendar_entries").select("id,kind,event_date,provider_id,reading_edition_id,reading_start_page,reading_end_page,duration_minutes").eq("user_id",user.id).eq("media_type","book").eq("kind","actual").order("id").range(offset,offset+499);
    if(error)return {entries:[],sessions:[],error:"Your reading activity could not be loaded. Please try again."};
    sessions.push(...data as ReadingSession[]);if(data.length<500)break;
  }
  return {entries,sessions,error:null};
});
export const getBookTracking = cache(async (id: number) => {
  const user = await currentUser(); if (!user) return { entry: null as BookTracking | null, error: null };
  const client = await createClient();
  const { data, error } = await client.from("book_library").select("*").eq("user_id", user.id).eq("ol_work_id", id).maybeSingle();
  return { entry: data as BookTracking | null, error: error ? unavailable : null };
});
export const getBookLibrary = cache(async (filter = "all", page = 1) => {
  const user = await currentUser(); if (!user) return { entries: [] as BookTracking[], total: 0, error: null };
  const client = await createClient();
  let query = client.from("book_library").select("*", { count: "exact" }).eq("user_id", user.id);
  if (["want_to_read", "reading", "finished"].includes(filter)) query = query.eq("effective_status", filter);
  const safePage = Math.max(1, Math.min(10000, Math.floor(page) || 1));
  const { data, count, error } = await query.order("updated_at", { ascending: false }).order("ol_work_id").range((safePage - 1) * 20, safePage * 20 - 1);
  return { entries: (data || []) as BookTracking[], total: count || 0, error: error ? unavailable : null };
});
