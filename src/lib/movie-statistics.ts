type Movie = { tmdb_id: number; watched: boolean; watched_on: string | null; rating: number | null; review: string; on_watchlist: boolean };
type Film = { id: number; title?: string; release_date?: string; runtime?: number; genres: { id: number; name: string }[]; credits: { cast: { id: number; name: string }[] } };
export function movieStatistics(entries: Movie[], films: Film[], today: string) {
  const now = new Date(`${today}T12:00:00Z`);
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (now.getUTCDay() + 6) % 7);
  const weekStart = monday.toISOString().slice(0, 10);
  const watched = entries.filter(entry => entry.watched);
  const rated = watched.filter(entry => entry.rating !== null);
  const catalog = new Map(films.map(film => [film.id, film]));
  const genres = new Map<number, { id: number; name: string; count: number }>();
  const actors = new Map<number, { id: number; name: string; count: number }>();
  const decades = new Map<string, number>();
  let minutes = 0;
  let runtimeCount = 0;
  for (const entry of watched) {
    const film = catalog.get(entry.tmdb_id);
    if (!film) continue;
    if (film.runtime && film.runtime > 0) { minutes += film.runtime; runtimeCount++; }
    for (const genre of film.genres) genres.set(genre.id, { ...genre, count: (genres.get(genre.id)?.count || 0) + 1 });
    for (const actor of film.credits.cast.slice(0, 10)) actors.set(actor.id, { id: actor.id, name: actor.name, count: (actors.get(actor.id)?.count || 0) + 1 });
    if (film.release_date) {
      const decade = `${Math.floor(Number(film.release_date.slice(0, 4)) / 10) * 10}s`;
      decades.set(decade, (decades.get(decade) || 0) + 1);
    }
  }
  const rank = <T extends { count: number; name: string }>(values: T[]) => values.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
    const key = date.toISOString().slice(0, 7);
    return { key, label: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }), count: watched.filter(entry => entry.watched_on?.startsWith(key)).length };
  });
  return {
    watched: watched.length, thisWeek: watched.filter(entry => entry.watched_on && entry.watched_on >= weekStart && entry.watched_on <= today).length,
    thisYear: watched.filter(entry => entry.watched_on?.startsWith(today.slice(0, 4)) && entry.watched_on <= today).length,
    fiveStars: rated.filter(entry => entry.rating === 5).length,
    reviews: watched.filter(entry => entry.review.trim()).length,
    average: rated.length ? rated.reduce((sum, entry) => sum + entry.rating!, 0) / rated.length : null,
    minutes, runtimeCount, genres: rank([...genres.values()]), actors: rank([...actors.values()]),
    decades: [...decades].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), months,
    undated: watched.filter(entry => !entry.watched_on).length,
    ratings: Array.from({ length: 10 }, (_, index) => ({ rating: (index + 1) / 2, count: rated.filter(entry => entry.rating === (index + 1) / 2).length })),
    missingCatalog: watched.filter(entry => !catalog.has(entry.tmdb_id)).length,
  };
}
