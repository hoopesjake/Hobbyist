import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getMovieTracking,getShowTracking } from "@/lib/tracking";
import { getTitle,titleName,titleDate,imageUrl,TmdbError } from "@/lib/tmdb";
import { validId } from "@/lib/media-validation";
import { episodeIndex } from "@/lib/tracking-validation";
import { ReviewDialog } from "@/components/media/review-dialog";
import { Seasons } from "@/components/media/seasons";
import { MediaImage } from "@/components/movies/media-image";
import { ActionForm } from "@/components/auth/action-form";
import { toggleMovieWatchlist,toggleMovieWatched } from "@/app/tracking-actions";
export async function MediaTitlePage({kind,id:rawId,filters={}}:{kind:"movie"|"tv";id:string;filters?:{season?:string;episodes?:string}}){
  const id=validId(rawId);if(!id)notFound();let title;
  try{title=await getTitle(kind,id);}catch(error){if(error instanceof TmdbError&&error.status===404)notFound();throw error;}
  const [user,saved]=await Promise.all([currentUser(),kind==="movie"?getMovieTracking(id):getShowTracking(id)]);
  const root=kind==="movie"?"/movies":"/tv";const name=titleName(title),poster=imageUrl(title.poster_path,"w500");
  const movie=kind==="movie"&&saved.entry&&"on_watchlist" in saved.entry?saved.entry:null;
  return <><Link className="back-link" href={`${root}/discover`}>Back to discover</Link><div className="title-detail"><div className="detail-poster-column"><div className="detail-poster">{poster?<MediaImage src={poster} alt={`${name} poster`} loading="eager" width={500} height={750} sizes="(max-width:600px) 60vw,230px"/>:<span className="poster-fallback">Poster unavailable</span>}</div><ReviewDialog key={`${kind}-${id}`} kind={kind==="movie"?"movie":"show"} id={id} title={name} entry={saved.entry} signedIn={!!user} unavailable={!!saved.error}/>{kind==="movie"&&user&&!saved.error&&<div className="compact-action"><ActionForm action={toggleMovieWatchlist} label={movie?.on_watchlist?"Remove from watchlist":"Add to watchlist"}><input type="hidden" name="tmdb_id" value={id}/><input type="hidden" name="on_watchlist" value={movie?.on_watchlist?"false":"true"}/></ActionForm><ActionForm action={toggleMovieWatched} label={movie?.watched?"Mark unwatched":"Mark watched"}><input type="hidden" name="tmdb_id" value={id}/><input type="hidden" name="watched" value={movie?.watched?"false":"true"}/></ActionForm></div>}</div><div><p className="eyebrow">{kind==="movie"?"MOVIE":"TV SHOW"}</p><h2 className="detail-title">{name}</h2>{title.tagline&&<p className="title-tagline">{title.tagline}</p>}<p className="title-meta">{title.genres.map(genre=>genre.name).join(" / ")||"Genres unavailable"}</p><p className="title-meta">{kind==="movie"?"Released":"First aired"}: {titleDate(title)||"Not announced"}{title.runtime?` / ${title.runtime} min`:""}{title.number_of_seasons?` / ${title.number_of_seasons} seasons`:""}</p><p className="catalog-score">TMDB score: {title.vote_count?`${title.vote_average?.toFixed(1)} / 10 (${title.vote_count.toLocaleString("en-US")} votes)`:"Not rated"}</p><p className="title-overview">{title.overview||"No description is available yet."}</p>{saved.entry&&"started_on" in saved.entry&&<p className="title-meta">Show started: {saved.entry.started_on||"Not recorded"} / Completed: {saved.entry.completed_on||"Not recorded"}</p>}{saved.entry?.review&&<details className="saved-review"><summary>{saved.entry.contains_spoilers?"Your review (contains spoilers)":"Your review"}</summary><p>{saved.entry.review}</p></details>}<a className="text-link" href={`https://www.themoviedb.org/${kind}/${id}`} target="_blank" rel="noreferrer">View on TMDB</a></div></div>
    {kind==="tv"&&<Seasons show={title} selected={episodeIndex(filters.season,true)} episodePage={Math.max(1,parseInt(filters.episodes||"1",10)||1)} signedIn={!!user}/>}
    <section className="dashboard-section"><div className="section-heading"><h2>Cast</h2></div>{title.credits?.cast?.length?<div className="cast-grid">{title.credits.cast.slice(0,18).map(actor=><Link className="cast-card" key={actor.id} href={`/actors/${actor.id}`}>{imageUrl(actor.profile_path)?<MediaImage src={imageUrl(actor.profile_path)!} alt={actor.name} width={150} height={225} sizes="120px"/>:<span className="poster-fallback">No portrait</span>}<strong>{actor.name}</strong><span>{actor.character||"Cast"}</span></Link>)}</div>:<p className="welcome-copy">Cast details are not available yet.</p>}</section>
  </>;
}
