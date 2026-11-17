import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { getBookHistory } from "@/lib/books";
import { bookStatistics, bookGenreRanking } from "@/lib/book-statistics";
import { getBookSubjects } from "@/lib/open-library";
import { BookStatisticsView } from "./book-statistics-view";
import { dateInZone } from "@/lib/calendar-domain";

async function FavoriteGenres({ids}:{ids:number[]}) {
  const subjects:Awaited<ReturnType<typeof getBookSubjects>>=[];let incomplete=false;
  for(let offset=0;offset<ids.length;offset+=50){try{subjects.push(...await getBookSubjects(ids.slice(offset,offset+50)));}catch{incomplete=true;}}
  const genres=bookGenreRanking(subjects);
  return <section className="movie-stats-panel"><h3>Favorite genres</h3><p className="welcome-copy">By books finished</p>{genres.length?<ol className="movie-stats-ranking">{genres.slice(0,8).map(genre=><li key={genre.name}><span>{genre.name}</span><strong>{genre.count} books</strong></li>)}</ol>:<p className="welcome-copy">{ids.length?"No genre information available yet.":"Finish a book to discover your favorite genres."}</p>}{incomplete&&<p className="movie-stats-note">Some catalog genres are temporarily unavailable.</p>}</section>;
}
export async function BookStatistics() {
  await connection();await requireUser();
  const {entries,sessions,error}=await getBookHistory();if(error)return <p className="calendar-error" role="status">{error}</p>;
  if(!entries.length)return <section className="media-empty"><h2>Your reading story starts here.</h2><Link className="text-link" href="/books/discover">Discover books</Link></section>;
  const stats=bookStatistics(entries,sessions,dateInZone(new Date(),"America/Denver"));
  return <><h2>Your reading statistics</h2><div className="movie-stats-page"><BookStatisticsView stats={stats}/><Suspense fallback={<p role="status" className="welcome-copy">Loading favorite genres…</p>}><FavoriteGenres ids={entries.filter(b=>b.effective_status==="finished").map(b=>b.ol_work_id)}/></Suspense></div></>;
}
