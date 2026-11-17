import "server-only";
import { activityArtwork } from "@/lib/activity-artwork";
import { cache } from "react";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addCalendarDays, type CalendarEntry } from "@/lib/calendar-domain";

export const calendarUnavailable = "Your calendar could not be loaded. Please try again shortly.";
export const getCalendarEntries = cache(async (start: string, end: string) => {
  const user = await currentUser();
  if (!user) return { entries: [] as CalendarEntry[], error: "Sign in to open your calendar." };
  const client = await createClient();
  const entries: CalendarEntry[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("calendar_entries").select("*").eq("user_id", user.id)
      .lt("event_date", end).or(`end_date.gte.${start},and(end_date.is.null,event_date.gte.${start})`)
      .order("event_date").order("start_time", { nullsFirst: false }).order("id").range(offset, offset + 499);
    if (error) { console.error("Calendar lookup failed:", error.code); return { entries: [], error: calendarUnavailable }; }
    entries.push(...data as CalendarEntry[]);
    if (data.length < 500) break;
  }
  // Fetch linked records outside this window too, so opening a plan always finds
  // its existing log rather than offering to create a duplicate.
  const planIds = entries.filter(entry => entry.kind === "plan").map(entry => entry.id);
  for (let offset = 0; offset < planIds.length; offset += 100) {
    const { data, error } = await client.from("calendar_entries").select("*").eq("user_id", user.id).in("plan_id", planIds.slice(offset, offset + 100));
    if (error) return { entries: [], error: calendarUnavailable };
    entries.push(...data as CalendarEntry[]);
  }
  const parentIds = [...new Set(entries.flatMap(entry => entry.plan_id ? [entry.plan_id] : []))];
  for (let offset = 0; offset < parentIds.length; offset += 100) {
    const { data, error } = await client.from("calendar_entries").select("*").eq("user_id", user.id).in("id", parentIds.slice(offset, offset + 100));
    if (error) return { entries: [], error: calendarUnavailable };
    entries.push(...data as CalendarEntry[]);
  }
  return { entries: await activityArtwork([...new Map(entries.map(entry => [entry.id, entry])).values()]), error: null };
});

export const getCalendarPreview = cache(async (today: string) => {
  const user = await currentUser();
  if (!user) return { plans: [] as CalendarEntry[], memories: [] as CalendarEntry[], error: null };
  const client = await createClient();
  const [plans, memories] = await Promise.all([
    client.from("calendar_entries").select("*").eq("user_id", user.id).eq("kind", "plan").in("status", ["planned", "changed"])
      .gte("event_date", today).lt("event_date", addCalendarDays(today, 90)).order("event_date").order("start_time", { nullsFirst: false }).order("id").limit(6),
    client.from("calendar_entries").select("*").eq("user_id", user.id).eq("kind", "actual").order("event_date", { ascending: false }).order("updated_at", { ascending: false }).limit(3),
  ]);
  if (plans.error || memories.error) return { plans: [], memories: [], error: calendarUnavailable };
  return { plans: await activityArtwork(plans.data as CalendarEntry[]), memories: await activityArtwork(memories.data as CalendarEntry[]), error: null };
});
