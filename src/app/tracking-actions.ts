"use server";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/media-validation";
import { episodeIndex,parseTracking } from "@/lib/tracking-validation";
import { getTitle,getEpisode,getSeason,TmdbError } from "@/lib/tmdb";
import type { FormState } from "@/components/auth/action-form";
function refresh(){revalidatePath("/","layout");}
function failed(code:string):FormState{console.error("Separate tracking write failed:",code);return {error:"Your changes could not be saved. Please try again later."};}
function caught(error:unknown):FormState{return {error:error instanceof TmdbError?error.message:"Your changes could not be saved. Please try again."};}
async function markShowWatching(client:Awaited<ReturnType<typeof createClient>>,userId:string,showId:number){
  return client.from("tv_tracking").update({status:"watching"}).eq("user_id",userId).eq("tmdb_id",showId).neq("status","completed");
}
export async function saveMovie(_:FormState,form:FormData):Promise<FormState>{
  const user=await currentUser();if(!user)return {error:"Sign in to save your movie."};
  const id=validId(form.get("tmdb_id"));if(!id)return {error:"Invalid movie."};
  const parsed=parseTracking("movie",form);if(parsed.error)return {error:parsed.error};if(!parsed.movie)return {error:"Invalid movie tracking."};
  try{await getTitle("movie",id);const client=await createClient();const {error}=await client.from("movie_tracking").upsert({user_id:user.id,tmdb_id:id,...parsed.movie},{onConflict:"user_id,tmdb_id"});if(error)return failed(error.code);}catch(error){return caught(error);}
  refresh();return {message:"Movie saved."};
}
export async function saveShow(_:FormState,form:FormData):Promise<FormState>{
  const user=await currentUser();if(!user)return {error:"Sign in to save your show."};
  const id=validId(form.get("tmdb_id"));if(!id)return {error:"Invalid show."};
  const parsed=parseTracking("show",form);if(parsed.error)return {error:parsed.error};if(!parsed.show)return {error:"Invalid show tracking."};
  try{await getTitle("tv",id);const client=await createClient();const {error}=await client.from("tv_tracking").upsert({user_id:user.id,tmdb_id:id,...parsed.show},{onConflict:"user_id,tmdb_id"});if(error)return failed(error.code);}catch(error){return caught(error);}
  refresh();return {message:"Show saved."};
}
async function episodeContext(form:FormData){
  const user=await currentUser();if(!user)return {error:"Sign in to track episodes."} as const;
  const id=validId(form.get("tmdb_show_id")),season=episodeIndex(form.get("season_number"),true),episode=episodeIndex(form.get("episode_number"));
  if(!id || season===null || episode===null)return {error:"Invalid episode."} as const;
  const metadata=await getEpisode(id,season,episode);
  if(metadata.season_number!==season || metadata.episode_number!==episode)return {error:"Episode details changed. Please refresh."} as const;
  const client=await createClient();
  // Create the parent if absent; successful watched writes update its status below.
  const {error}=await client.from("tv_tracking").upsert({user_id:user.id,tmdb_id:id},{onConflict:"user_id,tmdb_id",ignoreDuplicates:true});
  if(error){console.error("Episode parent creation failed:",error.code);return {error:"Your show could not be saved. Please try again later."} as const;}
  return {client,identity:{user_id:user.id,tmdb_show_id:id,season_number:season,episode_number:episode,tmdb_episode_id:metadata.id}} as const;
}
export async function saveEpisode(_:FormState,form:FormData):Promise<FormState>{
  const parsed=parseTracking("episode",form);if(parsed.error)return {error:parsed.error};if(!parsed.episode)return {error:"Invalid episode tracking."};
  try{const context=await episodeContext(form);if(context.error)return {error:context.error};const {error}=await context.client.from("tv_episode_tracking").upsert({...context.identity,...parsed.episode},{onConflict:"user_id,tmdb_show_id,season_number,episode_number"});if(error)return failed(error.code);if(parsed.episode.watched){const {error:statusError}=await markShowWatching(context.client,context.identity.user_id,context.identity.tmdb_show_id);if(statusError){refresh();return failed(statusError.code);}}}catch(error){return caught(error);}
  refresh();return {message:"Episode saved."};
}
export async function toggleEpisode(_:FormState,form:FormData):Promise<FormState>{
  if(!["true","false"].includes(String(form.get("watched"))))return {error:"Invalid watch state."};
  const watched=form.get("watched")==="true";
  try{const context=await episodeContext(form);if(context.error)return {error:context.error};
    const identity=context.identity;
    const {data:previous,error:readError}=await context.client.from("tv_episode_tracking").select("watched_on").eq("user_id",identity.user_id).eq("tmdb_show_id",identity.tmdb_show_id).eq("season_number",identity.season_number).eq("episode_number",identity.episode_number).maybeSingle();
    if(readError)return failed(readError.code);
    const {error}=await context.client.from("tv_episode_tracking").upsert({...identity,watched,watched_on:watched?previous?.watched_on||null:null},{onConflict:"user_id,tmdb_show_id,season_number,episode_number"});if(error)return failed(error.code);
    if(watched){const {error:statusError}=await markShowWatching(context.client,identity.user_id,identity.tmdb_show_id);if(statusError){refresh();return failed(statusError.code);}}
  }catch(error){return caught(error);}
  refresh();return {message:watched?"Marked watched.":"Marked unwatched."};
}
export async function watchSeason(_:FormState,form:FormData):Promise<FormState>{
  const user=await currentUser();if(!user)return {error:"Sign in to watch a season."};
  const id=validId(form.get("tmdb_show_id")),season=episodeIndex(form.get("season_number"),true);
  if(!id||season===null)return {error:"Invalid season."};
  let count=0;
  try{
    // Fetch the complete season, not just the currently visible episode page.
    const metadata=await getSeason(id,season);
    const episodes=metadata.episodes||[];
    if(!episodes.length)return {message:"This season has no episodes yet."};
    if(episodes.some(episode=>episode.season_number!==season||!validId(episode.id)||episodeIndex(episode.episode_number)===null))return {error:"Season details changed. Please refresh before trying again."};
    const client=await createClient();
    const {error:parentError}=await client.from("tv_tracking").upsert({user_id:user.id,tmdb_id:id},{onConflict:"user_id,tmdb_id",ignoreDuplicates:true});
    if(parentError)return failed(parentError.code);
    // Only update identity and watched. Omitted review/rating/date fields stay intact.
    // One bulk upsert makes the episode change atomic under the existing owner RLS.
    const {error}=await client.from("tv_episode_tracking").upsert(episodes.map(episode=>({user_id:user.id,tmdb_show_id:id,season_number:season,episode_number:episode.episode_number,tmdb_episode_id:episode.id,watched:true})),{onConflict:"user_id,tmdb_show_id,season_number,episode_number"});
    if(error)return failed(error.code);
    const {error:statusError}=await markShowWatching(client,user.id,id);
    if(statusError){refresh();return failed(statusError.code);}
    count=episodes.length;
  }catch(error){return caught(error);}
  refresh();return {message:`Marked ${count} episodes watched.`};
}
export async function toggleMovieWatchlist(_:FormState,form:FormData):Promise<FormState>{
  const user=await currentUser();if(!user)return {error:"Sign in to save a watchlist."};const id=validId(form.get("tmdb_id"));
  if(!id || !["true","false"].includes(String(form.get("on_watchlist"))))return {error:"Invalid movie."};
  try{await getTitle("movie",id);const client=await createClient();const {error}=await client.from("movie_tracking").upsert({user_id:user.id,tmdb_id:id,on_watchlist:form.get("on_watchlist")==="true"},{onConflict:"user_id,tmdb_id"});if(error)return failed(error.code);}catch(error){return caught(error);}
  refresh();return {message:form.get("on_watchlist")==="true"?"Added to watchlist.":"Removed from watchlist."};
}
export async function toggleMovieWatched(_:FormState,form:FormData):Promise<FormState>{
  const user=await currentUser();if(!user)return {error:"Sign in to track a movie."};
  const id=validId(form.get("tmdb_id"));if(!id||!["true","false"].includes(String(form.get("watched"))))return {error:"Invalid movie."};
  const watched=form.get("watched")==="true";
  try{await getTitle("movie",id);const client=await createClient();
    const {data:previous,error:readError}=await client.from("movie_tracking").select("watched_on").eq("user_id",user.id).eq("tmdb_id",id).maybeSingle();if(readError)return failed(readError.code);
    const {error}=await client.from("movie_tracking").upsert({user_id:user.id,tmdb_id:id,watched,watched_on:watched?previous?.watched_on||null:null},{onConflict:"user_id,tmdb_id"});if(error)return failed(error.code);
  }catch(error){return caught(error);}
  refresh();return {message:watched?"Marked watched. Add a watch date or review whenever you like.":"Marked unwatched."};
}
export async function removeTracking(_:FormState,form:FormData):Promise<FormState>{
  const user=await currentUser();if(!user)return {error:"Sign in first."};const id=validId(form.get("tmdb_id"));const kind=form.get("kind");
  if(!id || !["movie","show","episode"].includes(String(kind)))return {error:"Invalid tracking record."};
  const client=await createClient();let query=client.from(kind==="movie"?"movie_tracking":kind==="show"?"tv_tracking":"tv_episode_tracking").delete().eq("user_id",user.id);
  if(kind==="episode"){const season=episodeIndex(form.get("season_number"),true),episode=episodeIndex(form.get("episode_number"));if(season===null || episode===null)return {error:"Invalid episode."};query=query.eq("tmdb_show_id",id).eq("season_number",season).eq("episode_number",episode);}else query=query.eq("tmdb_id",id);
  const {error}=await query;if(error)return failed(error.code);refresh();return {message:"Personal tracking removed."};
}
