import Link from "next/link";
import { Suspense } from "react";
import { searchBooks } from "@/lib/open-library";
import { BookCard } from "@/components/books/book-card";
type BooksPageProps = { searchParams: Promise<{ q?: string; page?: string }> };
export default function BooksPage(props: BooksPageProps) {
  return <Suspense fallback={<p role="status" className="media-empty">Loading books…</p>}><BookSearch {...props}/></Suspense>;
}
async function BookSearch({ searchParams }: BooksPageProps) {
  const params = await searchParams, q = typeof params.q === "string" ? params.q.trim().slice(0,200) : "", page = Math.max(1,Math.min(100,Number(params.page)||1));
  let result: Awaited<ReturnType<typeof searchBooks>> = { books:[],hasMore:false }, error = "";
  if (q.length >= 2) { try { result = await searchBooks(q,page); } catch (cause) { error = cause instanceof Error ? cause.message : "Book search is unavailable."; } }
  return <><form key={q} action="/books/discover" className="catalog-search" role="search"><label className="sr-only" htmlFor="book-search">Search books</label><input id="book-search" name="q" type="search" maxLength={200} defaultValue={q} placeholder="Search book titles…"/><button className="account-button">Search</button></form>{error ? <p role="status" className="calendar-error">{error}</p> : q.length < 2 ? <section className="media-empty"><h2>Find your next great read.</h2><p>Search by title or author.</p></section> : result.books.length ? <div className="catalog-grid">{result.books.map(book => <BookCard key={book.id} book={book} returnTo={`/books/discover?${new URLSearchParams({q,page:String(page)})}`}/>)}</div> : <p className="media-empty">No matching books found.</p>}{q.length >= 2 && !error && <nav className="catalog-pagination" aria-label="Book search pages">{page > 1 && <Link href={`/books/discover?${new URLSearchParams({q,page:String(page-1)})}`}>Previous</Link>}<span>Page {page}</span>{result.hasMore && <Link href={`/books/discover?${new URLSearchParams({q,page:String(page+1)})}`}>Next</Link>}</nav>}</>;
}
