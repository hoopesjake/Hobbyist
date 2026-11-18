import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { getCatalog,getGenres,TmdbError } from "@/lib/tmdb";
import { CatalogCard } from "@/components/movies/catalog-card";
export type DiscoveryParams={q?:string;page?:string};
export async function Discovery({kind,params={},preview=false}:{kind:"movie"|"tv"|"person";params?:DiscoveryParams;preview?:boolean}){
  const root=kind==="movie"?"/movies":kind==="tv"?"/tv":"/actors";const label=kind==="movie"?"movies":kind==="tv"?"TV shows":"actors and directors";
  const query=typeof params.q==="string"?params.q.trim().slice(0,200):"";const page=Math.min(500,Math.max(1,parseInt(params.page||"1",10)||1));
  const user=await currentUser();
  let catalog,genres;try{[catalog,genres]=await Promise.all([getCatalog(query,kind,page),getGenres()]);}catch(error){return <section className="library-panel" role="status"><h2>Catalog unavailable</h2><p>{error instanceof TmdbError?error.message:"Please try again shortly."}</p><Link href={`${root}/discover`} className="text-link">Try again</Link></section>;}
  const href=(next:number)=>`${root}/discover?${new URLSearchParams({q:query,page:String(next)})}`;
  return <><form className="catalog-search" action={`${root}/discover`} role="search"><label className="sr-only" htmlFor={`search-${kind}`}>Search {label}</label><input id={`search-${kind}`} name="q" type="search" defaultValue={query} maxLength={200} placeholder={`Search ${label}...`}/><button className="account-button">Search</button></form><div className="section-heading"><h2>{query?`Results for "${query}"`:kind==="person"?"Popular actors & directors":`Trending ${label}`}</h2>{preview?<Link href={`${root}/discover`} className="text-link">Explore all</Link>:query&&<Link href={`${root}/discover`} className="text-link">Clear search</Link>}</div>{catalog.results.length?<div className="catalog-grid">{catalog.results.slice(0,preview?5:undefined).map(item=><CatalogCard key={`${item.media_type}-${item.id}`} item={item} genres={genres} returnTo={href(page)} quick={!!user}/>)}</div>:<section className="library-panel"><h2>No matches yet</h2><p>Try another search.</p></section>}{!preview&&<nav className="catalog-pagination" aria-label="Catalog pages">{page>1&&<Link href={href(page-1)}>Previous</Link>}<span>Page {page}{catalog.totalPages?` of ${catalog.totalPages}`:""}</span>{page<catalog.totalPages&&<Link href={href(page+1)}>Next</Link>}</nav>}</>;
}
