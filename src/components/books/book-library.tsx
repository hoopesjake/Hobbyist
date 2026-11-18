import Link from "next/link";
import { getBookLibrary } from "@/lib/books";
import { readingStatuses } from "@/lib/book-validation";
import { BookCard } from "./book-card";
import { AddMediaTile } from "@/components/ui/add-media-tile";
export async function BookLibrary({ filter = "all", page = 1 }: { filter?: string; page?: number }) {
  const result = await getBookLibrary(filter, page);
  if (result.error) return <p role="status" className="calendar-error">{result.error}</p>;
  if (!result.entries.length) return <section className="media-empty"><h3>Your next great book starts here.</h3><Link className="text-link" href="/books/discover">Find a book</Link></section>;
  return <><div className="catalog-grid">{result.entries.map(e => <BookCard key={e.ol_work_id} book={{ id:e.ol_work_id, work_key:e.work_key, title:e.title, authors:e.authors, cover_url:e.cover_url }} returnTo={`/books/library?${new URLSearchParams({status:filter,page:String(page)})}`} rating={e.rating} note={`${readingStatuses[e.effective_status]} · ${e.current_page}${e.total_pages ? ` / ${e.total_pages}` : ""} pages`}/>)}<AddMediaTile href="/books/discover" label="Add a book"/></div><nav className="catalog-pagination" aria-label="Reading library pages">{page > 1 && <Link href={`?status=${filter}&page=${page-1}`}>Previous</Link>}<span>Page {page}</span>{page * 20 < result.total && <Link href={`?status=${filter}&page=${page+1}`}>Next</Link>}</nav></>;
}
