import Link from "next/link";
import { getMovies,getShows } from "@/lib/tracking";
import { getTitle,type CatalogItem } from "@/lib/tmdb";
import { CatalogCard } from "@/components/movies/catalog-card";
import { showStatusLabels,type ShowStatus } from "@/lib/tracking-validation";
export async function PersonalLibrary({kind,page=1,filter="all",limit=24,preview=false}:{kind:"movie"|"tv";page?:number;filter?:string;limit?:number;preview?:boolean}){
  const root=kind==="movie"?"/movies":"/tv";
  const library=kind==="movie"?await getMovies(page,filter,limit):await getShows(page,filter,limit);
  if(library.error)return <p className="welcome-copy" role="status">{library.error}</p>;
  if(!library.entries.length)return <section className="media-empty"><h3>{kind==="movie"?"Room for your next great film":"Your next series starts here"}</h3><p>{kind==="movie"?"Save a movie to your watchlist or mark one watched.":"Plan a show or start tracking its episodes."}</p><Link className="text-link" href={`${root}/discover`}>Discover {kind==="movie"?"movies":"TV shows"}</Link></section>;
  const items=await Promise.all(library.entries.map(async entry=>{
    let item:CatalogItem;try{item=await getTitle(kind,entry.tmdb_id);}catch{item={id:entry.tmdb_id,media_type:kind,title:`${kind==="movie"?"Movie":"Show"} #${entry.tmdb_id} (catalog unavailable)`};}
    const note="status" in entry?showStatusLabels[entry.status as ShowStatus]:entry.watched?`Watched${entry.watched_on?` ${entry.watched_on}`:""}`:entry.on_watchlist?"On your watchlist":"In your library";
    return {item,note,rating:entry.rating};
  }));
  const pages=Math.max(1,Math.ceil(library.total/limit));const href=(next:number)=>`${root}/library?${new URLSearchParams({filter,page:String(next)})}`;
  return <><div className="catalog-grid">{items.map(({item,note,rating})=><CatalogCard key={item.id} item={item} note={note} rating={rating}/>)}</div>{!preview&&pages>1&&<nav className="catalog-pagination" aria-label="Library pages">{page>1&&<Link href={href(page-1)}>Previous</Link>}<span>Page {page} of {pages}</span>{page<pages&&<Link href={href(page+1)}>Next</Link>}</nav>}</>;
}
