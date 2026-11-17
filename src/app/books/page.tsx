import { Suspense } from "react";
import Discover from "./discover/page";
import { BookDashboard } from "@/components/books/book-dashboard";
type Props = { searchParams: Promise<{q?:string;page?:string}> };
export default function Page(props: Props) {
 return <Suspense fallback={<p className="media-empty" role="status">Loading your reading dashboard?</p>}><Content {...props}/></Suspense>;
}
async function Content({searchParams}:Props) {
 const params=await searchParams;
 return params.q !== undefined ? <Discover searchParams={Promise.resolve(params)}/> : <BookDashboard/>;
}
