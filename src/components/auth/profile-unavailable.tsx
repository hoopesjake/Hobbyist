import Link from "next/link";
import { ActionForm } from "@/components/auth/action-form";
import { signOut } from "@/app/auth/actions";

export function ProfileUnavailable() {
  return (
    <div className="account-page">
      <p className="eyebrow">YOUR HOBBYIST ACCOUNT</p>
      <h1>Your profile is not available yet</h1>
      <p>You are signed in, but we could not find your profile. If this continues, contact the app administrator to restore your profile.</p>
      <nav className="account-links"><Link href="/profile">Try again</Link></nav>
      <ActionForm action={signOut} label="Sign out" />
    </div>
  );
}
