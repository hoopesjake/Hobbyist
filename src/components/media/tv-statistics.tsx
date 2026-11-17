import Link from "next/link";
import { getTVHistory } from "@/lib/tracking";
import { getTitle, getSeason } from "@/lib/tmdb";
import { tvStatistics, type StatsSeason } from "@/lib/tv-statistics";

async function collect<T, R>(items: T[], fetchItem: (item: T) => Promise<R>) {
  const values: R[] = [];
  for (let offset = 0; offset < items.length; offset += 8) {
    const results = await Promise.allSettled(items.slice(offset, offset + 8).map(fetchItem));
    for (const result of results) if (result.status === "fulfilled") values.push(result.value);
  }
  return values;
}
function duration(minutes: number) {
  return `${Math.floor(minutes / 60).toLocaleString()}h ${minutes % 60}m`;
}
function rating(value: number | null) { return value === null ? "—" : `${value.toFixed(1)} / 5`; }

export async function TVStatistics() {
  const { shows, episodes, error } = await getTVHistory();
  if (error) return <p role="status" className="welcome-copy">{error}</p>;
  if (!shows.length && !episodes.length) return <section className="media-empty"><h3>Your next obsession awaits</h3><Link className="text-link" href="/tv/discover">Discover TV shows</Link></section>;
  const watched = episodes.filter(episode => episode.watched);
  const ids = [...new Set([...shows.filter(show => show.status !== "planned" || show.rating !== null).map(show => show.tmdb_id), ...watched.map(episode => episode.tmdb_show_id)])];
  const seasonKeys = [...new Map(watched.map(episode => [`${episode.tmdb_show_id}:${episode.season_number}`, { showId: episode.tmdb_show_id, season: episode.season_number }])).values()];
  const [titles, seasons] = await Promise.all([
    collect(ids, id => getTitle("tv", id)),
    collect(seasonKeys, async ({ showId, season }): Promise<StatsSeason> => {
      const data = await getSeason(showId, season);
      if (!data.episodes?.length) throw new Error("Season episodes unavailable");
      return { showId, season_number: season, episodes: data.episodes };
    }),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const stats = tvStatistics(shows, episodes, titles, seasons, today);
  const cards = [
    { label: "Episodes watched", value: stats.episodes, detail: `${stats.thisWeek} this week · Mon–Sun, Mountain time` },
    { label: "Total binge time", value: stats.runtimeCount ? duration(stats.minutes) : "—", detail: stats.runtimeCount ? `${(stats.minutes / 1440).toFixed(1)} days of TV` : "No episode runtimes available" },
    { label: "Seasons finished", value: stats.seasonsCompleted, detail: `${stats.seasonsStarted} started · specials separate` },
    { label: "Episodes per show", value: stats.perShow?.toFixed(1) ?? "—", detail: "Across shows with watched episodes" },
    { label: "Episodes per watch day", value: stats.perDay?.toFixed(1) ?? "—", detail: "Days with dated episodes" },
    { label: "Average episode length", value: stats.averageRuntime === null ? "—" : `${Math.round(stats.averageRuntime)}m`, detail: "Watched episodes with runtimes" },
    { label: "Show rating", value: rating(stats.showAverage), detail: "Your overall scores" },
    { label: "Episode rating", value: rating(stats.episodeAverage), detail: `${stats.fiveStars} five-star episodes` },
    { label: "Shows completed", value: stats.completedShows, detail: `${stats.watching} currently watching · ${stats.specials} specials watched` },
  ];
  const maxMonth = Math.max(1, ...stats.months.map(month => month.count));
  const maxRating = Math.max(1, ...stats.ratings.flatMap(row => [row.shows, row.episodes]));
  return <div className="movie-stats-page">
    <dl className="movie-stats-cards">{cards.map(card => <div key={card.label}><dt>{card.label}</dt><dd>{card.value}</dd><p>{card.detail}</p></div>)}</dl>
    <section className="movie-stats-panel tv-binge-highlight"><div><p className="eyebrow">JUST ONE MORE EPISODE</p><h3>Your biggest binge day</h3></div>{stats.topDay ? <div><strong>{stats.topDay.count} {stats.topDay.count === 1 ? "episode" : "episodes"}</strong><p className="welcome-copy">{new Date(`${stats.topDay.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}{stats.topDay.known > 0 ? ` · ${duration(stats.topDay.minutes)}${stats.topDay.known < stats.topDay.count ? " known runtime" : ""}` : ""}</p></div> : <p className="welcome-copy">No dated episodes yet</p>}</section>
    <div className="movie-stats-favorites">
      <section className="movie-stats-panel"><p className="eyebrow">YOUR TV TASTE</p><h3>{stats.genres[0]?.name || "Favorite genres"}</h3><p className="welcome-copy">By shows in your viewing history</p>{stats.genres.length ? <ol className="movie-stats-ranking">{stats.genres.slice(0, 5).map(genre => <li key={genre.id}><span>{genre.name}</span><strong>{genre.count} <small>{genre.count === 1 ? "show" : "shows"}</small></strong></li>)}</ol> : <p className="welcome-copy">No genre data yet</p>}</section>
      <section className="movie-stats-panel"><p className="eyebrow">WAIT, I KNOW THAT FACE</p><h3>Shared actors</h3><p className="welcome-copy">Across your shows · top 10 billed cast</p>{stats.sharedActors.length ? <ol className="tv-shared-actors">{stats.sharedActors.slice(0, 5).map(actor => <li key={actor.id}><div><Link href={`/actors/${actor.id}`}>{actor.name}</Link><strong>{actor.shows.length} shows</strong></div><p>{actor.shows.map((show, index) => <span key={show.id}>{index > 0 && " · "}<Link href={`/tv/${show.id}`}>{show.name}</Link></span>)}</p></li>)}</ol> : <p className="welcome-copy">No cast crossovers yet</p>}</section>
    </div>
    <section className="movie-stats-panel"><h3>Six months of episodes</h3><div className="movie-stats-months">{stats.months.map(month => <div key={month.key}><strong>{month.count}</strong><div className="movie-stats-track"><div style={{ height: `${month.count / maxMonth * 100}%` }}/></div><span>{month.label}</span></div>)}</div></section>
    <section className="movie-stats-panel"><h3>Your ratings</h3><div className="movie-stats-favorites">{(["shows", "episodes"] as const).map(kind => <div key={kind}><p className="eyebrow">{kind.toUpperCase()}</p><div className="tv-rating-rows">{stats.ratings.map(row => <div key={row.rating}><span>{row.rating} ★</span><meter min={0} max={maxRating} value={row[kind]} aria-label={`${row.rating} stars: ${row[kind]} ${kind}`}/><strong>{row[kind]}</strong></div>)}</div></div>)}</div></section>
    {(stats.undated > 0 || stats.runtimeCount < stats.episodes || stats.missingTitles > 0 || stats.missingSeasons > 0) && <p className="movie-stats-note">{stats.undated > 0 && `${stats.undated} undated episodes excluded from date-based stats. `}{stats.runtimeCount < stats.episodes && `Runtime available for ${stats.runtimeCount} of ${stats.episodes} watched episodes. `}{(stats.missingTitles > 0 || stats.missingSeasons > 0) && "Some catalog details are unavailable; genre, cast, and season totals may be incomplete."}</p>}
  </div>;
}
