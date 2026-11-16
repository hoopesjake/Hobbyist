export type MediaType = "movie" | "tv";
export const viewingStatuses = ["watchlist", "watching", "completed", "paused", "dropped"] as const;
export type ViewingStatus = typeof viewingStatuses[number];
export const statusLabels: Record<ViewingStatus, string> = { watchlist: "Watchlist", watching: "Watching", completed: "Completed", paused: "Paused", dropped: "Dropped" };
export function validId(value: unknown): number | null {
  const text = String(value ?? "");
  if (!/^[1-9]\d{0,9}$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number <= 2147483647 ? number : null;
}
export function isMediaType(value: unknown): value is MediaType { return value === "movie" || value === "tv"; }
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function parseViewing(form: FormData, today = new Date().toISOString().slice(0, 10)) {
  const status = String(form.get("status") || "");
  if (!viewingStatuses.includes(status as ViewingStatus)) return { error: "Choose a valid viewing status." } as const;
  const raw = String(form.get("rating") || "").trim();
  const rating = raw === "" ? null : Number(raw);
  if (rating !== null && (!Number.isFinite(rating) || rating < 0.5 || rating > 5 || !Number.isInteger(rating * 2))) return { error: "Rate from 0.5 to 5 stars in half-star steps, or leave it blank." } as const;
  const started_on = String(form.get("started_on") || "");
  const watched_on = String(form.get("watched_on") || "");
  for (const value of [started_on, watched_on]) {
    if (value && (!validDate(value) || value > today)) return { error: "Use a valid watch date that is not in the future." } as const;
  }
  if (started_on && watched_on && started_on > watched_on) return { error: "The watched date must be on or after the start date." } as const;
  return { value: { status: status as ViewingStatus, rating, started_on: started_on || null, watched_on: watched_on || null } } as const;
}
