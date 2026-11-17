import "server-only";
import { cacheLife } from "next/cache";
import { englishEditionCover, type CoverSearchRecord } from "./book-cover";
import { rankBookTitles, bookSearchQuery, isBookSearchResult } from "./book-search";
import { BookCatalogError, bookCover, createOpenLibraryTransport, openLibraryWorkId } from "./open-library-transport";
export { BookCatalogError, bookCover, openLibraryWorkId };
export type BookSummary = { id: number; work_key: string; title: string; authors: string[]; cover_url: string | null; first_publish_year?: number };
export type BookEdition = { id: string; title: string; pages: number | null; publishers: string[]; publish_date?: string; isbn?: string; cover_url: string | null };
export type BookDetails = BookSummary & { description: string; subjects: string[]; tagline?: string; default_edition_id?: string };
type Work = { key: string; title: string; subtitle?: string; description?: string | { value: string }; covers?: number[]; subjects?: string[]; authors?: { author?: { key: string } }[] };
type Edition = { key: string; title: string; number_of_pages?: number; publishers?: string[]; publish_date?: string; isbn_13?: string[]; covers?: number[]; works?: { key: string }[] };
const transport = createOpenLibraryTransport(() => process.env.OPEN_LIBRARY_CONTACT_EMAIL);

async function getEnglishCoverRecords(ids:number[]) {
  "use cache";
  cacheLife({stale:3600,revalidate:86400,expire:604800});
  const keys=ids.filter(id=>Number.isInteger(id)&&id>0&&id<=2147483647).slice(0,50).map(id=>`key:/works/OL${id}W`);
  if(!keys.length)return [] as CoverSearchRecord[];
  const result=await transport.request<{docs:CoverSearchRecord[]}>(`/search.json?${new URLSearchParams({q:`(${keys.join(" OR ")}) AND language:eng`,limit:"50",lang:"en",fields:"key,editions,editions.key,editions.language,editions.cover_i"})}`);
  if(!Array.isArray(result.docs))throw new BookCatalogError();
  return result.docs;
}

export async function getBookSubjects(ids: number[]) {
  "use cache";
  cacheLife({ stale:3600,revalidate:86400,expire:604800 });
  const safeIds=[...new Set(ids)].filter(id=>Number.isInteger(id)&&id>0&&id<=2147483647);
  if(!safeIds.length)return [];
  if(safeIds.length>50)throw new BookCatalogError("Too many books in a catalog lookup.",400);
  const result=await transport.request<{docs:{key:string;subject?:string[]}[]}>(`/search.json?${new URLSearchParams({q:safeIds.map(id=>`key:/works/OL${id}W`).join(" OR "),limit:"50",fields:"key,subject"})}`);
  if(!Array.isArray(result.docs))throw new BookCatalogError();
  return result.docs.flatMap(book=>{const id=openLibraryWorkId(book.key);return id&&safeIds.includes(id)?[{id,subjects:(book.subject||[]).filter(subject=>typeof subject==="string")}]:[];});
}

