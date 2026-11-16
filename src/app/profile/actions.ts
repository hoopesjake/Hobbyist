"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { FormState } from "@/components/auth/action-form";
export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const username = String(form.get("username") || "").trim().toLowerCase();
  const display_name = String(form.get("display_name") || "").trim();
  const bio = String(form.get("bio") || "").trim();
  const visibility = String(form.get("visibility"));
  if (!/^[a-z0-9_]{3,30}$/.test(username)) return { error: "Username must be 3-30 letters, numbers, or underscores." };
  if (!display_name || display_name.length > 80 || bio.length > 500 || !["public", "private"].includes(visibility)) return { error: "Enter a display name (up to 80 characters), bio (up to 500), and valid visibility." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update({ username, display_name, bio, visibility }).eq("id", user.id).select("id").single();
  if (error || !data) return { error: error?.code === "23505" ? "That username is already taken." : "Your profile could not be saved. Please try again." };
  revalidatePath("/", "layout");
  return { message: "Profile saved." };
}
