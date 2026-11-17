import "server-only";
import { cache } from "react";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { GameStatus } from "@/lib/game-validation";
export type GameTracking = { id:string;user_id:string;igdb_id:number;status:GameStatus|null;owned:boolean|null;platform_ids:number[];manual_playtime_minutes:number|null;progress:number|null;started_on:string|null;completed_on:string|null;last_played_on:string|null;rating:number|null;review:string;contains_spoilers:boolean;wishlist:boolean;to_be_played:boolean;want_to_play_more:boolean;favorite:boolean;updated_at:string };
const unavailable="Your game library is temporarily unavailable. Please try again later.";
export const getGameTracking=cache(async(id:number)=>{
 const user=await currentUser();if(!user)return {entry:null,error:null};
 const client=await createClient();const {data,error}=await client.from("game_tracking").select("*").eq("user_id",user.id).eq("igdb_id",id).maybeSingle();
 if(error){console.error("Game tracking lookup:",error.code);return {entry:null,error:unavailable};}
 return {entry:data as GameTracking|null,error:null};
});
export const getGameHistory=cache(async()=>{
 const user=await currentUser();const entries:GameTracking[]=[];if(!user)return {entries,error:null};const client=await createClient();
 for(let offset=0;;offset+=500){const {data,error}=await client.from("game_tracking").select("*").eq("user_id",user.id).order("igdb_id").range(offset,offset+499);
 if(error){console.error("Game history lookup:",error.code);return {entries:[] as GameTracking[],error:unavailable};}entries.push(...data as GameTracking[]);if(data.length<500)break;}
 return {entries,error:null};
});
export const getGameLibrary=cache(async(filter="all",page=1,limit=20)=>{
 const user=await currentUser();if(!user)return {entries:[] as GameTracking[],total:0,error:null};const client=await createClient();let query=client.from("game_tracking").select("*",{count:"exact"}).eq("user_id",user.id);
 if(["playing","completed","backlog","paused","dropped"].includes(filter))query=query.eq("status",filter);
 else if(["wishlist","to_be_played","want_to_play_more","owned","favorites"].includes(filter))query=query.eq(filter==="favorites"?"favorite":filter,true);
 if(filter==="completed")query=query.order("completed_on",{ascending:false,nullsFirst:false});
 const {data,count,error}=await query.order("updated_at",{ascending:false}).order("igdb_id").range((page-1)*limit,page*limit-1);
 if(error){console.error("Game library lookup:",error.code);return {entries:[] as GameTracking[],total:0,error:unavailable};}return {entries:data as GameTracking[],total:count||0,error:null};
});
