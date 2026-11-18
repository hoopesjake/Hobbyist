import Link from "next/link";
import { MediaImage } from "@/components/movies/media-image";
import { RatingStars } from "@/components/movies/rating-stars";
import { ActionForm } from "@/components/auth/action-form";
import { saveBook } from "@/app/books/actions";
import type { BookSummary } from "@/lib/open-library";
import { bookReturnTo } from "@/lib/book-navigation";
export function BookCard({ book, note, rating, returnTo, compact = false, meta, quick = false }: { book: BookSummary; note?: string; rating?: number | null; returnTo?: string; compact?: boolean; meta?: string | null; quick?: boolean }) {
  const suffix = returnTo ? `?${new URLSearchParams({ returnTo: bookReturnTo(returnTo) })}` : "";
  const href = `/books/OL${book.id}W${suffix}`;
  const poster = <div className="catalog-poster">{book.cover_url ? <MediaImage src={book.cover_url} alt={`${book.title} cover`} width={342} height={513} sizes="(max-width:600px) 45vw,180px"/> : <span className="poster-fallback">Cover unavailable</span>}</div>;
  if (compact) return <Link className="catalog-card catalog-card-compact" href={href} title={book.title}>{poster}<RatingStars rating={rating}/>{meta && <p className="catalog-meta">{meta}</p>}</Link>;
  const card = <Link className="catalog-card" href={href}>{poster}<p className="catalog-kind">Book{book.first_publish_year ? ` / ${book.first_publish_year}` : ""}</p><h3 className="book-card-title" title={book.title}>{book.title}</h3><p className="catalog-note">{book.authors.join(", ") || "Author not listed"}</p>{note && <p className="catalog-note">{note}</p>}<RatingStars rating={rating}/></Link>;
  if (!quick) return card;
  return <article className="catalog-card-shell">{card}<div className="catalog-quick"><ActionForm action={saveBook} label="Want to Read"><input type="hidden" name="work_id" value={`OL${book.id}W`}/><input type="hidden" name="status" value="want_to_read"/></ActionForm></div></article>;
}
