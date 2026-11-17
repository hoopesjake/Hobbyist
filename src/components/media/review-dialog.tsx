"use client";
import Link from "next/link";
import { useRef,useState } from "react";
import { X } from "lucide-react";
import { ActionForm,type FormState } from "@/components/auth/action-form";
import { RatingStars } from "@/components/movies/rating-stars";
import { StarRating } from "@/components/movies/star-rating";
import { saveMovie,saveShow,saveEpisode,removeTracking } from "@/app/tracking-actions";
import { showStatuses,showStatusLabels } from "@/lib/tracking-validation";
import type { MovieTracking,ShowTracking,EpisodeTracking } from "@/lib/tracking";
type Props={kind:"movie"|"show"|"episode";id:number;title:string;entry:MovieTracking|ShowTracking|EpisodeTracking|null;signedIn:boolean;unavailable:boolean;season?:number;episode?:number};
export function ReviewDialog({kind,id,title,entry,signedIn,unavailable,season,episode}:Props){
  const dialog=useRef<HTMLDialogElement>(null);const [feedback,setFeedback]=useState("");
  const movie=kind==="movie"?entry as MovieTracking|null:null;
  const show=kind==="show"?entry as ShowTracking|null:null;
  const watched=kind==="episode"?(entry as EpisodeTracking|null)?.watched:movie?.watched;
  const watchedOn=kind==="episode"?(entry as EpisodeTracking|null)?.watched_on:movie?.watched_on;
  const identity=`${kind}-${id}-${season??""}-${episode??""}`;
  async function save(state:FormState,form:FormData){const result=await (kind==="movie"?saveMovie:kind==="show"?saveShow:saveEpisode)(state,form);if(result.message){dialog.current?.close();setFeedback(result.message);}return result;}
  async function remove(state:FormState,form:FormData){if(!window.confirm(kind==="show"?"Remove this show and all its personal episode tracking?":"Remove this personal tracking record?"))return {};const result=await removeTracking(state,form);if(result.message){dialog.current?.close();setFeedback(result.message);}return result;}
  const fields=<><input type="hidden" name="tmdb_id" value={id}/><input type="hidden" name="kind" value={kind}/>{kind==="episode"&&<><input type="hidden" name="tmdb_show_id" value={id}/><input type="hidden" name="season_number" value={season}/><input type="hidden" name="episode_number" value={episode}/></>}</>;
  return <div className={kind==="episode"?"episode-review":"poster-review"}>
    <button className={`account-button ${kind==="episode"?"episode-review-trigger":"review-trigger"}`} type="button" onClick={()=>dialog.current?.showModal()}>{kind==="episode"?"Review episode":"Review"}</button>
    {entry&&kind!=="episode"&&<p className="poster-saved-status">{show?showStatusLabels[show.status]:movie?.watched?"Watched":movie?.on_watchlist?"On your watchlist":"In your library"}</p>}
    {kind!=="episode"&&<RatingStars rating={entry?.rating} centered/>}
    {feedback&&<p className="tracking-feedback" role="status">{feedback}</p>}
    <dialog ref={dialog} className="review-dialog" aria-labelledby={`review-${identity}`} onClick={event=>{if(event.target===event.currentTarget)event.currentTarget.close();}}>
      <div className="review-dialog-content"><header className="review-dialog-header"><div><p className="eyebrow">{kind==="show"?"OVERALL SHOW REVIEW":kind==="episode"?"EPISODE REVIEW":"MOVIE REVIEW"}</p><h2 id={`review-${identity}`}>{title}</h2></div><button type="button" className="icon-button" aria-label="Close review" onClick={()=>dialog.current?.close()}><X size={20}/></button></header>
      {unavailable?<p role="status">Your saved details could not be loaded. Refresh before making changes.</p>:<>
      <ActionForm key={`${identity}-${entry?.updated_at||"new"}`} action={save} label="Save review">{fields}<StarRating defaultValue={entry?.rating??null}/>
        <label>Review<textarea name="review" aria-label="Review text" defaultValue={entry?.review||""} maxLength={10000} rows={3} placeholder="What stayed with you? (optional)"/></label>
        <label className="check-label"><input type="checkbox" name="contains_spoilers" defaultChecked={entry?.contains_spoilers||false}/>Contains spoilers</label>
        <details className="review-more"><summary>{kind==="movie"?"Watchlist & watched date":kind==="show"?"Show status & dates":"Watched status & date"}</summary><div className="review-more-fields">
          {kind==="show"?<><label>Status<select aria-label="Show status" name="status" defaultValue={show?.status||"planned"}>{showStatuses.map(status=><option key={status} value={status}>{showStatusLabels[status]}</option>)}</select></label><div className="viewing-dates"><label>Show started<input type="date" name="started_on" defaultValue={show?.started_on||""}/></label><label>Show completed<input type="date" name="completed_on" defaultValue={show?.completed_on||""}/></label></div></>:<>
          {kind==="movie"&&<label className="check-label"><input type="checkbox" name="on_watchlist" defaultChecked={movie?.on_watchlist??!movie?.watched}/>On my watchlist</label>}
          <label className="check-label"><input type="checkbox" name="watched" defaultChecked={watched||false}/>Watched</label><label>Date watched<input type="date" name="watched_on" defaultValue={watchedOn||""}/></label>
          </>}
        </div></details>
        {!signedIn&&<p className="review-sign-in"><Link className="text-link" href="/auth/sign-in">Sign in</Link> to save your review and tracking.</p>}
      </ActionForm>{entry&&<div className="review-remove"><ActionForm action={remove} label={kind==="show"?"Remove show & episode tracking":"Remove personal tracking"}>{fields}</ActionForm></div>}
      </>}
    </div></dialog>
  </div>;
}
