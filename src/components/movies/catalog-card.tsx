import { withDiscoveryReturnTo } from "@/lib/discovery-navigation";
import { RatingStars } from "@/components/movies/rating-stars";
import { MediaImage } from "@/components/movies/media-image";
import Link from "next/link";
import { imageUrl, titleDate, titleName, type CatalogItem } from "@/lib/tmdb";
export function CatalogCard({ item, genres = {}, note, rating, returnTo }: { item: CatalogItem; genres?: Record<number, string>; note?: string; rating?: number | null; returnTo?: string }) {
  const person = item.media_type === "person";
  const title = titleName(item);
  const image = imageUrl(person ? item.profile_path : item.poster_path);
  return <Link className="catalog-card" href={withDiscoveryReturnTo(person ? `/actors/${item.id}` : `${item.media_type === "tv" ? "/tv" : "/movies"}/${item.id}`, person ? undefined : returnTo)}>
    <div className={`catalog-poster${person ? " actor-portrait" : ""}`}>{image ? <MediaImage src={image} alt={person ? title : `${title} poster`} width={342} height={513} sizes="(max-width: 600px) 45vw, (max-width: 1000px) 28vw, 180px" /> : <span className="poster-fallback">{person ? "Portrait unavailable" : "Poster unavailable"}</span>}</div>
    <p className="catalog-kind">{person ? item.known_for_department === "Directing" ? "Director" : item.known_for_department === "Acting" ? "Actor" : "Person" : item.media_type === "tv" ? "TV series" : "Movie"}{!person && titleDate(item) ? ` / ${titleDate(item).slice(0, 4)}` : ""}</p>
    <h3>{title}</h3>
    {person && !!item.known_for_titles?.length && <p className="catalog-note">{item.known_for_titles.join(" / ")}</p>}
    {!!item.genre_ids?.length && <p className="catalog-genres">{item.genre_ids.map(id => genres[id]).filter(Boolean).slice(0, 2).join(" / ")}</p>}
    {!person && <p className="catalog-score">TMDB {item.vote_count ? `${item.vote_average?.toFixed(1)} / 10` : "not rated"}</p>}
    {note && <p className="catalog-note">{note}</p>}
    <RatingStars rating={rating} />
    {item.overview && <p className="catalog-description">{item.overview}</p>}
  </Link>;
}
