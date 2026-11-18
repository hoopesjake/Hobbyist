import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { PersonalLibrary } from "@/components/media/personal-library";
import { GameLibrary } from "@/components/games/game-library";
import { getBookLibrary } from "@/lib/books";
import { BookCard } from "@/components/books/book-card";
import { AddMediaTile, AddMediaHeaderLink } from "@/components/ui/add-media-tile";

async function HomeBooks() {
  const {entries,error}=await getBookLibrary("reading");
  if(error)return <p className="welcome-copy" role="status">{error}</p>;
  if(!entries.length)return <div className="media-empty"><p>Your next chapter starts here.</p><Link className="text-link" href="/books/discover">Find a book</Link></div>;
  return <div className="catalog-grid">{entries.slice(0,5).map(book=>{
    const pages=book.current_page>0?`${book.current_page} pages`:null;
    const percent=book.total_pages&&book.current_page?`${Math.round(book.current_page/book.total_pages*100)}%`:null;
    const meta=[pages,percent].filter(Boolean).join(" · ")||null;
    return <BookCard key={book.ol_work_id} book={{id:book.ol_work_id,work_key:book.work_key,title:book.title,authors:book.authors,cover_url:book.cover_url}} rating={book.rating} compact meta={meta} returnTo="/books/library"/>;
  })}<AddMediaTile href="/books/discover" label="Add a book"/></div>;
}
export function HomeShelf({title,href,addHref,addLabel,children}:{title:string;href:string;addHref:string;addLabel:string;children:ReactNode}) {
  return <section className="home-library-shelf"><div className="section-heading"><h3>{title}</h3><div className="heading-actions"><AddMediaHeaderLink href={addHref} label={addLabel}/><Link className="text-link" href={href}>View library</Link></div></div><Suspense fallback={<p className="welcome-copy" role="status">Loading {title.toLowerCase()}…</p>}>{children}</Suspense></section>;
}
export function LibraryOverview() {
  return <section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">ALL THE THINGS YOU LOVE</p><h2>Your libraries</h2></div></div><div className="home-library-grid">
    <HomeShelf title="Recently watched movies" href="/movies/library?filter=watched" addHref="/movies/discover" addLabel="Add a movie"><PersonalLibrary kind="movie" filter="watched" limit={5} preview compact/></HomeShelf>
    <HomeShelf title="Currently watching TV" href="/tv/library?filter=watching" addHref="/tv/discover" addLabel="Add a TV show"><PersonalLibrary kind="tv" filter="watching" limit={5} preview compact/></HomeShelf>
    <HomeShelf title="Currently playing" href="/games/library?filter=playing" addHref="/games/discover" addLabel="Add a game"><GameLibrary filter="playing" preview compact/></HomeShelf>
    <HomeShelf title="Currently reading" href="/books/library?filter=reading" addHref="/books/discover" addLabel="Add a book"><HomeBooks/></HomeShelf>
  </div></section>;
}
