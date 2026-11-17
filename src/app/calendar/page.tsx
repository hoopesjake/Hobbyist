import { getBook } from "@/lib/open-library";
import { activityArtwork } from "@/lib/activity-artwork";
import { getTitle, getEpisode, titleName, imageUrl } from "@/lib/tmdb";
import { getGameCards, gameImage } from "@/lib/igdb";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCalendarEntries } from "@/lib/calendar";
import { addCalendarDays, calendarRange, dateInZone, shiftCalendarMonth, validCalendarDate, validTimeZone, calendarCategories, categoryLabels, type CalendarView } from "@/lib/calendar-domain";
import { CalendarClient } from "@/components/calendar/calendar-client";
import type { CalendarDraft } from "@/components/calendar/calendar-editor";
import { NavigationTabs } from "@/components/layout/navigation-tabs";
import { loadCalendarEntry } from "./actions";

export const metadata = { title: "Calendar & memory journal" };
type Params = { view?: string; date?: string; tz?: string; create?: string; entry?: string; media?: string; season?: string; episode?: string; q?: string; category?: string; history?: string };
export default async function CalendarPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  const params = await searchParams;
  const timeZone = typeof params.tz === "string" && validTimeZone(params.tz) ? params.tz : "America/Denver";
  const today = dateInZone(new Date(), timeZone);
  const date = typeof params.date === "string" && validCalendarDate(params.date) ? params.date : today;
  const view: CalendarView = ["month", "week", "day", "agenda"].includes(params.view || "") ? params.view as CalendarView : "month";
  const range = calendarRange(view, date);
  const fullHistory = view === "agenda" && (params.history === "all" || !!params.media || !!params.q || !!params.category);
  const result = await getCalendarEntries(fullHistory ? "1900-01-01" : range.start, fullHistory ? "2200-01-01" : range.end);
  const mediaMatch = typeof params.media === "string" ? /^(movie|tv|game|book):([1-9]\d{0,9})$/.exec(params.media) : null;
  const mediaId = mediaMatch && Number(mediaMatch[2]) <= 2147483647 ? Number(mediaMatch[2]) : null;
  const mediaType = mediaMatch?.[1] as "movie" | "tv" | "game" | "book" | undefined;
  const opened = params.entry ? await loadCalendarEntry(params.entry) : null;
  if (opened?.entry) opened.entry = (await activityArtwork([opened.entry]))[0];
  let initialDraft: CalendarDraft | undefined;
  if (params.create === "plan" || params.create === "actual") initialDraft = { id: crypto.randomUUID(), kind: params.create, event_date: date, time_zone: timeZone };
  let seedError: string | null = null;
  if (initialDraft && mediaId && mediaType) {
    const client = await createClient();
    const table = mediaType === "game" ? "game_tracking" : mediaType === "tv" ? "tv_tracking" : mediaType === "book" ? "book_tracking" : "movie_tracking";
    const { data: owned } = await client.from(table).select(mediaType === "game" ? "igdb_id" : mediaType === "book" ? "ol_work_id" : "tmdb_id").eq("user_id", user.id).eq(mediaType === "game" ? "igdb_id" : mediaType === "book" ? "ol_work_id" : "tmdb_id", mediaId).maybeSingle();
    try {
      let name = `${mediaType === "game" ? "Game" : mediaType === "tv" ? "TV show" : "Movie"} #${mediaId}`;
      let image: string | null = null;
      try {
        if (mediaType === "book") { const book = await getBook(mediaId); name = book.title; image = book.cover_url; }
        else if (mediaType === "game") { const game = (await getGameCards([mediaId]))[0]; if (!game) throw Error(); name = game.name; image = gameImage(game.cover?.image_id); }
        else { const details = await getTitle(mediaType, mediaId); name = titleName(details); image = imageUrl(details.poster_path); }
      } catch { if (!owned) throw Error(); }
      initialDraft = { ...initialDraft, media_type: mediaType, provider: mediaType === "game" ? "igdb" : mediaType === "book" ? "openlibrary" : "tmdb", provider_id: mediaId, media_title: name, title: name, media_image: image, library_add: !owned, category: mediaType === "movie" ? "movies" : mediaType === "tv" ? "tv" : mediaType === "book" ? "books" : "games" };
      if (mediaType === "tv" && /^\d{1,5}$/.test(params.season || "") && /^[1-9]\d{0,4}$/.test(params.episode || "")) {
        const e = await getEpisode(mediaId, Number(params.season), Number(params.episode));
        initialDraft.season_number = e.season_number; initialDraft.episode_number = e.episode_number;
        if (initialDraft.kind === "actual") initialDraft.episodes = [{ season_number: e.season_number, episode_number: e.episode_number, tmdb_episode_id: e.id, name: e.name }];
      }
    } catch { seedError = "This hobby could not be loaded. Choose an item from your library below."; }
  }
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 200).toLowerCase() : "";
  const filtered = result.entries.filter(e => (!mediaId || (e.media_type === mediaType && e.provider_id === mediaId)) && (!params.category || e.category === params.category) && (!query || `${e.title} ${e.media_title || ""} ${e.notes} ${e.participants}`.toLowerCase().includes(query)));
  const mediaOptions = [...new Map(result.entries.filter(e => e.media_type && e.provider_id).map(e => [`${e.media_type}:${e.provider_id}`, { value: `${e.media_type}:${e.provider_id}`, label: `${e.media_title || e.title} (${e.media_type === "tv" ? "TV" : e.media_type})` }])).values()].sort((a, b) => a.label.localeCompare(b.label));
  const url = (nextView: CalendarView, nextDate: string, zone: string) => `/calendar?${new URLSearchParams({ view: nextView, date: nextDate, tz: zone })}`;
  const shift = (direction: number) => view === "month" || view === "agenda" ? shiftCalendarMonth(date, direction) : addCalendarDays(date, direction * (view === "week" ? 7 : 1));
  const heading = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric", ...(view === "day" ? { day: "numeric" } : {}) });
  return <div className="page-content calendar-page"><header className="welcome-row"><div><p className="eyebrow">TIME WELL SPENT</p><h1>Calendar & memories<span>.</span></h1><p className="welcome-copy">Make a plan. Keep a memory.</p></div><CalendarDays className="calendar-heading-icon" size={28}/></header>
    <div className="calendar-toolbar"><div className="calendar-period"><div className="calendar-period-arrows"><Link className="icon-button" href={url(view, shift(-1), timeZone)} aria-label="Previous period"><ChevronLeft size={19}/></Link><Link className="icon-button" href={url(view, shift(1), timeZone)} aria-label="Next period"><ChevronRight size={19}/></Link></div><h2>{fullHistory ? "Activity history" : heading}</h2><Link className="calendar-today-link" href={url(view, today, timeZone)}>Today</Link></div><form className="calendar-jump" action="/calendar"><input type="hidden" name="view" value={view}/><input type="hidden" name="tz" value={timeZone}/><label className="sr-only" htmlFor="calendar-jump-date">Jump to date</label><input id="calendar-jump-date" type="date" name="date" min="1900-01-01" max="2199-12-31" defaultValue={date} key={date} required/><button type="submit" className="calendar-secondary">Go</button></form></div>
    <NavigationTabs label="Calendar views" fallbackHref={url(view, date, timeZone)} tabs={(["month", "week", "day", "agenda"] as const).map(next => ({ href: url(next, date, timeZone), label: next === "agenda" ? "Agenda / Journal" : next.charAt(0).toUpperCase() + next.slice(1) }))}/>
    {view === "agenda" && <form className="calendar-journal-search" action="/calendar" role="search"><input type="hidden" name="view" value="agenda"/><input type="hidden" name="date" value={date}/><input type="hidden" name="tz" value={timeZone}/><input type="hidden" name="history" value="all"/><label className="sr-only" htmlFor="journal-query">Search memories</label><input id="journal-query" type="search" name="q" defaultValue={params.q || ""} placeholder="Search titles and memories..."/><label className="sr-only" htmlFor="journal-category">Category</label><select id="journal-category" name="category" defaultValue={params.category || ""}><option value="">All categories</option>{calendarCategories.map(category => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select><label className="sr-only" htmlFor="journal-media">Linked hobby</label><select id="journal-media" name="media" defaultValue={params.media || ""}><option value="">All hobbies</option>{mediaOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button className="calendar-secondary">Search journal</button><Link className="text-link" href={url("agenda", date, timeZone)}>Clear</Link></form>}
    {seedError && <p className="calendar-error" role="status">{seedError}</p>}
    {(result.error || opened?.error) && <div className="calendar-error" role="alert"><p>{result.error || opened?.error}</p><Link className="text-link" href={url(view, date, timeZone)}>Try again</Link></div>}
    {!result.error && <CalendarClient key={`${view}-${date}-${timeZone}-${params.entry || ""}-${params.create || ""}-${params.media || ""}` } entries={filtered} date={date} today={today} view={view} timeZone={timeZone} initialDraft={initialDraft} initialEntry={opened?.entry} allHistory={!!fullHistory}/>}
  </div>;
}
