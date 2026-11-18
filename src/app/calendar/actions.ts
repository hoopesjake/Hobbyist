"use server";
import { getBook, searchBooks } from "@/lib/open-library";
import { parseReadingPages } from "@/lib/book-validation";
import { parseActivityDetails } from "@/lib/activity-validation";
import { cleanActivityPhotos } from "@/lib/activity-photo-storage";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calendarId, parseCalendarEntry, type CalendarCategory, type CalendarEntry, type LibraryOption } from "@/lib/calendar-domain";
import { getTitle, getSeason, getEpisode, getCatalog, imageUrl, titleName } from "@/lib/tmdb";
import { getGame, getGameCards, gameImage, gameRelease, searchGames } from "@/lib/igdb";

export type CalendarActionState = { error?: string; message?: string; id?: string; updated_at?: string };
const saveError = "This activity could not be saved. Please try again.";
function refresh() { revalidatePath("/calendar"); revalidatePath("/"); for (const root of ["/movies", "/tv", "/games"]) revalidatePath(root, "layout"); }

export async function saveCalendarEntry(_: CalendarActionState, form: FormData): Promise<CalendarActionState> {
  const user = await currentUser();
  if (!user) return { error: "Sign in to save activities." };
  const parsed = parseCalendarEntry(form);
  if (parsed.error) return { error: parsed.error };
  const entry = { ...parsed.entry };
  const reading = parseReadingPages(form, entry.kind === "actual", entry.media_type === "book");
  if (reading.error) return { error: reading.error };
  let bookMetadata: { title: string; authors: string[] } | undefined;
  const details = { ...parseActivityDetails(form, entry.kind === "actual", entry.media_type) };
  if (details.error) return { error: details.error };
  const client = await createClient();
  const expected = String(form.get("updated_at") || "");
  let previous: CalendarEntry | null = null;
  let libraryAdd = !!entry.media_type && entry.kind === "actual" && !expected;
  let mediaImage: string | null | undefined;
  const proposedImage = String(form.get("media_image") || "");
  if (/^https:\/\/(image\.tmdb\.org\/t\/p\/w(342|500)\/[A-Za-z0-9_.-]+|images\.igdb\.com\/igdb\/image\/upload\/t_cover_big\/[A-Za-z0-9_-]+\.jpg)$/.test(proposedImage)) mediaImage = proposedImage;
  if (expected) {
    const { data: current, error } = await client.from("calendar_entries").select("*").eq("user_id", user.id).eq("id", entry.id).maybeSingle();
    if (error || !current) return { error: "This activity is unavailable. Refresh your calendar." };
    if (current.kind !== entry.kind || current.plan_id !== entry.plan_id) return { error: "The activity type and original plan cannot be changed." };
    previous = current as CalendarEntry;
    if (entry.kind === "actual" && (previous.media_type !== entry.media_type || previous.provider_id !== entry.provider_id)) libraryAdd = !!entry.media_type;
  }
  if (entry.media_type === "book") {
    const owned = await client.from("book_tracking").select("title,authors,cover_url").eq("user_id",user.id).eq("ol_work_id",entry.provider_id).maybeSingle();
    if (owned.error) return { error: "Your reading library could not be checked. Please try again." };
    if (!owned.data && (previous?.media_type !== "book" || previous.provider_id !== entry.provider_id)) {
      if (form.get("library_add") !== "on") return { error: "Choose a book from your library or add it from search." };
      try { const book = await getBook(entry.provider_id!); bookMetadata = {title:book.title.slice(0,500),authors:book.authors}; entry.media_title=book.title.slice(0,500); mediaImage=book.cover_url; libraryAdd=true; }
      catch { return { error: "This book could not be verified. Please try again." }; }
    } else if (owned.data) { bookMetadata={title:owned.data.title,authors:owned.data.authors}; mediaImage=owned.data.cover_url; }
  }
  if (entry.media_type && entry.media_type !== "book") {
    const table = entry.media_type === "movie" ? "movie_tracking" : entry.media_type === "tv" ? "tv_tracking" : "game_tracking";
    const column = entry.media_type === "game" ? "igdb_id" : "tmdb_id";
    const { data, error } = await client.from(table).select(column).eq("user_id", user.id).eq(column, entry.provider_id).maybeSingle();
    // Historical references remain editable even after an item is untracked.
    if (error) return { error: "Your library could not be checked. Please try again." };
    if (!data) {
      if (previous?.media_type !== entry.media_type || previous?.provider_id !== entry.provider_id) {
        if (form.get("library_add") !== "on") return { error: "Choose an item saved in your own library." };
        try {
          const details = entry.media_type === "game" ? await getGame(entry.provider_id!) : await getTitle(entry.media_type, entry.provider_id!);
          if (details.id !== entry.provider_id || ("adult" in details && details.adult)) return { error: "This hobby is unavailable." };
          entry.media_title = titleName(details);
          mediaImage = "cover" in details ? gameImage(details.cover?.image_id) : "poster_path" in details ? imageUrl(details.poster_path) : null;
          libraryAdd = true;
        } catch { return { error: "This hobby could not be verified. Try again before adding it to your library." }; }
      }
    }
    if (mediaImage === undefined && (!previous || previous.media_type !== entry.media_type || previous.provider_id !== entry.provider_id || !previous.media_image)) {
      try {
        if (entry.media_type === "game") mediaImage = gameImage((await getGameCards([entry.provider_id!]))[0]?.cover?.image_id);
        else mediaImage = imageUrl((await getTitle(entry.media_type, entry.provider_id!)).poster_path);
      } catch { /* Existing links remain editable during catalog outages. */ }
    }
  }
  if (entry.media_type === "tv" && entry.season_number !== null &&
      (!previous || previous.provider_id !== entry.provider_id || previous.season_number !== entry.season_number || previous.episode_number !== entry.episode_number)) {
    try {
      const details = entry.episode_number !== null
        ? await getEpisode(entry.provider_id!, entry.season_number, entry.episode_number)
        : await getSeason(entry.provider_id!, entry.season_number);
      if (details.season_number !== entry.season_number || (entry.episode_number !== null && (!("episode_number" in details) || details.episode_number !== entry.episode_number))) return { error: "Choose an existing season or episode of this show." };
    } catch { return { error: "This season or episode could not be verified. Try again or link the show without an episode." }; }
  }
  if (details.episodes?.length && entry.media_type === "tv") {
    const verified = await Promise.allSettled(details.episodes.map(async episode => {
      const old = previous?.provider_id === entry.provider_id && previous.episodes?.find(item => item.season_number === episode.season_number && item.episode_number === episode.episode_number && item.tmdb_episode_id === episode.tmdb_episode_id);
      if (old) return;
      // Saved episode identities work during provider outages; new links are verified.
      const { data } = await client.from("tv_episode_tracking").select("tmdb_episode_id").eq("user_id", user.id).eq("tmdb_show_id", entry.provider_id).eq("season_number", episode.season_number).eq("episode_number", episode.episode_number).maybeSingle();
      if (data?.tmdb_episode_id === episode.tmdb_episode_id) return;
      const metadata = await getEpisode(entry.provider_id!, episode.season_number, episode.episode_number);
      if (metadata.id !== episode.tmdb_episode_id || metadata.season_number !== episode.season_number || metadata.episode_number !== episode.episode_number) throw Error("Invalid episode");
    }));
    if (verified.some(result => result.status === "rejected")) return { error: "Some episodes could not be verified. Please try again." };
  }
  if (entry.plan_id && !expected) {
    const { data, error } = await client.from("calendar_entries").select("id").eq("id", entry.plan_id).eq("user_id", user.id).eq("kind", "plan").maybeSingle();
    if (error || !data) return { error: "The original plan is unavailable." };
  }
  const { id, kind, plan_id, ...baseFields } = entry;
  const fields = { ...baseFields,
    ...(libraryAdd ? { library_add: true } : previous?.library_add ? { library_add: false } : {}),
    ...(entry.media_type === null ? previous?.media_image ? { media_image: null } : {} : mediaImage !== undefined ? { media_image: mediaImage } : {}),
  };
  const photoWorkflow = form.get("photo_workflow") === "on";
  const result = await client.rpc(entry.media_type === "book" ? "save_reading_activity" : photoWorkflow ? "save_calendar_activity_with_version" : "save_calendar_activity", {
    p_entry: { id, kind, plan_id, ...fields, ...(entry.media_type === "book" ? reading : {}) }, p_expected: expected || null,
    p_rating: details.rating, p_rating_changed: details.changed, p_update_current: details.updateCurrent,
    p_review: details.review, p_spoilers: details.spoilers, p_episodes: details.episodes,
    ...(entry.media_type === "book" ? { p_book: bookMetadata || {} } : {}),
  });
  if (result.error) {
    console.error("Calendar save failed:", result.error.code);
    if (result.error.code === "40001") return { error: "This activity changed in another window. Refresh before editing again." };
    if (result.error.code === "23505") return { error: "This activity or linked log is already saved. Refresh and edit the existing record." };
    return { error: saveError };
  }
  if (!result.data) return { error: "This activity changed in another window. Refresh before editing again." };
  refresh();
  return { message: "Activity saved.", id, ...((photoWorkflow || entry.media_type === "book") && result.data?.updated_at ? { updated_at: String(result.data.updated_at) } : {}) };
}

