import { MediaImage } from "@/components/movies/media-image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { validId } from "@/lib/media-validation";
import { getPerson, getGenres, imageUrl, titleDate, TmdbError } from "@/lib/tmdb";
import { getActorFollow } from "@/lib/actors";
import { ActionForm } from "@/components/auth/action-form";
import { followActor } from "@/app/actors/actions";
import { CatalogCard } from "@/components/movies/catalog-card";
export default async function ActorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; filter?: string }> }) {
  const id = validId((await params).id);
  if (!id) notFound();
  let actor;
  try { actor = await getPerson(id); }
  catch (error) { if (error instanceof TmdbError && error.status === 404) notFound(); throw error; }
  const [user, follow, genres, filters] = await Promise.all([currentUser(), getActorFollow(id), getGenres(), searchParams]);
  const image = imageUrl(actor.profile_path, "w500");
  const unique = new Set<string>();
  const credits = (actor.combined_credits?.cast || []).filter(item => {
    const key = `${item.media_type}-${item.id}`;
    if ((filters.filter === "movie" || filters.filter === "tv") && item.media_type !== filters.filter) return false;
    if (item.adult || !["movie", "tv"].includes(item.media_type) || unique.has(key)) return false;
    unique.add(key); return true;
  }).sort((a, b) => titleDate(b).localeCompare(titleDate(a)) || (b.popularity || 0) - (a.popularity || 0));
  const totalPages = Math.max(1, Math.ceil(credits.length / 24));
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(filters.page || "1", 10) || 1));
  return <><Link className="back-link" href="/actors/discover">Discover people</Link><div className="title-detail"><div className="detail-poster">{image ? <MediaImage src={image} alt={actor.name} loading="eager" width={500} height={750} sizes="(max-width: 600px) 60vw, 260px" /> : <span className="poster-fallback">Portrait unavailable</span>}</div><div><p className="eyebrow">{actor.known_for_department || "PERSON"}</p><h2 className="detail-title">{actor.name}</h2><p className="title-meta">{actor.birthday ? `Born ${actor.birthday}` : "Birth date unavailable"}{actor.place_of_birth ? ` / ${actor.place_of_birth}` : ""}{actor.deathday ? ` / Died ${actor.deathday}` : ""}</p><p className="person-biography">{actor.biography || "No biography is available yet."}</p>{user ? follow.error ? <p role="status">Your followed actors could not be loaded. Refresh before making changes.</p> : <ActionForm key={String(follow.following)} action={followActor} label={follow.following ? "Unfollow actor" : "Follow actor"}><input type="hidden" name="tmdb_person_id" value={id} /><input type="hidden" name="intent" value={follow.following ? "unfollow" : "follow"} /></ActionForm> : <Link className="text-link" href="/auth/sign-in">Sign in to follow this actor</Link>}</div></div><section className="dashboard-section"><div className="section-heading"><h2>Acting filmography</h2><span className="welcome-copy">{credits.length} movies and shows</span></div><nav className="status-filters" aria-label="Filmography filter">{[["all","All credits"],["movie","Movies"],["tv","TV shows"]].map(([value,label]) => <Link key={value} href={`?filter=${value}`} aria-current={(filters.filter || "all") === value ? "page" : undefined}>{label}</Link>)}</nav>{credits.length ? <div className="catalog-grid">{credits.slice((page - 1) * 24, page * 24).map(item => <CatalogCard key={`${item.media_type}-${item.id}`} item={item} genres={genres} note={item.character ? `As ${item.character}` : undefined} />)}</div> : <p className="welcome-copy">No acting credits are available.</p>}<nav className="catalog-pagination" aria-label="Filmography pages">{page > 1 && <Link href={`?filter=${filters.filter || "all"}&page=${page - 1}`}>Previous</Link>}<span>Page {page} of {totalPages}</span>{page < totalPages && <Link href={`?filter=${filters.filter || "all"}&page=${page + 1}`}>Next</Link>}</nav></section></>;
}
