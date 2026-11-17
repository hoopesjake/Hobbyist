import { currentProfile, currentUser } from "@/lib/auth";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Aperture, Tv, Clapperboard, Gamepad2, MoreHorizontal, CalendarDays } from "lucide-react";
import { navigationItems } from "@/lib/navigation";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export async function AppShell({ children }: { children: ReactNode }) {
  const user = await currentUser();
  const profile = await currentProfile();
  const name = profile?.display_name || (user ? "Hobbyist" : "Guest");
  return (
    <div className="app-shell">
      <Suspense fallback={<SidebarFallback />}><Sidebar name={name} /></Suspense>
      <div className="content-frame"><Topbar name={name} authenticated={!!user} /><main className="main-content">{children}</main></div>
      <Suspense fallback={<MobileNavigationFallback />}><MobileNavigation /></Suspense>
    </div>
  );
}

function SidebarFallback() {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <Link className="brand" href="/" aria-label="Hobbyist home"><span className="brand-mark"><Aperture size={17} /></span><span className="brand-name">hobbyist</span></Link>
      <span className="sidebar-label">YOUR UNIVERSE</span>
      <nav className="primary-nav">{navigationItems.map(({ label, href, icon: Icon }) => <Link className="nav-link" key={href} href={href}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></Link>)}</nav>
      <div className="sidebar-footer"><span className="avatar avatar-you" aria-hidden="true">H</span><div className="sidebar-user"><strong>Your space</strong><span>Personal space</span></div></div>
    </aside>
  );
}

function MobileNavigationFallback() {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <Link className="mobile-nav-item" href="/"><Aperture size={19} /><span>Home</span></Link>
      <Link className="mobile-nav-item" href="/calendar"><CalendarDays size={19}/><span>Calendar</span></Link>
      <Link className="mobile-nav-item" href="/movies"><Clapperboard size={19} /><span>Movies</span></Link>
      <Link className="mobile-nav-item" href="/games"><Gamepad2 size={19} /><span>Games</span></Link>
      <Link className="mobile-nav-item" href="/tv"><Tv size={19} /><span>TV Shows</span></Link>
      <Link className="mobile-nav-item" href="/music"><MoreHorizontal size={19} /><span>More</span></Link>
    </nav>
  );
}