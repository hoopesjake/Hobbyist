import { ProfileUnavailable } from "@/components/auth/profile-unavailable";
import Link from "next/link";
import { requireUser, currentProfile } from "@/lib/auth";
import { ActionForm } from "@/components/auth/action-form";
import { saveProfile } from "./actions";
import { signOut } from "@/app/auth/actions";
export default async function ProfilePage() {
  await requireUser();
  const profile = await currentProfile();
  if (!profile) return <ProfileUnavailable />;
  return <div className="account-page"><p className="eyebrow">YOUR PERSONAL SPACE</p><h1>Edit your profile</h1><p>Member since {new Date(profile.created_at).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" })}</p><ActionForm action={saveProfile} label="Save profile"><label>Username<input name="username" defaultValue={profile.username} pattern="[a-zA-Z0-9_]{3,30}" minLength={3} maxLength={30} required /></label><label>Display name<input name="display_name" defaultValue={profile.display_name} maxLength={80} required /></label><label>Bio<textarea name="bio" defaultValue={profile.bio} maxLength={500} rows={4} /></label><label>Profile visibility<select name="visibility" defaultValue={profile.visibility}><option value="private">Private - only you</option><option value="public">Public - anyone with the link</option></select></label><p className="welcome-copy">Avatar, banner, favorites, and customization controls are coming in a future phase.</p></ActionForm><nav className="account-links"><Link href={`/u/${profile.username}`}>View profile</Link><Link href="/auth/update-password">Change password</Link><Link href="/">Dashboard</Link></nav><ActionForm action={signOut} label="Sign out" /></div>;
}
