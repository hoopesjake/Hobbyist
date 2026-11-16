import Link from "next/link";
import { getTrackingStats } from "@/lib/tracking";
export async function MediaStatistics({kind}:{kind:"movie"|"tv"}){
  const {stats,error}=await getTrackingStats();if(error)return <p className="welcome-copy" role="status">{error}</p>;
  if(!stats)return <p className="welcome-copy"><Link className="text-link" href="/auth/sign-in">Sign in</Link> to see your personal {kind==="movie"?"movie":"TV"} dashboard.</p>;
  const data=kind==="movie"?stats.movies:stats.tv;
  const values: [string,string|number][] = kind==="movie"?[["Watched",stats.movies.watched],["Watchlist",stats.movies.watchlist],["Rated",stats.movies.rated]]:[["Watching",stats.tv.watching],["Completed",stats.tv.completed],["Episodes watched",stats.episodes_watched]];
  values.push(["Your average rating",data.average_rating===null?"Not rated":`${Number(data.average_rating).toFixed(1)} / 5`]);
  return <dl className="media-statistics">{values.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
