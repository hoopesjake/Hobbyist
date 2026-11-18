import { ProfileUnavailable } from "@/components/auth/profile-unavailable";
import Link from "next/link";
import { requireUser, currentProfile } from "@/lib/auth";
import { ActionForm } from "@/components/auth/action-form";
import { saveProfile } from "./actions";
import { signOut } from "@/app/auth/actions";
import { getFavoritesByCategory, favoriteCategories } from "@/lib/favorites";
import { FavoritesManager } from "@/components/profile/favorites-manager";
export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, favoritesResult] = await Promise.all([currentProfile(), getFavoritesByCategory(user.id)]);
  if (!profile) return <ProfileUnavailable />;
  return <div className="account-page">
    <p className="eyebrow">YOUR PERSONAL SPACE</p>
    <div className="profile-identity"><span className="avatar avatar-you profile-avatar">{profile.display_name.slice(0, 1).toUpperCase()}</span><div><h1>{profile.display_name}</h1><span className="profile-handle">@{profile.username}</span></div></div>
    {favoritesResult.error ? <p role="status" className="calendar-error">{favoritesResult.error}</p> : <div className="favorites-sections">{favoriteCategories.map(category => <FavoritesManager key={category} category={category} favorites={favoritesResult.favorites[category]}/>)}</div>}
    <details className="list-settings"><summary>Edit profile details</summary><div className="list-editor">
    <ActionForm action={saveProfile} label="Save profile"><label>Username<input name="username" defaultValue={profile.username} pattern="[a-zA-Z0-9_]{3,30}" minLength={3} maxLength={30} required /></label><label>Display name<input name="display_name" defaultValue={profile.display_name} maxLength={80} required /></label><label>Bio<textarea name="bio" defaultValue={profile.bio} maxLength={500} rows={4} /></label><label>Profile visibility<select name="visibility" defaultValue={profile.visibility}><option value="private">Private - only you</option><option value="public">Public - anyone with the link</option></select></label></ActionForm>
    </div></details>
    <nav className="account-links"><Link href={`/u/${profile.username}`}>View public profile</Link><Link href="/auth/update-password">Change password</Link><Link href="/">Dashboard</Link></nav>
    <ActionForm action={signOut} label="Sign out" />
  </div>;
}
