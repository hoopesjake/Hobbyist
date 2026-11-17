import "server-only";
import { cacheLife } from "next/cache";
import { createIgdbTransport, IgdbError } from "@/lib/igdb-transport";
import { gameId, gameSearchBody } from "@/lib/game-validation";
import { gameSearchFilters, rankGameSearch } from "@/lib/game-search";
export { IgdbError };
export type GameFacet = { id: number; name: string };
export type GameSummary = { id: number; name: string; slug?: string; cover?: { image_id: string }; first_release_date?: number; genres?: GameFacet[]; platforms?: GameFacet[]; rating?: number; rating_count?: number; aggregated_rating?: number; aggregated_rating_count?: number };
export type GameDetails = GameSummary & { summary?: string; storyline?: string; screenshots?: { id: number; image_id: string }[]; game_modes?: GameFacet[]; involved_companies?: { developer?: boolean; publisher?: boolean; company?: GameFacet }[]; similar_games?: GameSummary[]; dlcs?: GameSummary[]; expansions?: GameSummary[]; franchises?: GameFacet[]; collections?: GameFacet[] };
const transport = createIgdbTransport(() => process.env.IGDB_CLIENT_ID, () => process.env.IGDB_CLIENT_SECRET);
const cardFields = "id,name,slug,cover.image_id,first_release_date,genres.name,platforms.name,rating,rating_count,aggregated_rating,aggregated_rating_count";
const detailFields = `${cardFields},summary,storyline,screenshots.image_id,game_modes.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,similar_games.name,similar_games.cover.image_id,dlcs.name,dlcs.cover.image_id,expansions.name,expansions.cover.image_id,franchises.name,collections.name`;
export function gameImage(id: string | null | undefined, size: "cover_big" | "screenshot_big" = "cover_big") {
  return id && /^[A-Za-z0-9_-]+$/.test(id) ? `https://images.igdb.com/igdb/image/upload/t_${size}/${id}.jpg` : null;
}
export function gameRelease(timestamp?: number) { if (!timestamp || !Number.isFinite(timestamp)) return null; const date = new Date(timestamp * 1000); return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null; }
export async function searchGames(query = "", page = 1, genre?: number | null, platform?: number | null) {
  "use cache";
  cacheLife({ stale: 60, revalidate: 900, expire: 86400 });
  const text = query.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200);
  const data = await getGameSearchCandidates(text, text ? 1 : page, genre, platform);
  const ranked = text ? rankGameSearch(data, text) : data;
  const offset = text ? (Math.max(1, Math.min(25, Math.floor(page) || 1)) - 1) * 20 : 0;
  return { games: ranked.slice(offset, offset + 20), hasNext: ranked.length > offset + 20 };
}
async function getGameSearchCandidates(query: string, page: number, genre?: number | null, platform?: number | null) {
  "use cache";
  cacheLife({ stale: 60, revalidate: 900, expire: 86400 });
  const metadata = await getGameSearchMetadata();
  const filters = gameSearchFilters(metadata.types, metadata.statuses, Date.now());
  return transport.request<GameSummary & { alternative_names?: { name: string }[] }>("games", `fields ${cardFields},alternative_names.name; ${gameSearchBody(query, page, genre, platform, filters)}`);
}
async function getGameSearchMetadata() {
  "use cache";
  cacheLife({ stale: 86400, revalidate: 86400, expire: 604800 });
  const [types, statuses] = await Promise.all([
    transport.request<{ id: number; type: string }>("game_types", "fields id,type; limit 100;"),
    transport.request<{ id: number; status: string }>("game_statuses", "fields id,status; limit 100;"),
  ]);
  return { types, statuses };
}
export async function getGame(id: number) {
  "use cache";
  cacheLife({ stale: 60, revalidate: 3600, expire: 86400 });
  if (!gameId(id)) throw new IgdbError("Invalid game.", 400);
  const games = await transport.request<GameDetails>("games", `fields ${detailFields}; where id = ${id}; limit 1;`);
  if (!games[0] || games[0].id !== id) throw new IgdbError("This game could not be found.", 404);
  return games[0];
}
export async function getGameCards(ids: number[]) {
  "use cache";
  cacheLife({ stale: 60, revalidate: 3600, expire: 86400 });
  if (!ids.length) return [] as GameSummary[];
  if (ids.length > 500 || ids.some(id => !gameId(id))) throw new IgdbError("Invalid game selection.", 400);
  return transport.request<GameSummary>("games", `fields ${cardFields}; where id = (${[...new Set(ids)].join(",")}); limit 500;`);
}
export async function getGameFacets() {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 86400, expire: 604800 });
  const [genres, platforms] = await Promise.all([transport.request<GameFacet>("genres", "fields id,name; sort name asc; limit 500;"), transport.request<GameFacet>("platforms", "fields id,name; sort name asc; limit 500;")]);
  return { genres, platforms };
}
