type Show = { tmdb_id: number; status: string; rating: number | null };
type Episode = { tmdb_show_id: number; season_number: number; episode_number: number; watched: boolean; watched_on: string | null; rating: number | null };
type Title = { id: number; name?: string; genres: { id: number; name: string }[]; credits: { cast: { id: number; name: string }[] } };
export type StatsSeason = { showId: number; season_number: number; episodes: { episode_number: number; runtime: number | null }[] };
const episodeKey = (show: number, season: number, episode: number) => `${show}:${season}:${episode}`;
export function tvStatistics(shows: Show[], episodes: Episode[], titles: Title[], seasons: StatsSeason[], today: string) {
  const watched = [...new Map(episodes.filter(episode => episode.watched).map(episode => [episodeKey(episode.tmdb_show_id, episode.season_number, episode.episode_number), episode])).values()];
  const watchedKeys = new Set(watched.map(episode => episodeKey(episode.tmdb_show_id, episode.season_number, episode.episode_number)));
  const showIds = new Set([...watched.map(episode => episode.tmdb_show_id), ...shows.filter(show => show.status !== "planned" || show.rating !== null).map(show => show.tmdb_id)]);
  const episodeShowIds = new Set(watched.map(episode => episode.tmdb_show_id));
  const runtime = new Map(seasons.flatMap(season => season.episodes.map(episode => [episodeKey(season.showId, season.season_number, episode.episode_number), episode.runtime] as const)));
  const genres = new Map<number, { id: number; name: string; count: number }>();
  const actors = new Map<number, { id: number; name: string; shows: { id: number; name: string }[] }>();
  const titleMap = new Map(titles.map(title => [title.id, title]));
  for (const id of showIds) {
    const title = titleMap.get(id);
    if (!title) continue;
    for (const genre of title.genres) genres.set(genre.id, { ...genre, count: (genres.get(genre.id)?.count || 0) + 1 });
    for (const actor of new Map(title.credits.cast.slice(0, 10).map(actor => [actor.id, actor])).values()) {
      const record = actors.get(actor.id) || { id: actor.id, name: actor.name, shows: [] };
      record.shows.push({ id, name: title.name || `Show #${id}` });
      actors.set(actor.id, record);
    }
  }
  const days = new Map<string, { count: number; minutes: number; known: number }>();
  let minutes = 0;
  let runtimeCount = 0;
  for (const episode of watched) {
    const duration = runtime.get(episodeKey(episode.tmdb_show_id, episode.season_number, episode.episode_number));
    const known = typeof duration === "number" && duration > 0;
    if (known) { minutes += duration; runtimeCount++; }
    if (episode.watched_on && episode.watched_on <= today) {
      const day = days.get(episode.watched_on) || { count: 0, minutes: 0, known: 0 };
      day.count++;
      if (known) { day.minutes += duration; day.known++; }
      days.set(episode.watched_on, day);
    }
  }
  const now = new Date(`${today}T12:00:00Z`);
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (now.getUTCDay() + 6) % 7);
  const weekStart = monday.toISOString().slice(0, 10);
  const ratedShows = shows.filter(show => show.rating !== null);
  const ratedEpisodes = episodes.filter(episode => episode.rating !== null);
  const average = (items: { rating: number | null }[]) => items.length ? items.reduce((sum, item) => sum + item.rating!, 0) / items.length : null;
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
    const key = date.toISOString().slice(0, 7);
    return { key, label: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }), count: [...days].filter(([day]) => day.startsWith(key)).reduce((sum, [, value]) => sum + value.count, 0) };
  });
  const topDay = [...days].sort((a, b) => b[1].count - a[1].count || b[1].minutes - a[1].minutes || b[0].localeCompare(a[0]))[0];
  return {
    episodes: watched.length, shows: showIds.size, watching: shows.filter(show => show.status === "watching").length,
    completedShows: shows.filter(show => show.status === "completed").length,
    thisWeek: [...days].filter(([day]) => day >= weekStart).reduce((sum, [, value]) => sum + value.count, 0),
    perShow: episodeShowIds.size ? watched.length / episodeShowIds.size : null,
    perDay: days.size ? [...days.values()].reduce((sum, day) => sum + day.count, 0) / days.size : null,
    minutes, runtimeCount, averageRuntime: runtimeCount ? minutes / runtimeCount : null,
    seasonsStarted: new Set(watched.filter(episode => episode.season_number > 0).map(episode => `${episode.tmdb_show_id}:${episode.season_number}`)).size,
    seasonsCompleted: seasons.filter(season => season.season_number > 0 && season.episodes.length > 0 && season.episodes.every(episode => watchedKeys.has(episodeKey(season.showId, season.season_number, episode.episode_number)))).length,
    specials: watched.filter(episode => episode.season_number === 0).length,
    genres: [...genres.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    sharedActors: [...actors.values()].filter(actor => actor.shows.length > 1).sort((a, b) => b.shows.length - a.shows.length || a.name.localeCompare(b.name)),
    showAverage: average(ratedShows), episodeAverage: average(ratedEpisodes),
    fiveStars: ratedEpisodes.filter(episode => episode.rating === 5).length,
    ratings: Array.from({ length: 10 }, (_, index) => ({ rating: (index + 1) / 2, shows: ratedShows.filter(show => show.rating === (index + 1) / 2).length, episodes: ratedEpisodes.filter(episode => episode.rating === (index + 1) / 2).length })),
    topDay: topDay ? { date: topDay[0], ...topDay[1] } : null,
    months, undated: watched.filter(episode => !episode.watched_on).length,
    missingTitles: [...showIds].filter(id => !titleMap.has(id)).length,
    missingSeasons: new Set(watched.filter(episode => !seasons.some(season => season.showId === episode.tmdb_show_id && season.season_number === episode.season_number)).map(episode => `${episode.tmdb_show_id}:${episode.season_number}`)).size,
  };
}
