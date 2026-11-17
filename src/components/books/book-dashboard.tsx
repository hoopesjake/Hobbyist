import Link from "next/link";
import { connection } from "next/server";
import { currentUser } from "@/lib/auth";
import { getBookHistory } from "@/lib/books";
import { bookStatistics } from "@/lib/book-statistics";
import { dateInZone } from "@/lib/calendar-domain";
import { BookDashboardView } from "./book-dashboard-view";

export async function BookDashboard() {
  await connection();const user=await currentUser();
  if(!user)return <section className="media-empty"><h2>A little time for your next chapter.</h2><p><Link className="text-link" href="/auth/sign-in">Sign in</Link> to see your reading dashboard.</p><Link className="account-button" href="/books/discover">Discover books</Link></section>;
  const result=await getBookHistory();if(result.error)return <p className="calendar-error" role="status">{result.error}</p>;
  return <BookDashboardView entries={result.entries} stats={bookStatistics(result.entries,result.sessions,dateInZone(new Date(),"America/Denver"))}/>;
}