// Dragging an event only ever changes when it happens, never what it is: every other field
// is mirrored from the entry unchanged and run back through the same validated save path
// (including its optimistic-concurrency check), so a reschedule can't silently drop data.
export async function rescheduleCalendarEntry(entry: CalendarEntry, changes: { event_date?: string; start_time?: string | null }): Promise<CalendarActionState> {
  const form = new FormData();
  const set = (key: string, value: string | number | null | undefined) => form.set(key, value === null || value === undefined ? "" : String(value));
  set("id", entry.id); set("updated_at", entry.updated_at); set("plan_id", entry.plan_id); set("privacy", "private");
  set("kind", entry.kind); set("title", entry.title); set("category", entry.category); set("time_zone", entry.time_zone);
  const nextDate = changes.event_date ?? entry.event_date;
  const nextStart = changes.start_time !== undefined ? changes.start_time : entry.start_time?.slice(0, 5) ?? null;
  set("event_date", nextDate); set("start_time", nextStart);
  // A multi-day span (end_date differs from event_date) shifts by the same delta as the start.
  if (entry.end_date && entry.end_date !== entry.event_date) {
    const deltaDays = Math.round((Date.parse(`${nextDate}T00:00:00Z`) - Date.parse(`${entry.event_date}T00:00:00Z`)) / 86400000);
    set("end_date", new Date(Date.parse(`${entry.end_date}T00:00:00Z`) + deltaDays * 86400000).toISOString().slice(0, 10));
  } else set("end_date", changes.event_date ? nextDate : entry.end_date);
  set("end_time", entry.end_time?.slice(0, 5) ?? null);
  if (entry.duration_minutes != null) set("duration_minutes", entry.duration_minutes);
  if (entry.approximate) form.set("approximate", "on");
  set("participants", entry.participants); set("notes", entry.notes);
  if (entry.media_type && entry.provider_id) { form.set("media", `${entry.media_type}:${entry.provider_id}`); set("media_image", entry.media_image ?? null); set("media_title", entry.media_title); }
  if (entry.season_number !== null) set("season_number", entry.season_number);
  if (entry.episode_number !== null) set("episode_number", entry.episode_number);
  if (entry.kind === "plan") set("status", entry.status || "planned");
  if (entry.episodes?.length) form.set("episodes", JSON.stringify(entry.episodes));
  return saveCalendarEntry({}, form);
}
export async function deleteCalendarEntry(_: CalendarActionState, form: FormData): Promise<CalendarActionState> {
  const user = await currentUser(), id = form.get("id");
  if (!user) return { error: "Sign in to manage activities." };
  if (!calendarId(id)) return { error: "Invalid activity." };
  const expected = String(form.get("updated_at") || "");
  if (!expected) return { error: "Refresh before deleting this activity." };
  const client = await createClient();
  const { data, error } = await client.from("calendar_entries").delete().eq("id", id).eq("user_id", user.id).eq("updated_at", expected).select("id").maybeSingle();
  if (error || !data) return { error: "This activity changed or could not be deleted. Refresh and try again." };
  try { await cleanActivityPhotos(client, user.id); } catch { /* Durable cleanup remains queued for retry. */ }
  refresh(); return { message: "Activity deleted.", id };
}

