import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PersonalLibrary } from "@/components/media/personal-library";
import { showStatusLabels,type ShowStatus } from "@/lib/tracking-validation";
import { AddMediaHeaderLink } from "@/components/ui/add-media-tile";
export default async function Page({searchParams}:{searchParams:Promise<{filter?:string;page?:string}>}){
  await requireUser();const params=await searchParams;const choices=["all","watchlist","watched"];const filter=choices.includes(params.filter||"")?params.filter!:"all";const page=Math.max(1,Math.min(100000,parseInt(params.page||"1",10)||1));
  return <><div className="section-heading"><h2>Your movie library</h2><AddMediaHeaderLink href="/movies/discover" label="Add a movie"/></div><nav className="status-filters" aria-label="Library filters">{choices.map(value=><Link key={value} href={`?filter=${value}`} aria-current={filter===value?"page":undefined}>{value==="all"?"All":value==="watchlist"?"Watchlist":value==="watched"?"Watched":showStatusLabels[value as ShowStatus]}</Link>)}</nav><PersonalLibrary kind="movie" filter={filter} page={page}/></>;
}
