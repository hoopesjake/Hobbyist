import Link from "next/link";
import type { BookTracking } from "@/lib/books";
import type { bookStatistics } from "@/lib/book-statistics";
import { BookCard } from "./book-card";
import { AddMediaTile, AddMediaHeaderLink } from "@/components/ui/add-media-tile";

export function BookDashboardView({entries,stats}:{entries:BookTracking[];stats:ReturnType<typeof bookStatistics>}) {
  const currently=entries.filter(b=>b.effective_status==="reading").sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
  const finished=entries.filter(b=>b.effective_status==="finished").sort((a,b)=>(b.effective_finished_on||"").localeCompare(a.effective_finished_on||"")||b.updated_at.localeCompare(a.updated_at));
  const want=entries.filter(b=>b.effective_status==="want_to_read").sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
  const sections=[{title:"Currently Reading",status:"reading",books:currently},{title:"Recently Finished",status:"finished",books:finished},{title:"Want to Read",status:"want_to_read",books:want}];
  return <>
    <dl className="media-statistics">{[["Currently reading",stats.reading],["Finished this year",stats.finishedYear],["Pages read",stats.pages.toLocaleString("en-US")],["Reading time",`${(stats.minutes/60).toLocaleString("en-US",{maximumFractionDigits:1})}h`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="section-heading"><Link className="text-link" href="/books/discover">Discover books</Link><Link className="text-link" href="/books/statistics">All reading statistics</Link></div>
    {sections.map(section=><section className="dashboard-section" key={section.status}><div className="section-heading"><h2>{section.title}</h2><div className="heading-actions"><AddMediaHeaderLink href="/books/discover" label="Add a book"/><Link className="text-link" href={`/books/library?status=${section.status}`}>View all</Link></div></div>{section.books.length?<div className="catalog-grid">{section.books.slice(0,5).map(book=><BookCard key={book.ol_work_id} book={{id:book.ol_work_id,work_key:book.work_key,title:book.title,authors:book.authors,cover_url:book.cover_url}} rating={book.rating} note={section.status==="finished"?book.effective_finished_on?`Finished ${book.effective_finished_on}`:"Finished · Date not recorded":`${book.current_page}${book.total_pages?` / ${book.total_pages}`:""} pages`} returnTo="/books"/>)}<AddMediaTile href="/books/discover" label="Add a book"/></div>:<p className="welcome-copy">{section.status==="reading"?"No books in progress yet.":section.status==="finished"?"No finished books yet.":"Your next read starts here."}</p>}</section>)}
  </>;
}
