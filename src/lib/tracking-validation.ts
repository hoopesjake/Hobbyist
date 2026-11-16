export const showStatuses = ["planned", "watching", "watched", "paused", "dropped", "completed"] as const;
export type ShowStatus = typeof showStatuses[number];
export const showStatusLabels: Record<ShowStatus, string> = { planned: "Planned", watching: "Currently watching", watched: "Watched", paused: "Paused", dropped: "Dropped", completed: "Completed" };
export function episodeIndex(value: unknown, allowZero = false): number | null {
  const text = String(value ?? "");
  if (!/^(0|[1-9]\d{0,4})$/.test(text)) return null;
  const number = Number(text);
  return number >= (allowZero ? 0 : 1) && number <= 99999 ? number : null;
}
function dateValid(value: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function parseTracking(kind: "movie" | "show" | "episode", form: FormData, today = new Date().toISOString().slice(0, 10)) {
  const raw = String(form.get("rating") || "").trim();
  const rating = raw ? Number(raw) : null;
  const review = String(form.get("review") || "").trim();
  const contains_spoilers = form.get("contains_spoilers") === "on";
  if (rating !== null && (!Number.isFinite(rating) || rating < 0.5 || rating > 5 || !Number.isInteger(rating * 2))) return { error: "Choose a rating from 0.5 to 5 in half-star steps." } as const;
  if (review.length > 10000) return { error: "Keep your review within 10,000 characters." } as const;
  const personal = { rating, review, contains_spoilers };
  const reviewed = rating !== null || review.length > 0;
  const started_on = String(form.get("started_on") || "");
  const completed_on = String(form.get("completed_on") || "");
  const watched_on = String(form.get("watched_on") || "");
  const relevant = kind === "show" ? [started_on, completed_on] : [watched_on];
  if (relevant.some(value => value && !dateValid(value, today))) return { error: "Choose a valid date that is not in the future." } as const;
  if (kind === "show") {
    const status = String(form.get("status") || "planned");
    if (!showStatuses.includes(status as ShowStatus)) return { error: "Choose a valid show status." } as const;
    if (started_on && completed_on && completed_on < started_on) return { error: "Completion cannot be before the start date." } as const;
    return { show: { ...personal, status: (reviewed && status !== "completed" ? "watched" : status) as ShowStatus, started_on: started_on || null, completed_on: completed_on || null } } as const;
  }
  const watched = reviewed || form.get("watched") === "on";
  if (watched_on && !watched) return { error: "Mark this as watched to record its watch date." } as const;
  const viewing = { ...personal, watched, watched_on: watched_on || null };
  return kind === "movie" ? { movie: { ...viewing, on_watchlist: form.get("on_watchlist") === "on" } } as const : { episode: viewing } as const;
}
export type SeasonSummary = { season_number: number; episode_count: number };
export type WatchedEpisode = { season_number: number; episode_number: number };
export function showProgress(seasons: SeasonSummary[], watched: WatchedEpisode[]) {
  const main = seasons.filter(season => season.season_number > 0);
  const known = new Map(main.map(season => [season.season_number, season.episode_count]));
  const unique = new Set(watched.filter(episode => episode.episode_number > 0 && episode.episode_number <= (known.get(episode.season_number) || 0)).map(episode => `${episode.season_number}:${episode.episode_number}`));
  const total = main.reduce((sum, season) => sum + season.episode_count, 0);
  const count = Math.min(total, unique.size);
  return { watched: count, total, percentage: total ? Math.round(count / total * 100) : 0 };
}
