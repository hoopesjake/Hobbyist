import Link from "next/link";
import { Suspense } from "react";
import { currentUser } from "@/lib/auth";
import { searchBooks, getBooksBySubject, bookGenres, isBookGenre, BookCatalogError } from "@/lib/open-library";
import { BookCard } from "@/components/books/book-card";
import { BackLink } from "@/components/layout/back-link";
type BooksPageProps = { searchParams: Promise<{ q?: string; page?: string; from?: string; genre?: string }> };
export default function BooksPage(props: BooksPageProps) {
  return <Suspense fallback={<p role="status" className="media-empty">Loading books…</p>}><BookSearch {...props}/></Suspense>;
}
async function BookSearch({ searchParams }: BooksPageProps) {
  const params = await searchParams, q = typeof params.q === "string" ? params.q.trim().slice(0,200) : "", page = Math.max(1,Math.min(100,Number(params.page)||1));
  const fromHome = params.from === "home";
  const genre = isBookGenre(params.genre) ? params.genre : undefined;
  const extra = (p: number) => ({ q, page: String(p), ...(fromHome ? { from: "home" } : {}), ...(genre ? { genre } : {}) });
  let result: { books: Awaited<ReturnType<typeof searchBooks>>["books"]; hasMore: boolean } = { books:[],hasMore:false }, error = "";
  try {
    if (q.length >= 2) result = await searchBooks(q,page,genre);
    else if (genre) result = await getBooksBySubject(genre,page);
  } catch (cause) { error = cause instanceof BookCatalogError || cause instanceof Error ? cause.message || "Book search is unavailable." : "Book search is unavailable."; }
  const browsing = q.length < 2 && !!genre;
  const user = await currentUser();
  const genreName = genre ? bookGenres.find(entry => entry.slug === genre)?.name : undefined;
  return <>
    {fromHome && <BackLink href="/" className="discovery-return-home">Return Home</BackLink>}
    <form key={`${q}-${genre || ""}`} action="/books/discover" className="catalog-search" role="search">
      <label className="sr-only" htmlFor="book-search">Search books</label><input id="book-search" name="q" type="search" maxLength={200} defaultValue={q} placeholder="Search book titles…"/>
      {fromHome && <input type="hidden" name="from" value="home"/>}
      <label className="sr-only" htmlFor="book-genre">Genre</label><select id="book-genre" name="genre" defaultValue={genre || ""}><option value="">All genres</option>{bookGenres.map(entry => <option key={entry.slug} value={entry.slug}>{entry.name}</option>)}</select>
      <button className="account-button">Search</button>
    </form>
    {error ? <p role="status" className="calendar-error">{error}</p> : (q.length < 2 && !genre) ? <section className="media-empty"><h2>Find your next great read.</h2><p>Search by title or author, or pick a genre to browse.</p></section> : result.books.length ? <>
      <div className="section-heading"><h2>{browsing ? `${genreName} books` : q ? `Results for "${q}"` : "Books"}</h2><Link className="text-link" href={`/books/discover${fromHome ? "?from=home" : ""}`}>Clear filters</Link></div>
      <div className="catalog-grid">{result.books.map(book => <BookCard key={book.id} book={book} returnTo={`/books/discover?${new URLSearchParams(extra(page))}`} quick={!!user}/>)}</div>
    </> : <p className="media-empty">No matching books found.</p>}
    {!error && (q.length >= 2 || genre) && result.books.length > 0 && <nav className="catalog-pagination" aria-label="Book search pages">{page > 1 && <Link href={`/books/discover?${new URLSearchParams(extra(page-1))}`}>Previous</Link>}<span>Page {page}</span>{result.hasMore && <Link href={`/books/discover?${new URLSearchParams(extra(page+1))}`}>Next</Link>}</nav>}
  </>;
}
