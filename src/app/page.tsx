import Link from "next/link";
import { requireUser,currentProfile } from "@/lib/auth";
import { ProfileUnavailable } from "@/components/auth/profile-unavailable";
import { PersonalLibrary } from "@/components/media/personal-library";
import { GameLibrary } from "@/components/games/game-library";
import { QuickAccess } from "@/components/dashboard/quick-access";
import { SectionHeading } from "@/components/ui/section-heading";
export default async function Home(){
  await requireUser();const profile=await currentProfile();if(!profile)return <ProfileUnavailable/>;const name=profile.display_name;
  return <div className="dashboard page-content"><header className="welcome-row"><div><p className="eyebrow">YOUR PERSONAL SPACE</p><h1>Welcome back, {name}<span>.</span></h1><p className="welcome-copy">A little time for the things you love.</p></div><Link className="profile-chip" href="/profile"><span className="avatar avatar-you">{name.slice(0,1).toUpperCase()}</span><span>Your space</span></Link></header>
    <section className="dashboard-section enjoying-section"><SectionHeading id="recent-movies" eyebrow="YOUR MOVIE DIARY" title="Recently watched movies" href="/movies/library?filter=watched" linkLabel="Watched movies"/><PersonalLibrary kind="movie" filter="watched" limit={5} preview/></section>
    <section className="dashboard-section"><SectionHeading id="watching-shows" eyebrow="PICKING UP WHERE YOU LEFT OFF" title="Currently watching TV shows" href="/tv/library?filter=watching" linkLabel="TV library"/><PersonalLibrary kind="tv" filter="watching" limit={5} preview/></section>
    <section className="dashboard-section"><SectionHeading id="playing-games" eyebrow="JUST ONE MORE QUEST" title="Currently Playing" href="/games/library?filter=playing" linkLabel="Game library"/><GameLibrary filter="playing" preview/></section><section className="dashboard-section"><SectionHeading id="completed-games" eyebrow="CREDITS ROLLED" title="Recently completed games" href="/games/library?filter=completed" linkLabel="Completed games"/><GameLibrary filter="completed" preview/></section><section className="dashboard-section"><SectionHeading id="shortcuts" eyebrow="YOUR PERSONAL SHORTCUTS" title="Quick access"/><QuickAccess/></section>
    <section className="dashboard-section"><SectionHeading id="other-interests" eyebrow="MORE OF YOUR UNIVERSE" title="Your other interests"/><div className="unconnected-interests">{[["Books","/books","Reading"],["Projects","/projects","Building"]].map(([title,href,verb])=><Link key={href} href={href}><p className="eyebrow">{verb}</p><h3>{title}</h3><p>Your personal activity will appear once this category is connected.</p></Link>)}</div></section>
  </div>;
}
