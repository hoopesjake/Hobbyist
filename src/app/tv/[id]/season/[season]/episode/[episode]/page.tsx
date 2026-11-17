import { BackLink } from "@/components/layout/back-link";
import { RatingStars } from "@/components/movies/rating-stars";
import { notFound } from "next/navigation";
import { validId } from "@/lib/media-validation";
import { episodeIndex } from "@/lib/tracking-validation";
import { getEpisode,getTitle,titleName,imageUrl,TmdbError } from "@/lib/tmdb";
import { getEpisodeTracking } from "@/lib/tracking";
import { currentUser } from "@/lib/auth";
import { MediaImage } from "@/components/movies/media-image";
import { EpisodeControls } from "@/components/media/seasons";
export default async function EpisodePage({params}:{params:Promise<{id:string;season:string;episode:string}>}){
  const raw=await params;const id=validId(raw.id),season=episodeIndex(raw.season,true),number=episodeIndex(raw.episode);
  if(!id||season===null||number===null)notFound();let show,episode;
  try{[show,episode]=await Promise.all([getTitle("tv",id),getEpisode(id,season,number)]);}catch(error){if(error instanceof TmdbError&&error.status===404)notFound();throw error;}
  const [user,saved]=await Promise.all([currentUser(),getEpisodeTracking(id,season,number)]);const image=imageUrl(episode.still_path,"w500");
  return <><BackLink href={`/tv/${id}?season=${season}#seasons`}>Back to {titleName(show)} / {season===0?"Specials":`Season ${season}`}</BackLink><article className="episode-detail"><p className="eyebrow">SEASON {season} / EPISODE {number}</p><h2 className="detail-title">{episode.name}</h2>{image&&<MediaImage src={image} alt={`${episode.name} still`} width={500} height={281} sizes="(max-width:600px) 90vw,500px"/>}<p className="title-meta">Aired: {episode.air_date||"Not announced"}{episode.runtime?` / ${episode.runtime} min`:""}</p><p className="title-overview">{episode.overview||"No description is available yet."}</p><p className="catalog-score">TMDB episode score: {episode.vote_count?`${episode.vote_average.toFixed(1)} / 10`:"Not rated"}</p>{saved.entry&&<p className="episode-personal">{saved.entry.watched?"Watched":"Not marked watched"}{saved.entry.watched_on?` / ${saved.entry.watched_on}`:""}</p>}<RatingStars rating={saved.entry?.rating}/><EpisodeControls showId={id} episode={episode} entry={saved.entry} signedIn={!!user} unavailable={!!saved.error}/>{saved.entry?.review&&<details className="saved-review"><summary>{saved.entry.contains_spoilers?"Your episode review (contains spoilers)":"Your episode review"}</summary><p>{saved.entry.review}</p></details>}</article></>;
}
