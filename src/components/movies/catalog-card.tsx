import { withDiscoveryReturnTo } from "@/lib/discovery-navigation";
import { RatingStars } from "@/components/movies/rating-stars";
import { MediaImage } from "@/components/movies/media-image";
import { ActionForm } from "@/components/auth/action-form";
import { toggleMovieWatchlist, saveShow } from "@/app/tracking-actions";
import Link from "next/link";
import { imageUrl, titleDate, titleName, type CatalogItem } from "@/lib/tmdb";
export function CatalogCard({ item, genres = {}, note, rating, returnTo, compact = false, meta, quick = false }: { item: CatalogItem; genres?: Record<number, string>; note?: string; rating?: number | null; returnTo?: string; compact?: boolean; meta?: string | null; quick?: boolean }) {
  const person = item.media_type === "person";
  const title = titleName(item);
  const image = imageUrl(person ? item.profile_path : item.poster_path);
  const href = withDiscoveryReturnTo(person ? `/actors/${item.id}` : `${item.media_type === "tv" ? "/tv" : "/movies"}/${item.id}`, person ? undefined : returnTo);
  const poster = <div className={`catalog-poster${person ? " actor-portrait" : ""}`}>{image ? <MediaImage src={image} alt={person ? title : `${title} poster`} width={342} height={513} sizes="(max-width: 600px) 45vw, (max-width: 1000px) 28vw, 180px" /> : <span className="poster-fallback">{person ? "Portrait unavailable" : "Poster unavailable"}</span>}</div>;
  if (compact) return <Link className="catalog-card catalog-card-compact" href={href} title={title}>{poster}<RatingStars rating={rating} />{meta && <p className="catalog-meta">{meta}</p>}</Link>;
  const card = <Link className="catalog-card" href={href}>
    {poster}
    <p className="catalog-kind">{person ? item.known_for_department === "Directing" ? "Director" : item.known_for_department === "Acting" ? "Actor" : "Person" : item.media_type === "tv" ? "TV series" : "Movie"}{!person && titleDate(item) ? ` / ${titleDate(item).slice(0, 4)}` : ""}</p>
    <h3>{title}</h3>
    {person && !!item.known_for_titles?.length && <p className="catalog-note">{item.known_for_titles.join(" / ")}</p>}
    {!!item.genre_ids?.length && <p className="catalog-genres">{item.genre_ids.map(id => genres[id]).filter(Boolean).slice(0, 2).join(" / ")}</p>}
    {!person && <p className="catalog-score">TMDB {item.vote_count ? `${item.vote_average?.toFixed(1)} / 10` : "not rated"}</p>}
    {note && <p className="catalog-note">{note}</p>}
    <RatingStars rating={rating} />
    {item.overview && <p className="catalog-description">{item.overview}</p>}
  </Link>;
  if (!quick || person) return card;
  return <article className="catalog-card-shell">{card}<div className="catalog-quick">{item.media_type === "movie" ? <ActionForm action={toggleMovieWatchlist} label="Watchlist"><input type="hidden" name="tmdb_id" value={item.id}/><input type="hidden" name="on_watchlist" value="true"/></ActionForm> : <ActionForm action={saveShow} label="Watchlist"><input type="hidden" name="tmdb_id" value={item.id}/></ActionForm>}</div></article>;
}
