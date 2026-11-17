export const gameStatuses = ["playing", "completed", "backlog", "paused", "dropped"] as const;
export type GameStatus = typeof gameStatuses[number];
export const gameStatusLabels: Record<GameStatus, string> = { playing: "Playing", completed: "Completed", backlog: "Backlog", paused: "Paused", dropped: "Dropped" };
export const gameFilters = ["all", ...gameStatuses, "wishlist", "to_be_played", "want_to_play_more", "favorites", "owned"] as const;
export function gameId(value: unknown) {
  const raw = String(value ?? "");
  return /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) <= 2147483647 ? Number(raw) : null;
}
function validDate(value: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function parseGame(form: FormData, today = new Date().toISOString().slice(0, 10)) {
  const status = String(form.get("status") || "");
  if (status && !gameStatuses.includes(status as GameStatus)) return { error: "Choose a valid game status." } as const;
  const ownership = String(form.get("ownership") || "");
  if (!["", "owned", "not_owned"].includes(ownership)) return { error: "Choose a valid ownership option." } as const;
  const rawPlatforms = form.getAll("platform_ids");
  if (rawPlatforms.length > 50 || rawPlatforms.some(value => !gameId(value))) return { error: "Choose valid platforms." } as const;
  const platform_ids = [...new Set(rawPlatforms.map(value => gameId(value)!))];
  const rawHours = String(form.get("hours") || "").trim();
  const hours = rawHours ? Number(rawHours) : null;
  if (hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 100000)) return { error: "Enter playtime between 0 and 100,000 hours." } as const;
  const rawProgress = String(form.get("progress") || "").trim();
  const progress = rawProgress ? Number(rawProgress) : null;
  if (progress !== null && (!Number.isFinite(progress) || progress < 0 || progress > 100 || Math.abs(progress * 100 - Math.round(progress * 100)) > 0.000001)) return { error: "Enter progress from 0 to 100%." } as const;
  const rawRating = String(form.get("rating") || "").trim();
  const rating = rawRating ? Number(rawRating) : null;
  if (rating !== null && (!Number.isFinite(rating) || rating < 0.5 || rating > 5 || !Number.isInteger(rating * 2))) return { error: "Choose a rating from 0.5 to 5 stars." } as const;
  const review = String(form.get("review") || "").trim();
  if ([...review].length > 10000) return { error: "Keep your review within 10,000 characters." } as const;
  const started_on = String(form.get("started_on") || "");
  const completed_on = String(form.get("completed_on") || "");
  const last_played_on = String(form.get("last_played_on") || "");
  if ([started_on, completed_on, last_played_on].some(value => value && !validDate(value, today))) return { error: "Choose valid dates that are not in the future." } as const;
  if (started_on && ((completed_on && completed_on < started_on) || (last_played_on && last_played_on < started_on))) return { error: "Completion and last played dates must follow the start date." } as const;
  return { game: { status: (status || null) as GameStatus | null, owned: ownership ? ownership === "owned" : null, platform_ids,
    manual_playtime_minutes: hours === null ? null : Math.round(hours * 60), progress, rating, review, contains_spoilers: form.get("contains_spoilers") === "on",
    started_on: started_on || null, completed_on: completed_on || null, last_played_on: last_played_on || null,
    wishlist: form.get("wishlist") === "on", to_be_played: form.get("to_be_played") === "on", want_to_play_more: form.get("want_to_play_more") === "on", favorite: form.get("favorite") === "on" } } as const;
}
export function gameSearchBody(query: string, page: number, genre?: number | null, platform?: number | null, filters: string[] = []) {
  const text = query.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200);
  const where = ["version_parent = null", ...filters];
  if (genre) { if (!gameId(genre)) throw new Error("Invalid genre"); where.push(`genres = (${genre})`); }
  if (platform) { if (!gameId(platform)) throw new Error("Invalid platform"); where.push(`platforms = (${platform})`); }
  const safePage = Math.max(1, Math.min(500, Number.isFinite(page) ? Math.floor(page) : 1));
  // Rank the same candidate pool before slicing pages, so results cannot shuffle
  // between pages. IGDB's search already supplies its closest matches first.
  return `${text ? `search ${JSON.stringify(text)};` : "sort rating_count desc;"} where ${where.join(" & ")}; limit ${text ? 500 : 21}; offset ${text ? 0 : (safePage - 1) * 20};`;
}
