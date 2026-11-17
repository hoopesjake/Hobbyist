import "server-only";
import { activityArtwork } from "@/lib/activity-artwork";
import { cache } from "react";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dateInZone, type CalendarEntry } from "@/lib/calendar-domain";

export type ActivityMediaType = "movie" | "tv" | "game" | "book";
export function activityEntryHref(entry: CalendarEntry) {
  return `/calendar?${new URLSearchParams({ view: "agenda", date: entry.event_date, tz: entry.time_zone, entry: entry.id })}`;
}
export function activityCreateHref(type: ActivityMediaType, id: number, kind: "plan" | "actual", season?: number, episode?: number) {
  return `/calendar?${new URLSearchParams({ create: kind, media: `${type}:${id}`, ...(season !== undefined ? { season: String(season) } : {}), ...(episode !== undefined ? { episode: String(episode) } : {}) })}`;
}
export const getMediaActivity = cache(async (type: ActivityMediaType, id: number) => {
  const user = await currentUser();
  if (!user) return { entries: [] as CalendarEntry[], error: null };
  const client = await createClient();
  const entries: CalendarEntry[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("calendar_entries").select("*").eq("user_id", user.id).eq("media_type", type).eq("provider_id", id).order("event_date", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) return { entries: [], error: "Your activity history could not be loaded." };
    entries.push(...data as CalendarEntry[]);
    if (data.length < 500) break;
  }
  return { entries: await activityArtwork(entries), error: null };
});

// One owner-scoped query per library page, not one query per card.
export async function getLibraryPlans(type: ActivityMediaType, ids: number[]) {
  const user = await currentUser();
  const entries: CalendarEntry[] = [];
  if (!user || !ids.length) return entries;
  const client = await createClient();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("calendar_entries").select("*").eq("user_id", user.id).eq("media_type", type).in("provider_id", ids).eq("kind", "plan").in("status", ["planned", "changed"]).gte("event_date", dateInZone(new Date(), "America/Denver")).order("event_date").order("start_time", { nullsFirst: false }).order("id").range(offset, offset + 499);
    if (error) return entries;
    entries.push(...data as CalendarEntry[]);
    if (data.length < 500) return entries;
  }
}
