"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tv, Clapperboard, Gamepad2, House, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { navigationItems } from "@/lib/navigation";

const primaryItems = [{ label: "Home", href: "/", icon: House }, { label: "Movies", href: "/movies", icon: Clapperboard }, { label: "TV Shows", href: "/tv", icon: Tv }, { label: "Games", href: "/games", icon: Gamepad2 }];

export function MobileNavigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const moreItems = navigationItems.filter(({ href }) => !primaryItems.some((item) => item.href === href));
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {primaryItems.map(({ label, href, icon: Icon }) => { const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`); return <Link className="mobile-nav-item" key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)}><Icon size={19} strokeWidth={1.8} /><span>{label}</span></Link>; })}
      <button className="mobile-nav-item" type="button" aria-expanded={menuOpen} aria-controls="mobile-more-menu" onClick={() => setMenuOpen((open) => !open)}><MoreHorizontal size={19} strokeWidth={1.8} /><span>More</span></button>
      {menuOpen && <div className="mobile-more-panel" id="mobile-more-menu">{moreItems.map(({ label, href, icon: Icon }) => <Link className="nav-link" key={href} href={href} onClick={() => setMenuOpen(false)}><Icon size={16} /><span>{label}</span></Link>)}</div>}
    </nav>
  );
}