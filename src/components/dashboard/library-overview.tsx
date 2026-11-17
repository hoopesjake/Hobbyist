import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { PersonalLibrary } from "@/components/media/personal-library";
import { GameLibrary } from "@/components/games/game-library";
import { getBookLibrary } from "@/lib/books";
import { BookCard } from "@/components/books/book-card";

async function HomeBooks() {
  const {entries,error}=await getBookLibrary();
  if(error)return <p className="welcome-copy" role="status">{error}</p>;
  if(!entries.length)return <div className="media-empty"><p>Your next chapter starts here.</p><Link className="text-link" href="/books/discover">Find a book</Link></div>;
  return <div className="catalog-grid">{entries.slice(0,5).map(book=><BookCard key={book.ol_work_id} book={{id:book.ol_work_id,work_key:book.work_key,title:book.title,authors:book.authors,cover_url:book.cover_url}} rating={book.rating} note={book.effective_status==="finished"?"Finished":book.effective_status==="reading"?"Currently reading":"Want to Read"} returnTo="/books/library"/>)}</div>;
}
export function HomeShelf({title,href,children}:{title:string;href:string;children:ReactNode}) {
  return <section className="home-library-shelf"><div className="section-heading"><h3>{title}</h3><Link className="text-link" href={href}>View library</Link></div><Suspense fallback={<p className="welcome-copy" role="status">Loading {title.toLowerCase()}…</p>}>{children}</Suspense></section>;
}
export function LibraryOverview() {
  return <section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">ALL THE THINGS YOU LOVE</p><h2>Your libraries</h2></div></div><div className="home-library-grid">
    <HomeShelf title="Books" href="/books/library"><HomeBooks/></HomeShelf>
    <HomeShelf title="Movies" href="/movies/library"><PersonalLibrary kind="movie" filter="all" limit={5} preview/></HomeShelf>
    <HomeShelf title="TV shows" href="/tv/library"><PersonalLibrary kind="tv" filter="all" limit={5} preview/></HomeShelf>
    <HomeShelf title="Games" href="/games/library"><GameLibrary filter="all" preview/></HomeShelf>
  </div></section>;
}
