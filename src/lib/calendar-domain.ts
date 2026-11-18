export const calendarCategories = ["movies", "tv", "games", "books", "music", "lego", "projects", "other"] as const;
export type CalendarCategory = typeof calendarCategories[number];
export const categoryLabels: Record<CalendarCategory, string> = { movies: "Movies", tv: "TV Shows", games: "Games", books: "Books", music: "Music", lego: "LEGO", projects: "Projects", other: "Other" };
export const planStatuses = ["planned", "changed", "completed", "skipped", "canceled"] as const;
export type PlanStatus = typeof planStatuses[number];
export type CalendarView = "month" | "week" | "day" | "agenda";
export type CalendarEntry = {
  id: string; user_id: string; kind: "plan" | "actual"; status: PlanStatus | null;
  plan_id: string | null; title: string; category: CalendarCategory; event_date: string;
  start_time: string | null; end_date: string | null; end_time: string | null;
  time_zone: string; starts_at: string | null; ends_at: string | null;
  duration_minutes: number | null; approximate: boolean; notes: string; participants: string;
  privacy: "private"; media_type: "movie" | "tv" | "game" | "book" | null;
  provider: "tmdb" | "igdb" | "openlibrary" | null; provider_id: number | null; media_title: string | null;
  season_number: number | null; episode_number: number | null; created_at: string; updated_at: string;
  media_image?: string | null; library_add?: boolean;
  reading_start_page?: number | null; reading_end_page?: number | null; reading_edition_id?: string | null; pages_read?: number | null;
  session_rating?: number | null; episodes?: SessionEpisode[]; source_key?: string | null;
};
export type SessionEpisode = { season_number: number; episode_number: number; tmdb_episode_id: number; name?: string; rating?: number | null; rating_changed?: boolean; update_current?: boolean };
export type LibraryOption = { key: string; title: string; media_type: "movie" | "tv" | "game" | "book"; provider_id: number; image_url?: string | null; year?: string; in_library?: boolean };
export const calendarId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function validCalendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "1900-01-01" && value <= "2199-12-31" && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export function validTimeZone(value: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return value.length <= 100 && /^[A-Za-z][A-Za-z0-9_+./-]*$/.test(value); } catch { return false; }
}
export function dateInZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  return ["year", "month", "day"].map(key => parts.find(part => part.type === key)!.value).join("-");
}
export function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10);
}
export function shiftCalendarMonth(date: string, months: number): string {
  const value = new Date(`${date.slice(0, 7)}-01T12:00:00Z`); value.setUTCMonth(value.getUTCMonth() + months);
  const last = new Date(value); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
  value.setUTCDate(Math.min(Number(date.slice(8)), last.getUTCDate())); return value.toISOString().slice(0, 10);
}
export function calendarRange(view: CalendarView, date: string) {
  let start = date;
  if (view === "month" || view === "agenda") start = `${date.slice(0, 7)}-01`;
  if (view === "month" || view === "week") start = addCalendarDays(start, -(new Date(`${start}T12:00:00Z`).getUTCDay()));
  const end = view === "month" ? addCalendarDays(start, 42) : view === "week" ? addCalendarDays(start, 7) : view === "agenda" ? shiftCalendarMonth(start, 1) : addCalendarDays(start, 1);
  return { start, end };
}
export function entryOnDate(entry: CalendarEntry, date: string): boolean {
  const end = entry.end_date || entry.event_date;
  return entry.event_date <= date && date <= end && !(date === entry.end_date && date !== entry.event_date && entry.end_time?.slice(0, 5) === "00:00");
}
export function actualMinutes(entries: CalendarEntry[]): number {
  return entries.filter(entry => entry.kind === "actual").reduce((total, entry) => total + (entry.duration_minutes || 0), 0);
}
export function mediaHref(entry: Pick<CalendarEntry, "media_type" | "provider_id" | "season_number" | "episode_number">) {
  if (!entry.media_type || !entry.provider_id) return null;
  const root = entry.media_type === "movie" ? "/movies" : entry.media_type === "tv" ? "/tv" : entry.media_type === "book" ? "/books" : "/games";
  if (entry.media_type === "book") return `/books/OL${entry.provider_id}W`;
  return entry.media_type === "tv" && entry.season_number !== null && entry.episode_number !== null
    ? `${root}/${entry.provider_id}/season/${entry.season_number}/episode/${entry.episode_number}`
    : `${root}/${entry.provider_id}${entry.media_type === "tv" && entry.season_number !== null ? `?season=${entry.season_number}#seasons` : ""}`;
}
export function calendarTime(time: string | null): string {
  if (!time) return "Date only";
  const hour = Number(time.slice(0, 2)), minute = time.slice(3, 5);
  return `${hour % 12 || 12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
}
export function durationLabel(minutes: number | null): string {
  if (minutes === null) return "Duration not recorded";
  return `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h` : ""}${minutes % 60 ? ` ${minutes % 60}m` : ""}`.trim();
}

function wallTime(instant: number, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
  const part = (key: string) => parts.find(value => value.type === key)!.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
// Resolve a wall clock without silently normalizing DST gaps. Return both
// occurrences of a repeated time so the caller can explicitly choose one.
export function possibleInstants(date: string, time: string, zone: string): number[] {
  const naive = Date.parse(`${date}T${time}:00Z`), offsets = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const sample = naive + hours * 3600000;
    offsets.add(Date.parse(`${wallTime(sample, zone)}:00Z`) - sample);
  }
  return [...offsets].map(offset => naive - offset).filter(value => wallTime(value, zone) === `${date}T${time}`).sort((a, b) => a - b);
}

