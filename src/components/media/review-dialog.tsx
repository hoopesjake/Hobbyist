"use client";
import Link from "next/link";
import { useRef,useState } from "react";
import { X } from "lucide-react";
import { ActionForm,type FormState } from "@/components/auth/action-form";
import { RatingStars } from "@/components/movies/rating-stars";
import { StarRating } from "@/components/movies/star-rating";
import { saveMovie,saveEpisode,removeTracking } from "@/app/tracking-actions";
import type { MovieTracking,EpisodeTracking } from "@/lib/tracking";
// Shows get their own always-visible ShowTrackingPanel; this dialog now only covers
// movies and episodes, which stay compact behind a "Review" trigger.
type Props={kind:"movie"|"episode";id:number;title:string;entry:MovieTracking|EpisodeTracking|null;signedIn:boolean;unavailable:boolean;season?:number;episode?:number};
export function ReviewDialog({kind,id,title,entry,signedIn,unavailable,season,episode}:Props){
  const dialog=useRef<HTMLDialogElement>(null);const [feedback,setFeedback]=useState("");
  const movie=kind==="movie"?entry as MovieTracking|null:null;
  const watched=kind==="episode"?(entry as EpisodeTracking|null)?.watched:movie?.watched;
  const watchedOn=kind==="episode"?(entry as EpisodeTracking|null)?.watched_on:movie?.watched_on;
  const identity=`${kind}-${id}-${season??""}-${episode??""}`;
  async function save(state:FormState,form:FormData){const result=await (kind==="movie"?saveMovie:saveEpisode)(state,form);if(result.message){dialog.current?.close();setFeedback(result.message);}return result;}
  async function remove(state:FormState,form:FormData){if(!window.confirm("Remove this personal tracking record?"))return {};const result=await removeTracking(state,form);if(result.message){dialog.current?.close();setFeedback(result.message);}return result;}
  const fields=<><input type="hidden" name="tmdb_id" value={id}/><input type="hidden" name="kind" value={kind}/>{kind==="episode"&&<><input type="hidden" name="tmdb_show_id" value={id}/><input type="hidden" name="season_number" value={season}/><input type="hidden" name="episode_number" value={episode}/></>}</>;
  return <div className={kind==="episode"?"episode-review":"poster-review"}>
    <button className={`account-button ${kind==="episode"?"episode-review-trigger":"review-trigger"}`} type="button" onClick={()=>dialog.current?.showModal()}>{kind==="episode"?"Review episode":"Review"}</button>
    {entry&&kind!=="episode"&&<p className="poster-saved-status">{movie?.watched?"Watched":movie?.on_watchlist?"On your watchlist":"In your library"}</p>}
    {kind!=="episode"&&<RatingStars rating={entry?.rating} centered/>}
    {feedback&&<p className="tracking-feedback" role="status">{feedback}</p>}
    <dialog ref={dialog} className="review-dialog" aria-labelledby={`review-${identity}`} onClick={event=>{if(event.target===event.currentTarget)event.currentTarget.close();}}>
      <div className="review-dialog-content"><header className="review-dialog-header"><div><p className="eyebrow">{kind==="episode"?"EPISODE REVIEW":"MOVIE REVIEW"}</p><h2 id={`review-${identity}`}>{title}</h2></div><button type="button" className="icon-button" aria-label="Close review" onClick={()=>dialog.current?.close()}><X size={20}/></button></header>
      {unavailable?<p role="status">Your saved details could not be loaded. Refresh before making changes.</p>:<>
      <ActionForm key={`${identity}-${entry?.updated_at||"new"}`} action={save} label="Save review">{fields}<StarRating defaultValue={entry?.rating??null}/>
        <label>Review<textarea name="review" aria-label="Review text" defaultValue={entry?.review||""} maxLength={10000} rows={3} placeholder="What stayed with you? (optional)"/></label>
        <label className="check-label"><input type="checkbox" name="contains_spoilers" defaultChecked={entry?.contains_spoilers||false}/>Contains spoilers</label>
        <details className="review-more"><summary>{kind==="movie"?"Watchlist & watched date":"Watched status & date"}</summary><div className="review-more-fields">
          {kind==="movie"&&<label className="check-label"><input type="checkbox" name="on_watchlist" defaultChecked={movie?.on_watchlist??!movie?.watched}/>On my watchlist</label>}
          <label className="check-label"><input type="checkbox" name="watched" defaultChecked={watched||false}/>Watched</label><label>Date watched<input type="date" name="watched_on" defaultValue={watchedOn||""}/></label>
        </div></details>
        {!signedIn&&<p className="review-sign-in"><Link className="text-link" href="/auth/sign-in">Sign in</Link> to save your review and tracking.</p>}
      </ActionForm>{entry&&<div className="review-remove"><ActionForm action={remove} label="Remove personal tracking">{fields}</ActionForm></div>}
      </>}
    </div></dialog>
  </div>;
}
