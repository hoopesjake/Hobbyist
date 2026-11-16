"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Aperture } from "lucide-react";
import { navigationItems } from "@/lib/navigation";

export function Sidebar({ name }: { name: string }) {
  const pathname = usePathname();
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <Link className="brand" href="/" aria-label="Hobbyist home"><span className="brand-mark"><Aperture size={17} strokeWidth={2.2} /></span><span className="brand-name">hobbyist</span></Link>
      <span className="sidebar-label">YOUR UNIVERSE</span>
      <nav className="primary-nav">
        {navigationItems.map(({ label, href, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return <Link className="nav-link" key={href} href={href} aria-current={active ? "page" : undefined}><Icon size={17} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span></Link>;
        })}
      </nav>
      <div className="sidebar-footer"><span className="avatar avatar-you" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span><div className="sidebar-user"><strong>{name}</strong><span>Personal space</span></div></div>
    </aside>
  );
}