export function parseCalendarEntry(form: FormData, now = new Date()) {
  const text = (key: string) => String(form.get(key) || "").trim();
  const id = text("id"), kind = text("kind"), category = text("category") as CalendarCategory;
  if (!calendarId(id) || !["plan", "actual"].includes(kind)) return { error: "Invalid activity identity." } as const;
  const title = text("title"), notes = text("notes"), participants = text("participants");
  if (!title || [...title].length > 200) return { error: "Add a title of up to 200 characters." } as const;
  if ([...notes].length > 10000 || [...participants].length > 500) return { error: "Use up to 10,000 characters for notes and 500 for participants." } as const;
  if (!calendarCategories.includes(category)) return { error: "Choose a valid category." } as const;
  if (text("privacy") && text("privacy") !== "private") return { error: "Calendar entries and memories must stay private." } as const;
  const event_date = text("event_date"), rawZone = text("time_zone");
  if (!validCalendarDate(event_date) || !validTimeZone(rawZone)) return { error: "Choose a valid date (1900–2199) and time zone." } as const;
  const time_zone = new Intl.DateTimeFormat("en-US", { timeZone: rawZone }).resolvedOptions().timeZone;
  const start_time = text("start_time") || null, end_time = text("end_time") || null;
  if ([start_time, end_time].some(time => time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return { error: "Choose valid times." } as const;
  const end_date = end_time ? text("end_date") || event_date : null;
  if (end_time && (!start_time || !end_date || !validCalendarDate(end_date) || end_date < event_date)) return { error: "An end time needs a start time and a valid end date." } as const;
  let starts_at: string | null = null, ends_at: string | null = null;
  for (const [label, date, time, choice] of [["Start", event_date, start_time, text("start_occurrence")], ["End", end_date, end_time, text("end_occurrence")]]) {
    if (!time || !date) continue;
    const candidates = possibleInstants(date, time, time_zone);
    if (!candidates.length) return { error: `${label} time does not exist because the clocks change. Choose another time.` } as const;
    if (candidates.length > 1 && !["earlier", "later"].includes(choice || "")) return { error: `${label} time occurs twice because the clocks change. Choose the first or second occurrence in Timing.` } as const;
    const instant = new Date(candidates[choice === "later" ? candidates.length - 1 : 0]).toISOString();
    if (label === "Start") starts_at = instant; else ends_at = instant;
  }
  const rawDuration = text("duration_minutes");
  let duration_minutes = rawDuration ? Number(rawDuration) : null;
  if (ends_at && starts_at) duration_minutes = (Date.parse(ends_at) - Date.parse(starts_at)) / 60000;
  if (duration_minutes !== null && (!Number.isInteger(duration_minutes) || duration_minutes < 1 || duration_minutes > 10080)) return { error: "Duration must be between 1 minute and 7 days; the end must follow the start." } as const;
  if (kind === "actual" && (event_date > dateInZone(now, time_zone) || (starts_at && Date.parse(starts_at) > now.getTime()) || (ends_at && Date.parse(ends_at) > now.getTime()))) return { error: "Actual activities cannot be in the future. Create a plan instead." } as const;
  const status = kind === "plan" ? (text("status") || "planned") as PlanStatus : null;
  if (status && !planStatuses.includes(status)) return { error: "Choose a valid plan status." } as const;
  const plan_id = text("plan_id") || null;
  if (plan_id && (kind !== "actual" || !calendarId(plan_id) || plan_id === id)) return { error: "Invalid linked plan." } as const;
  const media = text("media");
  const match = media ? /^(movie|tv|game|book):([1-9]\d{0,9})$/.exec(media) : null;
  if (media && (!match || Number(match[2]) > 2147483647)) return { error: "Choose a valid library item." } as const;
  const media_type = match ? match[1] as "movie" | "tv" | "game" | "book" : null;
  if (media_type && ({ movie: "movies", tv: "tv", game: "games", book: "books" })[media_type] !== category) return { error: "The linked item must match the activity category." } as const;
  const season = text("season_number"), episode = text("episode_number");
  if ((season || episode) && (media_type !== "tv" || !/^\d{1,5}$/.test(season) || (episode && (!/^[1-9]\d{0,4}$/.test(episode))))) return { error: "TV episodes need a linked show, a season (including 0 for specials), and a valid episode number." } as const;
  const media_title = media_type ? text("media_title").slice(0, 500) || `${media_type === "game" ? "Game" : media_type === "tv" ? "TV show" : "Movie"} #${match![2]}` : null;
  return { entry: {
    id, kind: kind as "plan" | "actual", status, plan_id, title, category, event_date, start_time, end_date, end_time, time_zone,
    starts_at, ends_at, duration_minutes, approximate: duration_minutes !== null && !ends_at && text("approximate") === "on",
    notes, participants, privacy: "private" as const, media_type, provider: media_type ? media_type === "game" ? "igdb" as const : media_type === "book" ? "openlibrary" as const : "tmdb" as const : null,
    provider_id: match ? Number(match[2]) : null, media_title,
    season_number: season ? Number(season) : null, episode_number: episode ? Number(episode) : null,
  } } as const;
}