export async function loadCalendarEntry(id: string): Promise<{ entry: CalendarEntry | null; error: string | null }> {
  const user = await currentUser();
  if (!user || !calendarId(id)) return { entry: null, error: "This activity is unavailable." };
  const client = await createClient();
  const { data, error } = await client.from("calendar_entries").select("*").eq("user_id", user.id).eq("id", id).maybeSingle();
  return { entry: data as CalendarEntry | null, error: error || !data ? "This activity could not be opened. Refresh your calendar." : null };
}

export async function loadCalendarLibrary(category: CalendarCategory | "all", page = 1): Promise<{ items: LibraryOption[]; hasMore: boolean; error?: string }> {
  if (category === "all") {
    const results = await Promise.all((["movies", "tv", "games", "books"] as const).map(kind => loadCalendarLibrary(kind, page)));
    return { items: results.flatMap(result => result.items), hasMore: results.some(result => result.hasMore),
      ...(results.some(result => result.error) ? { error: "Some library items could not be loaded. Please try again." } : {}) };
  }
  const user = await currentUser();
  if (!user) return { items: [], hasMore: false, error: "Sign in to link library items." };
  if (category === "books") {
    const client = await createClient();
    const safe = Math.max(1,Math.min(10000,Math.floor(page)||1));
    const {data,error} = await client.from("book_tracking").select("ol_work_id,title,cover_url").eq("user_id",user.id).order("updated_at",{ascending:false}).order("ol_work_id").range((safe-1)*24,safe*24);
    return { items: (data || []).slice(0,24).map(row => ({key:`book:${row.ol_work_id}`,title:row.title,media_type:"book" as const,provider_id:row.ol_work_id,image_url:row.cover_url,in_library:true})), hasMore:!!data && data.length>24, ...(error?{error:"Your reading library could not be loaded."}:{}) };
  }
  if (!["movies", "tv", "games"].includes(category)) return { items: [], hasMore: false };
  const safePage = Math.max(1, Math.min(10000, Math.floor(page) || 1));
  const type = category === "movies" ? "movie" : category === "games" ? "game" : "tv";
  const table = type === "movie" ? "movie_tracking" : type === "tv" ? "tv_tracking" : "game_tracking";
  const column = type === "game" ? "igdb_id" : "tmdb_id";
  const client = await createClient();
  const { data, error } = await client.from(table).select(column).eq("user_id", user.id).order("updated_at", { ascending: false }).order(column).range((safePage - 1) * 24, safePage * 24);
  if (error) return { items: [], hasMore: false, error: "Your library could not be loaded. Try again." };
  const ids = (data as unknown as Record<string, number>[]).slice(0, 24).map(item => item[column]);
  const names = new Map<number, string>();
  const images = new Map<number, string | null>();
  const { data: snapshots } = await client.from("calendar_entries").select("provider_id,media_title,media_image").eq("user_id", user.id).eq("media_type", type).in("provider_id", ids).order("updated_at", { ascending: false }).limit(500);
  for (const snapshot of snapshots || []) if (!names.has(snapshot.provider_id)) { names.set(snapshot.provider_id, snapshot.media_title); images.set(snapshot.provider_id, snapshot.media_image); }
  if (type === "game") {
    try { for (const game of await getGameCards(ids)) { names.set(game.id, game.name); images.set(game.id, gameImage(game.cover?.image_id)); } } catch { /* Provider IDs remain usable when the catalog is unavailable. */ }
  } else {
    const titles = await Promise.allSettled(ids.map(async id => ({ id, details: await getTitle(type, id) })));
    for (const title of titles) if (title.status === "fulfilled") { names.set(title.value.id, titleName(title.value.details)); images.set(title.value.id, imageUrl(title.value.details.poster_path)); }
  }
  return { items: ids.map(id => ({ key: `${type}:${id}`, title: names.get(id) || `${type === "game" ? "Game" : type === "tv" ? "TV show" : "Movie"} #${id}`, media_type: type, provider_id: id, image_url: images.get(id) || null, in_library: true })), hasMore: data.length > 24 };
}

