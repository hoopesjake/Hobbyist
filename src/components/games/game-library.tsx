import { LibraryActivity } from "@/components/calendar/media-activity";
import { getLibraryPlans } from "@/lib/media-activity";
import Link from "next/link";
import { getGameLibrary } from "@/lib/games";
import { getGameCards } from "@/lib/igdb";
import { GameCard } from "@/components/games/game-card";
export async function GameLibrary({filter="all",page=1,preview=false}:{filter?:string;page?:number;preview?:boolean}){
 const {entries,total,error}=await getGameLibrary(filter,page,preview?5:20);if(error)return <p role="status" className="welcome-copy">{error}</p>;
 if(!entries.length)return <div className="media-empty"><p>No games here yet</p><Link className="text-link" href="/games/discover">Find a game</Link></div>;
 let games:Awaited<ReturnType<typeof getGameCards>>=[];try{games=await getGameCards(entries.map(entry=>entry.igdb_id));}catch{/* Personal entries still remain available during catalog outages. */}
 const plans = await getLibraryPlans("game", entries.map(e => e.igdb_id));
 const pages=Math.max(1,Math.ceil(total/20));return <><div className="catalog-grid">{entries.map(entry=><div key={entry.igdb_id} className="library-hobby-card"><GameCard entry={entry} game={games.find(game=>game.id===entry.igdb_id)||{id:entry.igdb_id,name:`Game #${entry.igdb_id} (catalog unavailable)`}}/><LibraryActivity type="game" id={entry.igdb_id} plans={plans.filter(e => e.provider_id === entry.igdb_id)}/></div>)}</div>{!preview&&pages>1&&<nav className="catalog-pagination" aria-label="Game library pages">{page>1&&<Link href={`?filter=${filter}&page=${page-1}`}>Previous</Link>}<span>Page {page} of {pages}</span>{page<pages&&<Link href={`?filter=${filter}&page=${page+1}`}>Next</Link>}</nav>}</>;
}
