"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
export function ListMenu() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    function dismiss(event: PointerEvent) { if (!container.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  return <div className="list-menu" ref={container} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); container.current?.querySelector("button")?.focus(); } }}>
    <button type="button" className="list-menu-trigger" aria-expanded={open} aria-controls="my-lists-menu" aria-current={pathname.startsWith("/lists") ? "page" : undefined} onClick={() => setOpen(value => !value)}>My Lists</button>
    {open && <nav id="my-lists-menu" className="list-menu-panel" aria-label="My lists"><Link href="/lists" onClick={() => setOpen(false)}>View lists</Link><Link href="/lists/new" onClick={() => setOpen(false)}>Create new list</Link></nav>}
  </div>;
}
