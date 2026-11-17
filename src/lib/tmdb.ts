import "server-only";
import { cacheLife } from "next/cache";
import type { MediaType } from "@/lib/media-validation";
import { popularPeople, type DiscoveryPerson } from "@/lib/people-discovery";
export type CatalogKind = MediaType | "person" | "all";
export type Genre = { id: number; name: string };
export type CatalogItem = {
  id: number; media_type: "movie" | "tv" | "person"; title?: string; name?: string;
  overview?: string; poster_path?: string | null; profile_path?: string | null;
  release_date?: string; first_air_date?: string; genre_ids?: number[];
  vote_average?: number; vote_count?: number; adult?: boolean; character?: string;
  popularity?: number; known_for_department?: string;
  known_for_titles?: string[];
};
export type CastMember = DiscoveryPerson & { character: string };
export type TitleDetails = CatalogItem & {
  genres: Genre[]; tagline?: string; runtime?: number; number_of_seasons?: number;
  number_of_episodes?: number; seasons?: SeasonDetails[]; status?: string; credits: { cast: CastMember[]; crew?: (DiscoveryPerson & { job: string })[] };
};
export type PersonDetails = {
  id: number; name: string; biography: string; profile_path: string | null;
  birthday: string | null; deathday: string | null; place_of_birth: string | null;
  known_for_department: string; combined_credits: { cast: CatalogItem[]; crew?: (CatalogItem & { job: string })[] };
};
export class TmdbError extends Error {
  readonly status: number;
  constructor(message: string, status = 503) { super(message); this.name = "TmdbError"; this.status = status; }
}
async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 900, expire: 86400 });
  const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  if (!token) throw new TmdbError("The movie catalog is not configured yet.");
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  url.search = new URLSearchParams({ language: "en-US", ...params }).toString();
  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  } catch { throw new TmdbError("The movie catalog is taking too long to respond. Please try again."); }
  if (!response.ok) throw new TmdbError(response.status === 429 ? "The catalog is busy. Please try again shortly." : "The movie catalog is temporarily unavailable.", response.status);
  return response.json() as Promise<T>;
}
export function titleName(item: Pick<CatalogItem, "title" | "name">) { return item.title || item.name || "Untitled"; }
export function titleDate(item: Pick<CatalogItem, "release_date" | "first_air_date">) { return item.release_date || item.first_air_date || ""; }
export function imageUrl(path: string | null | undefined, size: "w342" | "w500" = "w342") {
  return path && /^\/[a-zA-Z0-9_.-]+$/.test(path) ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}
export async function getCatalog(query: string, kind: CatalogKind, page: number) {
  if (kind === "person" && !query) return getPopularPeople(page);
  const path = query ? `search/${kind === "all" ? "multi" : kind}` : `trending/${kind}/week`;
  const data = await request<{ results: CatalogItem[]; total_pages: number }>(path, { page: String(page), include_adult: "false", ...(query ? { query } : {}) });
  return { results: data.results.map(item => ({ ...item, media_type: item.media_type || kind as CatalogItem["media_type"] })).filter(item => !item.adult && ["movie", "tv", "person"].includes(item.media_type)), totalPages: Math.min(data.total_pages, 500) };
}
async function getPopularPeople(page: number) {
  "use cache";
  cacheLife({ stale: 60, revalidate: 900, expire: 86400 });
  const lists = await Promise.all((["movie", "tv"] as const).map(async kind => {
    const data = await request<{ results: CatalogItem[]; total_pages: number }>(`discover/${kind}`, {
      page: String(page), include_adult: "false", sort_by: "popularity.desc", "vote_count.gte": "100",
    });
    return { ...data, results: data.results.map(item => ({ ...item, media_type: kind })) };
  }));
  const candidates = lists.flatMap(list => list.results.filter(item => !item.adult && (item.vote_count || 0) >= 100).slice(0, 10));
  const titles: TitleDetails[] = [];
  for (let offset = 0; offset < candidates.length; offset += 8) {
    const results = await Promise.allSettled(candidates.slice(offset, offset + 8).map(item => getTitle(item.media_type, item.id)));
    for (const result of results) if (result.status === "fulfilled") titles.push(result.value);
  }
  if (candidates.length && !titles.length) throw new TmdbError("People discovery is temporarily unavailable. Please try again.");
  return { results: popularPeople(titles.filter((title): title is TitleDetails & { media_type: "movie" | "tv" } => title.media_type !== "person")), totalPages: Math.min(500, ...lists.map(list => list.total_pages)) };
}
export async function getGenres() {
  const [movies, tv] = await Promise.all([request<{ genres: Genre[] }>("genre/movie/list"), request<{ genres: Genre[] }>("genre/tv/list")]);
  return Object.fromEntries([...movies.genres, ...tv.genres].map(genre => [genre.id, genre.name]));
}
export async function getTitle(type: MediaType, id: number) {
  const data = await request<TitleDetails>(`${type}/${id}`, { append_to_response: "credits" });
  return { ...data, media_type: type };
}
export async function getPerson(id: number) { return request<PersonDetails>(`person/${id}`, { append_to_response: "combined_credits" }); }

export type EpisodeDetails = { id: number; show_id?: number; season_number: number; episode_number: number; name: string; overview: string; air_date: string | null; runtime: number | null; still_path: string | null; vote_average: number; vote_count: number };
export type SeasonDetails = { id: number; season_number: number; name: string; overview: string; poster_path: string | null; air_date: string | null; episode_count: number; episodes?: EpisodeDetails[] };
export async function getSeason(showId: number, season: number) { return request<SeasonDetails>(`tv/${showId}/season/${season}`); }
export async function getEpisode(showId: number, season: number, episode: number) { return request<EpisodeDetails>(`tv/${showId}/season/${season}/episode/${episode}`); }
