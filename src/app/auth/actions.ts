"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { requireUser } from "@/lib/auth";
import type { FormState } from "@/components/auth/action-form";
function field(form: FormData, name: string) { return String(form.get(name) || ""); }
export async function authenticate(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfig()) return { error: "Authentication is not configured yet. Add the Supabase environment variables." };
  const mode = field(form, "mode");
  const email = field(form, "email").trim();
  const password = field(form, "password");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { error: "Enter a valid email address." };
  if (mode !== "reset" && (password.length < (mode === "sign-up" ? 12 : 1) || password.length > 128)) return { error: "Use a password between 12 and 128 characters when creating an account." };
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if ((mode === "reset" || mode === "sign-up") && !site) return { error: "Set NEXT_PUBLIC_SITE_URL before sending account emails." };
  if (mode === "reset") {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${site}/auth/callback?next=/auth/update-password` });
    return error ? { error: "Unable to send a reset email. Please try again later." } : { message: "If an account exists, a password reset email will arrive shortly." };
  }
  if (mode === "sign-up") {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${site}/auth/callback` } });
    if (error) return { error: "Unable to create an account. Try again later or sign in if you already registered." };
    if (!data.session) return { message: "Check your email to confirm your account, then sign in." };
  } else if (mode === "sign-in") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Sign-in failed. Check your email, password, and email confirmation." };
  } else return { error: "Invalid request." };
  revalidatePath("/", "layout");
  redirect("/");
}
export async function signOut(_: FormState): Promise<FormState> {
  void _;
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return { error: "Unable to sign out. Please try again." };
  revalidatePath("/", "layout");
  redirect("/auth/sign-in");
}
export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const password = field(form, "password");
  if (password.length < 12 || password.length > 128) return { error: "Use between 12 and 128 characters." };
  if (password !== field(form, "confirm")) return { error: "Passwords do not match." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { error: "Password could not be updated. Request a fresh reset link and try again." } : { message: "Password updated. You can return to your dashboard." };
}