export async function searchBooks(query: string, page = 1) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  const text = query.trim().slice(0, 200), safePage = Math.max(1, Math.min(100, Math.floor(page) || 1));
  if (text.length < 2) return { books: [] as BookSummary[], hasMore: false };
  const searchQuery = bookSearchQuery(text);
  if (!searchQuery) return { books: [] as BookSummary[], hasMore: false };
  const result = await transport.request<{ docs: { key: string; title: string; author_name?: string[]; readinglog_count?: number; first_publish_year?: number }[]; numFound: number }>(`/search.json?${new URLSearchParams({ q: searchQuery, page: String(safePage), limit: "20", lang: "en", fields: "key,title,author_name,first_publish_year,readinglog_count" })}`);
  if (!Array.isArray(result.docs)) throw new BookCatalogError();
  const matches=rankBookTitles(result.docs.filter(item=>typeof item.title==="string"&&isBookSearchResult(item,text)),text);
  // Open Library applies title terms to edition selection, even inside a title
  // OR author query. Fetch edition covers by work IDs to avoid dropping the
  // author's other titles; this is one batch, never a request per result.
  const covers=await getEnglishCoverRecords(matches.flatMap(book=>{const id=openLibraryWorkId(book.key);return id?[id]:[];}));
  const coverMap=new Map(covers.map(book=>[openLibraryWorkId(book.key),englishEditionCover(book)]));
  const books=matches.flatMap(item=>{const id=openLibraryWorkId(item.key),cover=id?coverMap.get(id):null;return id&&cover?[{id,work_key:`/works/OL${id}W`,title:item.title,authors:(item.author_name||[]).filter(name=>typeof name==="string"),cover_url:cover,first_publish_year:item.first_publish_year}]:[];});
  return { books, hasMore: safePage * 20 < result.numFound };
}
export async function getBook(id: number): Promise<BookDetails> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 86400, expire: 604800 });
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new BookCatalogError("Invalid book.", 400);
  const work = await transport.request<Work>(`/works/OL${id}W.json`);
  if (openLibraryWorkId(work.key) !== id || typeof work.title !== "string") throw new BookCatalogError();
  const authors = await Promise.all((work.authors || []).slice(0, 5).map(async item => {
    if (!item.author || !/^\/authors\/OL[1-9]\d*A$/.test(item.author.key)) return null;
    try { const author = await transport.request<{ name: string }>(`${item.author.key}.json`); return typeof author.name === "string" ? author.name : null; } catch { return null; }
  }));
  let cover: string | null = null;
  let default_edition_id: string | undefined;
  try {
    const matching=await getEnglishCoverRecords([id]);
    const match=matching.find(book=>openLibraryWorkId(book.key)===id);
    cover = match ? englishEditionCover(match) : null;
    const preferred = match?.editions?.docs?.find(edition => edition.language?.includes("eng") && edition.key?.match(/^\/books\/OL[1-9]\d*M$/));
    default_edition_id = preferred?.key?.slice(7);
  } catch { /* Never substitute an unverified translation cover during provider outages. */ }
  return { id, work_key: work.key, title: work.title, authors: authors.filter((name): name is string => !!name), cover_url: cover, default_edition_id, tagline: work.subtitle, description: typeof work.description === "string" ? work.description : work.description?.value || "", subjects: (work.subjects || []).slice(0, 12) };
}
function edition(item: Edition): BookEdition | null {
  if (!/^\/books\/OL[1-9]\d*M$/.test(item.key) || typeof item.title !== "string") return null;
  return { id: item.key.slice(7), title: item.title, pages: Number.isInteger(item.number_of_pages) && item.number_of_pages! > 0 && item.number_of_pages! <= 100000 ? item.number_of_pages! : null, publishers: item.publishers || [], publish_date: item.publish_date, isbn: item.isbn_13?.[0], cover_url: bookCover(item.covers?.find(value => value > 0)) };
}
export async function getBookEditions(id: number, page = 1) {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 86400, expire: 604800 });
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new BookCatalogError("Invalid book.", 400);
  const safePage = Math.max(1, Math.min(100, Math.floor(page) || 1));
  const result = await transport.request<{ entries: Edition[]; size: number }>(`/works/OL${id}W/editions.json?limit=20&offset=${(safePage - 1) * 20}`);
  if (!Array.isArray(result.entries)) throw new BookCatalogError();
  return { editions: result.entries.map(edition).filter((value): value is BookEdition => !!value), hasMore: safePage * 20 < result.size };
}
export async function getBookEdition(id: number, editionId: string) {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 86400, expire: 604800 });
  if (!/^OL[1-9]\d*M$/.test(editionId)) throw new BookCatalogError("Invalid edition.", 400);
  const result = await transport.request<Edition>(`/books/${editionId}.json`);
  if (!result.works?.some(work => openLibraryWorkId(work.key) === id)) throw new BookCatalogError("Choose an edition of this book.", 400);
  const parsed = edition(result); if (!parsed) throw new BookCatalogError(); return parsed;
}
