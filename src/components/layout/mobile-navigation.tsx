"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tv, Clapperboard, Gamepad2, House, MoreHorizontal, CalendarDays, BookOpen } from "lucide-react";
import { useState } from "react";
import { navigationItems } from "@/lib/navigation";

// Calendar sits in the physical middle of this list so it lands in the center nav slot.
const primaryItems = [
  { label: "Home", href: "/", icon: House },
  { label: "Movies", href: "/movies", icon: Clapperboard },
  { label: "TV", href: "/tv", icon: Tv },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Games", href: "/games", icon: Gamepad2 },
  { label: "Books", href: "/books", icon: BookOpen },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNavigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const moreItems = navigationItems.filter(({ href }) => !primaryItems.some((item) => item.href === href));
  const moreActive = moreItems.some(({ href }) => isActive(pathname, href));
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {primaryItems.map(({ label, href, icon: Icon }) => {
        const active = isActive(pathname, href);
        if (href === "/calendar") {
          return (
            <Link className="mobile-nav-item mobile-nav-calendar" key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)}>
              <span className="mobile-nav-calendar-bubble"><Icon size={23} strokeWidth={1.9} /></span>
              <span>{label}</span>
            </Link>
          );
        }
        return (
          <Link className="mobile-nav-item" key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)}>
            <Icon size={19} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
      <button className="mobile-nav-item" type="button" aria-expanded={menuOpen} aria-current={moreActive ? "page" : undefined} aria-controls="mobile-more-menu" onClick={() => setMenuOpen((open) => !open)}>
        <MoreHorizontal size={19} strokeWidth={1.8} />
        <span>More</span>
      </button>
      {menuOpen && <div className="mobile-more-panel" id="mobile-more-menu">{moreItems.map(({ label, href, icon: Icon }) => <Link className="nav-link" key={href} href={href} onClick={() => setMenuOpen(false)}><Icon size={16} /><span>{label}</span></Link>)}</div>}
    </nav>
  );
}
