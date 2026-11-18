import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { getCatalog,getGenres,getGenreList,TmdbError } from "@/lib/tmdb";
import { CatalogCard } from "@/components/movies/catalog-card";
import { BackLink } from "@/components/layout/back-link";
export type DiscoveryParams={q?:string;page?:string;from?:string;genre?:string};
export async function Discovery({kind,params={},preview=false}:{kind:"movie"|"tv"|"person";params?:DiscoveryParams;preview?:boolean}){
  const root=kind==="movie"?"/movies":kind==="tv"?"/tv":"/actors";const label=kind==="movie"?"movies":kind==="tv"?"TV shows":"actors and directors";
  const query=typeof params.q==="string"?params.q.trim().slice(0,200):"";const page=Math.min(500,Math.max(1,parseInt(params.page||"1",10)||1));
  const fromHome=params.from==="home";
  const genreId=kind!=="person"&&/^[1-9]\d*$/.test(params.genre||"")?Number(params.genre):undefined;
  const user=await currentUser();
  let catalog,genres,genreOptions:{id:number;name:string}[]=[];
  try{
    [catalog,genres]=await Promise.all([getCatalog(query,kind,page,genreId),getGenres()]);
    if(kind!=="person")genreOptions=await getGenreList(kind);
  }catch(error){return <section className="library-panel" role="status"><h2>Catalog unavailable</h2><p>{error instanceof TmdbError?error.message:"Please try again shortly."}</p><Link href={`${root}/discover`} className="text-link">Try again</Link></section>;}
  const extra=(p:number)=>({q:query,page:String(p),...(fromHome?{from:"home"}:{}),...(genreId?{genre:String(genreId)}:{})});
  const href=(next:number)=>`${root}/discover?${new URLSearchParams(extra(next))}`;
  const clearHref=`${root}/discover${fromHome?"?from=home":""}`;
  const activeGenreName=genreId?genreOptions.find(genre=>genre.id===genreId)?.name:undefined;
  return <>{fromHome&&<BackLink href="/" className="discovery-return-home">Return Home</BackLink>}
    <form className="catalog-search" action={`${root}/discover`} role="search">
      <label className="sr-only" htmlFor={`search-${kind}`}>Search {label}</label><input id={`search-${kind}`} name="q" type="search" defaultValue={query} maxLength={200} placeholder={`Search ${label}...`}/>
      {fromHome&&<input type="hidden" name="from" value="home"/>}
      {kind!=="person"&&<><label className="sr-only" htmlFor={`genre-${kind}`}>Genre</label><select id={`genre-${kind}`} name="genre" defaultValue={genreId?String(genreId):""}><option value="">All genres</option>{genreOptions.map(genre=><option key={genre.id} value={genre.id}>{genre.name}</option>)}</select></>}
      <button className="account-button">Search</button>
    </form>
    {query&&genreId&&<p className="catalog-genre-note">Genre filtering applies to browsing, not search results &mdash; <Link className="text-link" href={`${root}/discover?${new URLSearchParams({genre:String(genreId),...(fromHome?{from:"home"}:{})})}`}>clear search to filter by {activeGenreName||"genre"}</Link>.</p>}
    <div className="section-heading"><h2>{query?`Results for "${query}"`:activeGenreName?`${activeGenreName} ${label}`:kind==="person"?"Popular actors & directors":`Trending ${label}`}</h2>{preview?<Link href={`${root}/discover`} className="text-link">Explore all</Link>:(query||genreId)&&<Link href={clearHref} className="text-link">Clear {query?"search":"filters"}</Link>}</div>
    {catalog.results.length?<div className="catalog-grid">{catalog.results.slice(0,preview?5:undefined).map(item=><CatalogCard key={`${item.media_type}-${item.id}`} item={item} genres={genres} returnTo={href(page)} quick={!!user}/>)}</div>:<section className="library-panel"><h2>No matches yet</h2><p>Try another search.</p></section>}
    {!preview&&<nav className="catalog-pagination" aria-label="Catalog pages">{page>1&&<Link href={href(page-1)}>Previous</Link>}<span>Page {page}{catalog.totalPages?` of ${catalog.totalPages}`:""}</span>{page<catalog.totalPages&&<Link href={href(page+1)}>Next</Link>}</nav>}
  </>;
}
