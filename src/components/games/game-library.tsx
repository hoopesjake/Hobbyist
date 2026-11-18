import { LibraryActivity } from "@/components/calendar/media-activity";
import { getLibraryPlans } from "@/lib/media-activity";
import Link from "next/link";
import { getGameLibrary } from "@/lib/games";
import { getGameCards } from "@/lib/igdb";
import { GameCard } from "@/components/games/game-card";
import { shortDate } from "@/lib/date-format";
import { AddMediaTile } from "@/components/ui/add-media-tile";
export async function GameLibrary({filter="all",page=1,preview=false,compact=false}:{filter?:string;page?:number;preview?:boolean;compact?:boolean}){
 const {entries,total,error}=await getGameLibrary(filter,page,preview?5:20);if(error)return <p role="status" className="welcome-copy">{error}</p>;
 if(!entries.length)return <div className="media-empty"><p>No games here yet</p><Link className="text-link" href="/games/discover">Find a game</Link></div>;
 let games:Awaited<ReturnType<typeof getGameCards>>=[];try{games=await getGameCards(entries.map(entry=>entry.igdb_id));}catch{/* Personal entries still remain available during catalog outages. */}
 const plans = await getLibraryPlans("game", entries.map(e => e.igdb_id));
 const pages=Math.max(1,Math.ceil(total/20));return <><div className="catalog-grid">{entries.map(entry=>{const game=games.find(game=>game.id===entry.igdb_id)||{id:entry.igdb_id,name:`Game #${entry.igdb_id} (catalog unavailable)`};return <div key={entry.igdb_id} className="library-hobby-card">{compact?<GameCard entry={entry} game={game} compact date={shortDate(entry.last_played_on||entry.started_on||entry.completed_on)}/>:<><GameCard entry={entry} game={game}/><LibraryActivity type="game" id={entry.igdb_id} plans={plans.filter(e => e.provider_id === entry.igdb_id)}/></>}</div>;})}<AddMediaTile href="/games/discover" label="Add a game"/></div>{!preview&&pages>1&&<nav className="catalog-pagination" aria-label="Game library pages">{page>1&&<Link href={`?filter=${filter}&page=${page-1}`}>Previous</Link>}<span>Page {page} of {pages}</span>{page<pages&&<Link href={`?filter=${filter}&page=${page+1}`}>Next</Link>}</nav>}</>;
}
