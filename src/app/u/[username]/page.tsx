import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
export default async function PublicProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (!/^[a-z0-9_]{3,30}$/.test(username) || !supabaseConfig()) notFound();
  const supabase = await createClient();
  // Explicit public projection; no private preferences or auth identity fields.
  const { data: profile, error } = await supabase.from("profiles").select("username,display_name,bio,created_at").eq("username", username).maybeSingle();
  if (error) throw new Error("Profile lookup failed.");
  if (!profile) notFound();
  return <div className="account-page"><p className="eyebrow">HOBBYIST PROFILE</p><span className="avatar avatar-you">{profile.display_name.slice(0, 1).toUpperCase()}</span><h1>{profile.display_name}</h1><p>@{profile.username}</p><p className="profile-bio">{profile.bio || "A little space for everything they love."}</p><p className="welcome-copy">Member since {new Date(profile.created_at).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" })}</p></div>;
}
