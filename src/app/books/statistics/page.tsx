import { Suspense } from "react";
import { BookStatistics } from "@/components/books/book-statistics";
export const metadata={title:"Book Statistics"};
export default function Page(){return <Suspense fallback={<p className="media-empty" role="status">Loading reading statistics…</p>}><BookStatistics/></Suspense>;}
