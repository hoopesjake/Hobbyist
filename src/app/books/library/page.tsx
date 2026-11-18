import { requireUser } from "@/lib/auth";
import { Suspense } from "react";
import { BookLibrary } from "@/components/books/book-library";
import { NavigationTabs } from "@/components/layout/navigation-tabs";
import { readingStatuses } from "@/lib/book-validation";
import { AddMediaHeaderLink } from "@/components/ui/add-media-tile";
type LibraryPageProps = { searchParams: Promise<{ status?: string; page?: string }> };
export default function Page(props: LibraryPageProps) {
  return <><div className="section-heading"><h2>Your book library</h2><AddMediaHeaderLink href="/books/discover" label="Add a book"/></div><NavigationTabs label="Book library filters" tabs={[{href:"/books/library",label:"All"},...Object.entries(readingStatuses).map(([status,label])=>({href:`/books/library?status=${status}`,label}))]}/><Suspense fallback={<p role="status" className="media-empty">Loading your books…</p>}><ReadingLibrary {...props}/></Suspense></>;
}
async function ReadingLibrary({ searchParams }: LibraryPageProps) {
  await requireUser(); const params = await searchParams;
  const filter = params.status && params.status in readingStatuses ? params.status : "all";
  return <BookLibrary filter={filter} page={Math.max(1, Math.floor(Number(params.page) || 1))}/>;
}
