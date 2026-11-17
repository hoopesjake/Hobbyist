import Link from "next/link";
import { MediaImage } from "@/components/movies/media-image";
import { RatingStars } from "@/components/movies/rating-stars";
import type { BookSummary } from "@/lib/open-library";
import { bookReturnTo } from "@/lib/book-navigation";
export function BookCard({ book, note, rating, returnTo }: { book: BookSummary; note?: string; rating?: number | null; returnTo?: string }) {
  const suffix = returnTo ? `?${new URLSearchParams({ returnTo: bookReturnTo(returnTo) })}` : "";
  return <Link className="catalog-card" href={`/books/OL${book.id}W${suffix}`}><div className="catalog-poster">{book.cover_url ? <MediaImage src={book.cover_url} alt={`${book.title} cover`} width={342} height={513} sizes="(max-width:600px) 45vw,180px"/> : <span className="poster-fallback">Cover unavailable</span>}</div><p className="catalog-kind">Book{book.first_publish_year ? ` / ${book.first_publish_year}` : ""}</p><h3>{book.title}</h3><p className="catalog-note">{book.authors.join(", ") || "Author not listed"}</p>{note && <p className="catalog-note">{note}</p>}<RatingStars rating={rating}/></Link>;
}
