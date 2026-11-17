import { Suspense } from "react";
import { CalendarPreview } from "@/components/calendar/calendar-preview";
import Link from "next/link";
import { requireUser,currentProfile } from "@/lib/auth";
import { ProfileUnavailable } from "@/components/auth/profile-unavailable";
import { LibraryOverview } from "@/components/dashboard/library-overview";
import { QuickAccess } from "@/components/dashboard/quick-access";
import { SectionHeading } from "@/components/ui/section-heading";
export default async function Home(){
  await requireUser();const profile=await currentProfile();if(!profile)return <ProfileUnavailable/>;const name=profile.display_name;
  return <div className="dashboard page-content"><header className="welcome-row"><div><p className="eyebrow">YOUR PERSONAL SPACE</p><h1>Welcome back, {name}<span>.</span></h1><p className="welcome-copy">A little time for the things you love.</p></div><Link className="profile-chip" href="/profile"><span className="avatar avatar-you">{name.slice(0,1).toUpperCase()}</span><span>Your space</span></Link></header>
    <Suspense fallback={<section className="dashboard-section" aria-label="Loading calendar"><p className="welcome-copy">Loading your calendar...</p></section>}><CalendarPreview/></Suspense>
    <LibraryOverview/>
    <section className="dashboard-section"><SectionHeading id="shortcuts" eyebrow="YOUR PERSONAL SHORTCUTS" title="Quick access"/><QuickAccess/></section>
    <section className="dashboard-section"><SectionHeading id="other-interests" eyebrow="MORE OF YOUR UNIVERSE" title="Your other interests"/><div className="unconnected-interests">{[["Podcasts","/podcasts","Listening"],["Music","/music","Listening"],["Projects & collections","/projects","Creating"]].map(([title,href,verb])=><Link key={href} href={href}><p className="eyebrow">{verb}</p><h3>{title}</h3><p>Room for what comes next.</p></Link>)}</div></section>
  </div>;
}
