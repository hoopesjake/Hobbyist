import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PersonalLibrary } from "@/components/media/personal-library";
import { showStatuses,showStatusLabels,type ShowStatus } from "@/lib/tracking-validation";
import { AddMediaHeaderLink } from "@/components/ui/add-media-tile";
export default async function Page({searchParams}:{searchParams:Promise<{filter?:string;page?:string}>}){
  await requireUser();const params=await searchParams;const choices=["all",...showStatuses];const filter=choices.includes(params.filter||"")?params.filter!:"all";const page=Math.max(1,Math.min(100000,parseInt(params.page||"1",10)||1));
  return <><div className="section-heading"><h2>Your TV library</h2><AddMediaHeaderLink href="/tv/discover" label="Add a TV show"/></div><nav className="status-filters" aria-label="Library filters">{choices.map(value=><Link key={value} href={`?filter=${value}`} aria-current={filter===value?"page":undefined}>{value==="all"?"All":value==="watchlist"?"Watchlist":value==="watched"?"Watched":showStatusLabels[value as ShowStatus]}</Link>)}</nav><PersonalLibrary kind="tv" filter={filter} page={page}/></>;
}
