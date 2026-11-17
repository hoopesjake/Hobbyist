"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Tab = { href: string; label: string };
type Props = { tabs: Tab[]; label: string; fallbackHref?: string };

function Tabs({ tabs, label, fallbackHref }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const matches = tabs.filter(tab => {
    const [path, query] = tab.href.split("?");
    return path === pathname && [...new URLSearchParams(query)].every(([key, value]) => searchParams.get(key) === value);
  });
  // A filtered destination takes precedence over the general library tab.
  const active = matches.find(tab => tab.href.includes("?")) || matches[0];
  return <nav className="account-links navigation-tabs" aria-label={label}>{tabs.map(tab => <Link key={tab.href} href={tab.href} aria-current={(active?.href || fallbackHref) === tab.href ? "page" : undefined}>{tab.label}</Link>)}</nav>;
}

export function NavigationTabs(props: Props) {
  return <Suspense fallback={<nav className="account-links navigation-tabs" aria-label={props.label}>{props.tabs.map(tab => <Link key={tab.href} href={tab.href}>{tab.label}</Link>)}</nav>}><Tabs {...props}/></Suspense>;
}
