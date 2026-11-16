"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Aperture, Bell, ChevronRight, Search } from "lucide-react";
import { navigationItems, quickLinks } from "@/lib/navigation";

const searchEntries = [
  ...navigationItems.map(({ label, href, keywords }) => ({ label, href, keywords, type: "Explore" })),
  ...quickLinks.map(({ label, href, subtitle }) => ({ label, href, keywords: [subtitle], type: "Shortcut" })),
];

export function Topbar({ name, authenticated }: { name: string; authenticated: boolean }) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return searchEntries.filter((entry) => `${entry.label} ${entry.keywords.join(" ")}`.toLowerCase().includes(term)).slice(0, 6);
  }, [query]);

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  return (
    <header className="topbar">
      <Link className="topbar-brand" href="/" aria-label="Hobbyist home"><span className="brand-mark"><Aperture size={15} strokeWidth={2.2} /></span><span className="brand-name">hobbyist</span></Link>
      <div className="search-wrap">
        <form className="search-form" role="search" onSubmit={(event) => event.preventDefault()}>
          <Search size={16} aria-hidden="true" />
          <input ref={searchInput} type="search" aria-label="Search Hobbyist" aria-autocomplete="list" aria-controls="search-results" placeholder="Search your hobbies..." value={query} onFocus={() => setSearchOpen(true)} onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); }} />
          <span className="search-shortcut" aria-hidden="true">⌘ K</span>
        </form>
        {searchOpen && query.trim() && <div className="search-results" id="search-results" role="listbox" aria-label="Search suggestions"><div className="popover-label">Quick destinations</div>{results.length ? results.map((result) => <Link className="search-result" key={`${result.href}-${result.label}`} href={result.href} onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(""); setSearchOpen(false); }}><span>{result.label}</span><span>{result.type}</span></Link>) : <div className="empty-search">No sections found for “{query}”.</div>}{[["/movies", "Movies"], ["/tv", "TV Shows"], ["/actors", "Actors"]].map(([href, label]) => <Link className="search-result" key={href} href={`${href}/discover?q=${encodeURIComponent(query.trim())}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(""); setSearchOpen(false); }}><span>Search {label}</span><span>Live catalog</span></Link>)}</div>}
      </div>
      <div className="topbar-actions">
        <div className="search-wrap notification-wrap">
          <button className="icon-button" type="button" aria-label="Notifications" aria-expanded={notificationsOpen} aria-controls="notification-panel" onClick={() => { setNotificationsOpen((open) => !open); setSearchOpen(false); }}><Bell size={18} strokeWidth={1.8} /><span className="notification-dot" aria-hidden="true" /></button>
          {notificationsOpen && <section className="notification-panel" id="notification-panel" aria-label="Notifications"><div className="popover-label">A little activity</div><div className="notification-item">Jamie started a new reading list.<span>2 hours ago</span></div><div className="notification-item">Riley added a new favorite.<span>Yesterday</span></div><Link className="notification-link" href="/community" onClick={() => setNotificationsOpen(false)}>Visit your community <ChevronRight size={14} /></Link></section>}
        </div>
        <Link className="topbar-profile" href={authenticated ? "/profile" : "/auth/sign-in"} aria-label={authenticated ? "Open your profile" : "Sign in"}><span className="avatar avatar-you" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span><span>{authenticated ? name : "Sign in"}</span></Link>
      </div>
    </header>
  );
}