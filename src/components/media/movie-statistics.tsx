import Link from "next/link";
import { getMovieHistory } from "@/lib/tracking";
import { getTitle } from "@/lib/tmdb";
import { movieStatistics } from "@/lib/movie-statistics";

export async function MovieStatistics() {
  const { entries, error } = await getMovieHistory();
  if (error) return <p role="status" className="welcome-copy">{error}</p>;
  const films: Awaited<ReturnType<typeof getTitle>>[] = [];
  const watched = entries.filter(entry => entry.watched);
  // Bound catalog concurrency for larger libraries.
  for (let offset = 0; offset < watched.length; offset += 8) {
    const results = await Promise.allSettled(watched.slice(offset, offset + 8).map(entry => getTitle("movie", entry.tmdb_id)));
    for (const result of results) if (result.status === "fulfilled") films.push(result.value);
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const stats = movieStatistics(entries, films, today);
  if (!stats.watched) return <section className="media-empty"><h3>Your movie story starts here</h3><Link className="text-link" href="/movies/discover">Discover movies</Link></section>;
  const favoriteGenre = stats.genres[0];
  const favoriteActor = stats.actors[0];
  const cards = [
    { label: "Watched this week", value: stats.thisWeek, detail: "Monday–Sunday · Mountain time" },
    { label: "Movies watched", value: stats.watched, detail: `${stats.thisYear} this year` },
    { label: "Time at the movies", value: stats.runtimeCount ? `${Math.round(stats.minutes / 60).toLocaleString()}h` : "—", detail: "Combined movie runtimes" },
    { label: "Five-star club", value: stats.fiveStars, detail: "Your perfect scores" },
    { label: "Your average rating", value: stats.average === null ? "—" : `${stats.average.toFixed(1)} / 5`, detail: `${stats.reviews} written ${stats.reviews === 1 ? "review" : "reviews"}` },
    { label: "Favorite decade", value: stats.decades[0]?.[0] || "—", detail: stats.decades.length ? `${stats.decades[0][1]} movies watched` : "" },
    { label: "On your watchlist", value: entries.filter(entry => entry.on_watchlist).length, detail: "Saved for movie night" },
    { label: "Movies rated", value: stats.ratings.reduce((sum, item) => sum + item.count, 0), detail: "Your personal scores" },
    { label: "Reviews written", value: stats.reviews, detail: "Your thoughts on film" },
  ];
  return <div className="movie-stats-page">
    <dl className="movie-stats-cards">{cards.map(card => <div key={card.label}><dt>{card.label}</dt><dd>{card.value}</dd><p>{card.detail}</p></div>)}</dl>
    <div className="movie-stats-favorites">
      <section className="movie-stats-panel"><p className="eyebrow">YOUR GO-TO GENRE</p><h3>{favoriteGenre?.name || "—"}</h3><p className="welcome-copy">Most watched</p><ol className="movie-stats-ranking">{stats.genres.slice(0, 5).map(genre => <li key={genre.id}><span>{genre.name}</span><strong>{genre.count} <small>{genre.count === 1 ? "movie" : "movies"}</small></strong></li>)}</ol></section>
      <section className="movie-stats-panel"><p className="eyebrow">YOUR FAMILIAR FACE</p><h3>{favoriteActor ? <Link href={`/actors/${favoriteActor.id}`}>{favoriteActor.name}</Link> : "—"}</h3><p className="welcome-copy">Most appearances in your watched movies · top 10 billed cast</p><ol className="movie-stats-ranking">{stats.actors.slice(0, 5).map(actor => <li key={actor.id}><Link href={`/actors/${actor.id}`}>{actor.name}</Link><strong>{actor.count} <small>{actor.count === 1 ? "movie" : "movies"}</small></strong></li>)}</ol></section>
    </div>
    <section className="movie-stats-panel"><h3>Your last six months</h3><div className="movie-stats-months">{stats.months.map(month => <div key={month.key}><strong>{month.count}</strong><div className="movie-stats-track"><div style={{ height: `${month.count / Math.max(1, ...stats.months.map(item => item.count)) * 100}%` }}/></div><span>{month.label}</span></div>)}</div></section>
    <section className="movie-stats-panel"><h3>How you rate</h3><div className="movie-stats-ratings">{stats.ratings.map(item => <div key={item.rating}><span>{item.rating} ★</span><meter min={0} max={Math.max(1, ...stats.ratings.map(row => row.count))} value={item.count} aria-label={`${item.rating} stars: ${item.count} movies`}/><strong>{item.count}</strong></div>)}</div></section>
    {(stats.undated > 0 || stats.missingCatalog > 0) && <p className="movie-stats-note">{stats.undated > 0 && `${stats.undated} ${stats.undated === 1 ? "movie has" : "movies have"} no watch date and ${stats.undated === 1 ? "is" : "are"} excluded from date-based stats. `}{stats.missingCatalog > 0 && "Some movie details are unavailable; genre, cast, decade, and runtime stats may be incomplete."}</p>}
  </div>;
}
