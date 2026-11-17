import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOwnedLists } from "@/lib/lists";
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUser();
  const { lists, error } = await getOwnedLists();
  if (error) return <p role="status" className="welcome-copy">{error}</p>;
  const params = await searchParams;
  const pages = Math.max(1, Math.ceil(lists.length / 20));
  const page = Math.min(pages, Math.max(1, parseInt(params.page || "1", 10) || 1));
  if (!lists.length) return <section className="media-empty list-empty"><h2>Make room for your favorites</h2><Link className="account-button" href="/lists/new">Create your first list</Link></section>;
  return <><div className="section-heading"><h2>Your lists</h2><span className="welcome-copy">{lists.length} {lists.length === 1 ? "list" : "lists"}</span></div><div className="custom-lists-grid">{lists.slice((page - 1) * 20, page * 20).map(list => <Link key={list.id} href={`/lists/${list.id}`} className="custom-list-card"><span className="list-visibility">{list.visibility === "public" ? "Public" : "Private"}</span><h3>{list.name}</h3><span className="welcome-copy">Created {new Date(list.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Denver" })}</span></Link>)}</div>{pages > 1 && <nav className="catalog-pagination" aria-label="List pages">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={`?page=${page + 1}`}>Next</Link>}</nav>}</>;
}
