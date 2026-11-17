import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
export const profileColumns = "id,username,display_name,bio,avatar_ref,banner_ref,created_at,visibility";
export type Profile = { id: string; username: string; display_name: string; bio: string; avatar_ref: string | null; banner_ref: string | null; created_at: string; visibility: "public" | "private" };
export const currentUser = cache(async () => {
  if (!supabaseConfig()) return null;
  // Session expiry reads the clock; keep auth out of runtime prefetches too.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});
export const currentProfile = cache(async (): Promise<Profile | null> => {
  const user = await currentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select(profileColumns).eq("id", user.id).maybeSingle();
  if (error) {
    // Log only the database error code, never credentials or account details.
    console.error("Profile lookup failed:", error.code);
    throw new Error("Your profile could not be loaded. Check the database migration and connection.");
  }
  return data;
});
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  return user;
}
