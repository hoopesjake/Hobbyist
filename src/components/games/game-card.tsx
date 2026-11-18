import { withDiscoveryReturnTo } from "@/lib/discovery-navigation";
import Link from "next/link";
import { MediaImage } from "@/components/movies/media-image";
import { RatingStars } from "@/components/movies/rating-stars";
import { ActionForm } from "@/components/auth/action-form";
import { quickAddGame } from "@/app/games/actions";
import { gameImage,gameRelease,type GameSummary } from "@/lib/igdb";
import type { GameTracking } from "@/lib/games";
import { gameStatusLabels } from "@/lib/game-validation";
export function GameCard({game,entry,quick=false,returnTo,compact=false,date}:{game:GameSummary;entry?:GameTracking;quick?:boolean;returnTo?:string;compact?:boolean;date?:string|null}){
 const image=gameImage(game.cover?.image_id);
 const poster=<div className="catalog-poster game-cover">{image?<MediaImage src={image} alt={`${game.name} cover`} width={264} height={352} sizes="(max-width:550px) 42vw,200px"/>:<span className="poster-fallback">Cover unavailable</span>}</div>;
 if(compact)return <article className="game-card"><Link className="catalog-card catalog-card-compact" href={withDiscoveryReturnTo(`/games/${game.id}`,returnTo)} title={game.name}>{poster}{entry&&<RatingStars rating={entry.rating}/>}{date&&<p className="catalog-date">{date}</p>}</Link></article>;
 return <article className="game-card"><Link className="catalog-card" href={withDiscoveryReturnTo(`/games/${game.id}`,returnTo)}>{poster}<p className="catalog-kind">GAME{gameRelease(game.first_release_date)?` / ${gameRelease(game.first_release_date)!.slice(0,4)}`:""}</p><h3>{game.name}</h3>{!!game.genres?.length&&<p className="catalog-genres">{game.genres.slice(0,2).map(genre=>genre.name).join(" / ")}</p>}{entry?.status&&<p className="catalog-note">{gameStatusLabels[entry.status]}</p>}{entry?.progress!==null&&entry?.progress!==undefined&&<progress className="game-progress" aria-label={`${game.name} progress`} max={100} value={entry.progress}/>}{entry&&<RatingStars rating={entry.rating}/>}<p className="catalog-score">IGDB players: {game.rating_count&&game.rating!==undefined?`${game.rating.toFixed(0)} / 100`:"Not rated"}</p></Link>{quick&&<div className="game-quick"><ActionForm action={quickAddGame} label="Backlog"><input type="hidden" name="igdb_id" value={game.id}/><input type="hidden" name="intent" value="backlog"/></ActionForm><ActionForm action={quickAddGame} label="Wishlist"><input type="hidden" name="igdb_id" value={game.id}/><input type="hidden" name="intent" value="wishlist"/></ActionForm></div>}</article>;
}
