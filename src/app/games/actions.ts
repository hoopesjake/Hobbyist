"use server";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { gameId, parseGame, gameStatuses } from "@/lib/game-validation";
import { getGame, IgdbError } from "@/lib/igdb";
import type { FormState } from "@/components/auth/action-form";
function refresh(){revalidatePath("/","layout");}
const unavailable="Your game could not be saved. Please try again.";
export async function saveGame(_:FormState,form:FormData):Promise<FormState>{
 const user=await currentUser();if(!user)return {error:"Sign in to track games."};const id=gameId(form.get("igdb_id"));if(!id)return {error:"Invalid game."};
 const parsed=parseGame(form);if(parsed.error)return {error:parsed.error};
 try{const game=await getGame(id);if(parsed.game.platform_ids.some(id=>!game.platforms?.some(platform=>platform.id===id)))return {error:"Choose a platform listed for this game."};
 const client=await createClient();const {error}=await client.from("game_tracking").upsert({user_id:user.id,igdb_id:id,...parsed.game},{onConflict:"user_id,igdb_id"});if(error){console.error("Game save failed:",error.code);return {error:unavailable};}}
 catch(error){return {error:error instanceof IgdbError?error.message:unavailable};}
 refresh();return {message:"Game saved."};
}
export async function quickAddGame(_:FormState,form:FormData):Promise<FormState>{
 const user=await currentUser();if(!user)return {error:"Sign in to track games."};const id=gameId(form.get("igdb_id")),intent=String(form.get("intent"));if(!id||![...gameStatuses,"wishlist","to_be_played","want_to_play_more","favorite","library"].includes(intent))return {error:"Invalid game action."};
 const change=gameStatuses.includes(intent as typeof gameStatuses[number])?{status:intent}:intent==="library"?{}:{[intent]:true};
 try{await getGame(id);const client=await createClient();
 // Insert only when absent, then update only the selected field. Personal fields remain intact.
 const first=await client.from("game_tracking").upsert({user_id:user.id,igdb_id:id},{onConflict:"user_id,igdb_id",ignoreDuplicates:true});if(first.error)return {error:unavailable};
 if(intent!=="library"){const {error}=await client.from("game_tracking").update(change).eq("user_id",user.id).eq("igdb_id",id);if(error)return {error:unavailable};}}
 catch(error){return {error:error instanceof IgdbError?error.message:unavailable};}
 refresh();return {message:"Library updated."};
}
export async function removeGame(_:FormState,form:FormData):Promise<FormState>{
 const user=await currentUser();if(!user)return {error:"Sign in to manage games."};const id=gameId(form.get("igdb_id"));if(!id)return {error:"Invalid game."};const client=await createClient();const {error}=await client.from("game_tracking").delete().eq("user_id",user.id).eq("igdb_id",id);if(error)return {error:unavailable};refresh();return {message:"Game tracking removed."};
}
