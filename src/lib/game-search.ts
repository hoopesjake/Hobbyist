type GameCandidate = {
  id: number;
  name: string;
  alternative_names?: { name: string }[];
  rating?: number;
  rating_count?: number;
  aggregated_rating?: number;
  aggregated_rating_count?: number;
};

const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function gameSearchFilters(types: { id: number; type: string }[], statuses: { id: number; status: string }[], now: number) {
  const allowedTypes = new Set(["main game", "standalone expansion", "remake", "remaster", "expanded game", "port"]);
  const allowedStatuses = new Set(["released", "early access", "offline", "delisted"]);
  const typeIds = types.filter(item => allowedTypes.has(normalize(item.type))).map(item => item.id);
  const statusIds = statuses.filter(item => allowedStatuses.has(normalize(item.status))).map(item => item.id);
  if (!typeIds.length || !statusIds.length) throw new Error("Game search metadata is unavailable.");
  return [
    `game_type = (${typeIds.join(",")})`,
    `(game_status = null | game_status = (${statusIds.join(",")}))`,
    `first_release_date <= ${Math.floor(now / 1000)}`,
    "platforms != null",
  ];
}

function relevance(game: GameCandidate, query: string) {
  const names = [game.name, ...(game.alternative_names || []).map(item => item.name)].map(normalize);
  const words = query.split(" ");
  return Math.max(...names.map(name => {
    if (name === query) return 4;
    const tokens = new Set(name.split(" "));
    if (words.every(word => tokens.has(word))) return name.includes(query) ? 3 : 2;
    return words.filter(word => tokens.has(word)).length / words.length;
  }));
}

function popularity(game: GameCandidate) {
  const players = Math.max(0, game.rating_count || 0);
  const critics = Math.max(0, game.aggregated_rating_count || 0);
  const count = players + critics;
  // A handful of perfect scores should not outrank a widely reviewed game.
  const average = count ? ((game.rating || 0) * players + (game.aggregated_rating || 0) * critics) / count : 0;
  const confidenceRating = (average * count + 70 * 20) / (count + 20);
  return Math.log10(1 + count) * 20 + confidenceRating * 0.4;
}

export function rankGameSearch<T extends GameCandidate>(games: T[], query: string): T[] {
  const normalized = normalize(query);
  return [...new Map(games.map(game => [game.id, game])).values()]
    .map(game => ({ game, relevance: relevance(game, normalized), popularity: popularity(game) }))
    .sort((a, b) => b.relevance - a.relevance || b.popularity - a.popularity || a.game.id - b.game.id)
    .map(item => item.game);
}