export async function searchCalendarCatalog(query: string, type: "movie" | "tv" | "game" | "book", page = 1): Promise<{ items: LibraryOption[]; hasMore: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { items: [], hasMore: false, error: "Sign in to find a hobby." };
  if (typeof query !== "string" || !["movie", "tv", "game", "book"].includes(type)) return { items: [], hasMore: false, error: "Choose a supported hobby type." };
  const text = query.trim().slice(0, 200), safePage = Math.min(type === "game" ? 25 : 500, Math.max(1, Math.floor(page) || 1));
  if (text.length < 2) return { items: [], hasMore: false };
  try {
    let items: LibraryOption[], hasMore: boolean;
    if (type === "book") {
      const result = await searchBooks(text,safePage); items=result.books.map(book => ({key:`book:${book.id}`,title:book.title,media_type:"book",provider_id:book.id,image_url:book.cover_url,year:book.first_publish_year?String(book.first_publish_year):undefined})); hasMore=result.hasMore;
    } else if (type === "game") {
      const result = await searchGames(text, safePage);
      items = result.games.map(game => ({ key: `game:${game.id}`, title: game.name, media_type: "game", provider_id: game.id, image_url: gameImage(game.cover?.image_id), year: gameRelease(game.first_release_date)?.slice(0, 4) }));
      hasMore = result.hasNext;
    } else {
      const result = await getCatalog(text, type, safePage);
      items = result.results.filter(item => item.media_type !== "person").map(item => ({ key: `${type}:${item.id}`, title: titleName(item), media_type: type, provider_id: item.id, image_url: imageUrl("poster_path" in item ? item.poster_path : null), year: "release_date" in item ? item.release_date?.slice(0, 4) : "first_air_date" in item ? item.first_air_date?.slice(0, 4) : undefined }));
      hasMore = safePage < result.totalPages;
    }
    if (items.length) {
      const client = await createClient();
      const column = type === "game" ? "igdb_id" : type === "book" ? "ol_work_id" : "tmdb_id";
      const { data, error } = await client.from(type === "game" ? "game_tracking" : type === "movie" ? "movie_tracking" : type === "book" ? "book_tracking" : "tv_tracking").select(column).eq("user_id", user.id).in(column, items.map(item => item.provider_id));
      if (error) return { items: [], hasMore: false, error: "Your library could not be checked. Try again." };
      const owned = new Set((data as unknown as Record<string, number>[]).map(item => item[column]));
      items = items.map(item => ({ ...item, in_library: owned.has(item.provider_id) }));
    }
    return { items, hasMore };
  } catch { return { items: [], hasMore: false, error: "This catalog is temporarily unavailable. Try again shortly." }; }
}
