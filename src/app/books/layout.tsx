import Link from "next/link";
import { NavigationTabs } from "@/components/layout/navigation-tabs";
export const metadata = { title: "Books" };
export default function BooksLayout({ children }: { children: React.ReactNode }) {
  return <div className="page-content media-page"><header className="movies-header"><div><p className="eyebrow">A LITTLE TIME BETWEEN THE PAGES</p><Link href="/books"><h1>Books</h1></Link></div><NavigationTabs label="Books navigation" tabs={[{ href:"/books",label:"Dashboard" },{ href:"/books/discover",label:"Discover" },{ href:"/books/library",label:"My library" },{ href:"/books/statistics",label:"Statistics" }]}/></header>{children}<footer className="tmdb-credit">Book data and covers from <a className="text-link" href="https://openlibrary.org" target="_blank" rel="noreferrer">Open Library</a>. Your Hobbyist ratings use half-stars out of five.</footer></div>;
}
