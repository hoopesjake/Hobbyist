import type { SessionEpisode } from "./calendar-domain";

export const validActivityRating = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0.5 && value <= 5 && Number.isInteger(value * 2);

export function parseActivityDetails(form: FormData, actual: boolean, mediaType: string | null) {
  const raw = String(form.get("rating") || "");
  const rating = raw ? Number(raw) : null;
  const changed = form.get("rating_changed") === "on";
  const review = form.get("review_changed") === "on" ? String(form.get("review") || "").trim() : null;
  if (rating !== null && !validActivityRating(rating)) return { error: "Choose a half-star rating from 0.5 to 5." } as const;
  if ((changed || review !== null) && (!actual || !mediaType)) return { error: "Ratings and reviews need a logged library activity." } as const;
  if (review !== null && [...review].length > 10000) return { error: "Reviews can contain up to 10,000 characters." } as const;
  let episodes: SessionEpisode[] | null = null;
  if (form.has("episodes")) {
    try {
      const value: unknown = JSON.parse(String(form.get("episodes")));
      if (!Array.isArray(value) || value.length > 100 || (value.length && (!actual || mediaType !== "tv"))) throw Error();
      const seen = new Set<string>();
      episodes = value.map(item => {
        if (!item || !Number.isInteger(item.season_number) || item.season_number < 0 || item.season_number > 99999 || !Number.isInteger(item.episode_number) || item.episode_number < 1 || item.episode_number > 99999 || !Number.isInteger(item.tmdb_episode_id) || item.tmdb_episode_id < 1 || item.tmdb_episode_id > 2147483647 || (item.rating != null && !validActivityRating(item.rating))) throw Error();
        const key = `${item.season_number}:${item.episode_number}`;
        if (seen.has(key)) throw Error();
        seen.add(key);
        return { season_number: item.season_number, episode_number: item.episode_number, tmdb_episode_id: item.tmdb_episode_id, name: String(item.name || "").slice(0, 200), rating: item.rating ?? null, rating_changed: item.rating_changed === true, update_current: item.update_current === true };
      });
    } catch { return { error: "Choose up to 100 distinct episodes with valid ratings." } as const; }
  }
  return { rating, changed, updateCurrent: form.get("update_current") === "on", review, spoilers: form.get("contains_spoilers") === "on", episodes } as const;
}
