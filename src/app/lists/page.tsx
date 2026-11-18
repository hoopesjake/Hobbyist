import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOwnedLists, getListPreviewItems, type MediaList } from "@/lib/lists";
import { getListCatalogItem, toLibraryOption } from "@/lib/list-catalog";
import { MediaImage } from "@/components/movies/media-image";
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUser();
  const { lists, error } = await getOwnedLists();
  if (error) return <p role="status" className="welcome-copy">{error}</p>;
  const params = await searchParams;
  const pages = Math.max(1, Math.ceil(lists.length / 20));
  const page = Math.min(pages, Math.max(1, parseInt(params.page || "1", 10) || 1));
  if (!lists.length) return <section className="media-empty list-empty"><h2>Make room for your favorites</h2><Link className="account-button" href="/lists/new">Create your first list</Link></section>;
  const visible = lists.slice((page - 1) * 20, page * 20);
  const covers = await Promise.all(visible.map(list => listCoverStrip(list)));
  return <><div className="section-heading"><h2>Your lists</h2><span className="welcome-copy">{lists.length} {lists.length === 1 ? "list" : "lists"}</span></div><div className="custom-lists-stack">{visible.map((list, index) => <Link key={list.id} href={`/lists/${list.id}`} className="custom-list-card"><div className="list-card-heading"><h3>{list.name}</h3><span className="list-visibility">{list.visibility === "public" ? "Public" : "Private"}</span></div><div className="list-cover-strip">{covers[index].length ? covers[index].map((cover, i) => <span className="list-cover-strip-item" key={i}>{cover ? <MediaImage src={cover} alt="" width={120} height={180} sizes="64px"/> : <span className="poster-fallback"/>}</span>) : <span className="list-cover-strip-empty">No titles yet</span>}</div></Link>)}</div>{pages > 1 && <nav className="catalog-pagination" aria-label="List pages">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={`?page=${page + 1}`}>Next</Link>}</nav>}</>;
}
async function listCoverStrip(list: MediaList): Promise<(string | null)[]> {
  const { items } = await getListPreviewItems(list.id, 8);
  if (!items.length) return [];
  const catalogItems = await Promise.all(items.map(getListCatalogItem));
  return catalogItems.map(item => toLibraryOption(item).image_url || null);
}
