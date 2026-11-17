import Link from "next/link";
import { NavigationTabs } from "@/components/layout/navigation-tabs";
export const metadata = { title: "My Lists" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="page-content media-page"><header className="movies-header"><div><p className="eyebrow">YOUR OWN DOUBLE FEATURES</p><Link href="/lists"><h1>My Lists</h1></Link></div><NavigationTabs label="Lists navigation" fallbackHref="/lists" tabs={[{ href: "/lists", label: "View lists" }, { href: "/lists/new", label: "Create new list" }]}/></header>{children}</div>;
}
