import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getFollows } from "@/lib/actors";
import { CatalogCard } from "@/components/movies/catalog-card";
import { ActionForm } from "@/components/auth/action-form";
import { followActor } from "@/app/actors/actions";
export const metadata = { title: "Followed actors" };
export default async function FollowedActors({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUser();
  const page = Math.max(1, Math.min(100000, Number.parseInt((await searchParams).page || "1", 10) || 1));
  const follows = await getFollows(page);
  const totalPages = Math.max(1, Math.ceil(follows.total / 24));
  return <><div className="section-heading"><h2>Your followed actors</h2><Link className="text-link" href="/actors/discover">Discover people</Link></div>{follows.error ? <p role="status">{follows.error}</p> : follows.actors.length ? <div className="catalog-grid">{follows.actors.map(actor => <article key={actor.tmdb_person_id}><CatalogCard item={{ id: actor.tmdb_person_id, media_type: "person", name: actor.name, profile_path: actor.profile_path }} /><ActionForm action={followActor} label="Unfollow"><input type="hidden" name="tmdb_person_id" value={actor.tmdb_person_id} /><input type="hidden" name="intent" value="unfollow" /></ActionForm></article>)}</div> : <section className="library-panel"><h2>Follow the people behind your favorites</h2><p>Open an actor from search or a title cast, then follow them to keep their filmography close.</p><Link className="text-link" href="/actors/discover">Find an actor</Link></section>}{!follows.error && (page > 1 || totalPages > 1) && <nav className="catalog-pagination" aria-label="Followed actors pages">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}<span>Page {page} of {totalPages}</span>{page < totalPages && <Link href={`?page=${page + 1}`}>Next</Link>}</nav>}</>;
}
