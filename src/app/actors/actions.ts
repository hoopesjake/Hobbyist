"use server";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/media-validation";
import { getPerson,TmdbError } from "@/lib/tmdb";
import type { FormState } from "@/components/auth/action-form";
export async function followActor(_:FormState,form:FormData):Promise<FormState>{
  const user=await currentUser();if(!user)return {error:"Sign in to follow actors."};
  const id=validId(form.get("tmdb_person_id")),intent=form.get("intent");if(!id||!["follow","unfollow"].includes(String(intent)))return {error:"Invalid actor."};
  const client=await createClient();
  try{
    const result=intent==="unfollow"?await client.from("actor_follows").delete().eq("user_id",user.id).eq("tmdb_person_id",id):await (async()=>{const actor=await getPerson(id);return client.from("actor_follows").upsert({user_id:user.id,tmdb_person_id:id,name:actor.name,profile_path:actor.profile_path},{onConflict:"user_id,tmdb_person_id",ignoreDuplicates:true});})();
    if(result.error){console.error("Actor follow write failed:",result.error.code);return {error:"Your actor follows could not be updated. Please try again later."};}
  }catch(error){return {error:error instanceof TmdbError?error.message:"This actor could not be followed. Please try again."};}
  revalidatePath("/","layout");return {message:intent==="follow"?"Actor followed.":"Actor unfollowed."};
}
