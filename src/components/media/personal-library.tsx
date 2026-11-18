import { LibraryActivity } from "@/components/calendar/media-activity";
import { getLibraryPlans } from "@/lib/media-activity";
import Link from "next/link";
import { getMovies,getShows,getLatestWatchedEpisode } from "@/lib/tracking";
import { getTitle,type CatalogItem } from "@/lib/tmdb";
import { CatalogCard } from "@/components/movies/catalog-card";
import { showStatusLabels,type ShowStatus } from "@/lib/tracking-validation";
import { AddMediaTile } from "@/components/ui/add-media-tile";
export async function PersonalLibrary({kind,page=1,filter="all",limit=24,preview=false,compact=false}:{kind:"movie"|"tv";page?:number;filter?:string;limit?:number;preview?:boolean;compact?:boolean}){
  const root=kind==="movie"?"/movies":"/tv";
  const library=kind==="movie"?await getMovies(page,filter,limit):await getShows(page,filter,limit);
  if(library.error)return <p className="welcome-copy" role="status">{library.error}</p>;
  if(!library.entries.length)return <section className="media-empty"><h3>{kind==="movie"?"Room for your next great film":"Your next series starts here"}</h3><p>{kind==="movie"?"Save a movie to your watchlist or mark one watched.":"Plan a show or start tracking its episodes."}</p><Link className="text-link" href={`${root}/discover`}>Discover {kind==="movie"?"movies":"TV shows"}</Link></section>;
  const items=await Promise.all(library.entries.map(async entry=>{
    let item:CatalogItem;try{item=await getTitle(kind,entry.tmdb_id);}catch{item={id:entry.tmdb_id,media_type:kind,title:`${kind==="movie"?"Movie":"Show"} #${entry.tmdb_id} (catalog unavailable)`};}
    const note="status" in entry?showStatusLabels[entry.status as ShowStatus]:entry.watched?`Watched${entry.watched_on?` ${entry.watched_on}`:""}`:entry.on_watchlist?"On your watchlist":"In your library";
    let meta:string|null=null;
    if(compact&&kind==="tv"){const episode=await getLatestWatchedEpisode(entry.tmdb_id);meta=episode?`S${episode.season_number} E${episode.episode_number}`:null;}
    return {item,note,rating:entry.rating,meta};
  }));
  const plans = await getLibraryPlans(kind, library.entries.map(e => e.tmdb_id));
  const pages=Math.max(1,Math.ceil(library.total/limit));const href=(next:number)=>`${root}/library?${new URLSearchParams({filter,page:String(next)})}`;
  return <><div className="catalog-grid">{items.map(({item,note,rating,meta})=><div key={item.id} className="library-hobby-card">{compact?<CatalogCard item={item} rating={rating} compact meta={meta}/>:<><CatalogCard item={item} note={note} rating={rating}/><LibraryActivity type={kind} id={item.id} plans={plans.filter(e => e.provider_id === item.id)}/></>}</div>)}<AddMediaTile href={`${root}/discover`} label={`Add a ${kind==="movie"?"movie":"TV show"}`}/></div>{!preview&&pages>1&&<nav className="catalog-pagination" aria-label="Library pages">{page>1&&<Link href={href(page-1)}>Previous</Link>}<span>Page {page} of {pages}</span>{page<pages&&<Link href={href(page+1)}>Next</Link>}</nav>}</>;
}
