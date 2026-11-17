import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentUser } from "@/lib/auth";
import { getBook, getBookEditions, getBookEdition, openLibraryWorkId, BookCatalogError, type BookDetails } from "@/lib/open-library";
import { getBookTracking } from "@/lib/books";
import { BackLink } from "@/components/layout/back-link";
import { MediaImage } from "@/components/movies/media-image";
import { BookTrackingForm } from "@/components/books/book-tracking-form";
import { MediaActivity } from "@/components/calendar/media-activity";
import Link from "next/link";
import { bookReturnTo } from "@/lib/book-navigation";
import { BookDescription } from "@/components/books/book-description";

type BookPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ editions?: string; returnTo?: string }> };
export default function BookPage(props: BookPageProps) {
  return <Suspense fallback={<p role="status" className="media-empty">Loading book…</p>}><BookDetailsContent {...props}/></Suspense>;
}
async function BookDetailsContent({ params, searchParams }: BookPageProps) {
  const id = openLibraryWorkId((await params).id); if (!id) notFound();
  const [user,saved] = await Promise.all([currentUser(),getBookTracking(id)]);
  let book: BookDetails, offline = false;
  try { book = await getBook(id); } catch (cause) {
    if (!saved.entry) { if (cause instanceof BookCatalogError && cause.status===404) notFound(); throw cause; }
    book = {id,work_key:saved.entry.work_key,title:saved.entry.title,authors:saved.entry.authors,cover_url:saved.entry.cover_url,description:"",subjects:[]}; offline = true;
  }
  const urlParams = await searchParams;
  const returnTo = bookReturnTo(urlParams.returnTo);
  const editionHref = (page: number) => `?${new URLSearchParams({ editions: String(page), returnTo })}`;
  const editionPage = Math.max(1, Math.min(100, Number(urlParams.editions)||1));
  let editionResult: Awaited<ReturnType<typeof getBookEditions>> = {editions:[],hasMore:false};
  try { editionResult = await getBookEditions(id,editionPage); } catch { /* Existing library records remain usable during provider outages. */ }
  if (book.default_edition_id && !editionResult.editions.some(edition => edition.id === book.default_edition_id)) {
    try { editionResult.editions.unshift(await getBookEdition(id, book.default_edition_id)); } catch { /* Keep other edition choices available. */ }
  }
  return <><BackLink href={returnTo}>{returnTo.startsWith("/books/library") ? "Back to my library" : returnTo.includes("?") ? "Back to results" : "Back to books"}</BackLink>{offline && <p role="status" className="welcome-copy">Catalog details are unavailable. Your saved reading record remains available.</p>}<div className="title-detail"><div className="detail-poster-column"><div className="detail-poster">{book.cover_url ? <MediaImage src={book.cover_url} alt={`${book.title} cover`} width={342} height={513} sizes="230px"/> : <span className="poster-fallback">Cover unavailable</span>}</div></div><div><p className="eyebrow">BOOK</p><h2 className="detail-title">{book.title}</h2><p className="title-meta">{book.authors.join(", ") || "Author not listed"}</p><BookDescription description={book.description} tagline={book.tagline}/><a className="text-link" href={`https://openlibrary.org${book.work_key}`} target="_blank" rel="noreferrer">View on Open Library</a></div></div>{saved.error && <p className="calendar-error" role="status">{saved.error}</p>}{user ? <div className="book-reading-controls"><BookTrackingForm key={saved.entry?.updated_at || `new-${id}`} id={id} entry={saved.entry} editions={editionResult.editions} defaultEditionId={book.default_edition_id} unavailable={!!saved.error}/><nav className="catalog-pagination" aria-label="Edition pages">{editionPage>1 && <Link href={editionHref(editionPage-1)}>Previous editions</Link>}{editionResult.hasMore && <Link href={editionHref(editionPage+1)}>More editions</Link>}</nav><MediaActivity type="book" id={id} title={book.title} image={book.cover_url}/></div> : <Link className="account-button book-sign-in" href="/auth/sign-in">Sign in to save and plan reading</Link>}</>;
}
