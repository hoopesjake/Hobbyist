import Link from "next/link";
import { notFound } from "next/navigation";
import { authenticate, updatePassword } from "@/app/auth/actions";
import { ActionForm } from "@/components/auth/action-form";
import { requireUser } from "@/lib/auth";
const titles: Record<string, string> = { "sign-in": "Welcome back", "sign-up": "Make yourself at home", reset: "Reset your password", "update-password": "Choose a new password" };
export default async function AuthPage({ params, searchParams }: { params: Promise<{ mode: string }>; searchParams: Promise<{ error?: string }> }) {
  const { mode } = await params;
  if (!titles[mode]) notFound();
  if (mode === "update-password") await requireUser();
  const { error } = await searchParams;
  return <div className="account-page"><p className="eyebrow">YOUR HOBBYIST ACCOUNT</p><h1>{titles[mode]}</h1>{error && <p role="alert">This email link is invalid or expired. Request a fresh link below.</p>}<ActionForm action={mode === "update-password" ? updatePassword : authenticate} label={mode === "reset" ? "Send reset email" : mode === "sign-up" ? "Create account" : mode === "update-password" ? "Save password" : "Sign in"}><input type="hidden" name="mode" value={mode} />{mode !== "update-password" && <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>}{mode !== "reset" && <label>Password<input name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={mode === "sign-in" ? 1 : 12} maxLength={128} required /></label>}{mode === "update-password" && <label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>}</ActionForm><nav className="account-links"><Link href="/auth/sign-in">Sign in</Link><Link href="/auth/sign-up">Create account</Link><Link href="/auth/reset">Forgot password?</Link><Link href="/">Dashboard</Link></nav></div>;
}
