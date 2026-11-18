import { createClient } from "@/lib/supabase/server";
import { MediaActivity } from "@/components/calendar/media-activity";
import { discoveryReturnTo } from "@/lib/discovery-navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getGame,gameImage,gameRelease,IgdbError, type GameDetails } from "@/lib/igdb";
import { gameId } from "@/lib/game-validation";
import { getGameTracking } from "@/lib/games";
import { getOwnedLists } from "@/lib/lists";
import { BackLink } from "@/components/layout/back-link";
import { MediaImage } from "@/components/movies/media-image";
import { GameReview } from "@/components/games/game-review";
import { GameCard } from "@/components/games/game-card";
import { AddToList } from "@/components/lists/add-to-list";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{returnTo?:string}>}){
 const returnTo=discoveryReturnTo((await searchParams).returnTo,"/games");
 const id=gameId((await params).id);if(!id)notFound();
 const [user,tracking,lists]=await Promise.all([currentUser(),getGameTracking(id),getOwnedLists()]);
 let game: GameDetails; let savedCover: string | null = null; let catalogUnavailable = false;
 try { game=await getGame(id); }
 catch(error) {
   if (!tracking.entry || !user) { if(error instanceof IgdbError&&error.status===404)notFound();throw error; }
   const client = await createClient();
   const {data:snapshot}=await client.from("calendar_entries").select("media_title,media_image").eq("user_id",user.id).eq("media_type","game").eq("provider_id",id).order("updated_at",{ascending:false}).limit(1).maybeSingle();
   game={id,name:snapshot?.media_title||`Game #${id}`};savedCover=snapshot?.media_image||null;catalogUnavailable=true;
 }
 const cover=gameImage(game.cover?.image_id)||savedCover;const companies=(role:"developer"|"publisher")=>[...new Set(game.involved_companies?.filter(item=>item[role]).flatMap(item=>item.company?[item.company.name]:[])||[])].join(" / ");
 return <><BackLink href={returnTo}>{returnTo.includes("?")?"Back to results":"Back to discover"}</BackLink>{catalogUnavailable&&<p className="welcome-copy" role="status">Catalog details are temporarily unavailable. Your saved activity remains available.</p>}<div className="title-detail"><div className="detail-poster-column"><div className="detail-poster game-cover">{cover?<MediaImage src={cover} alt={`${game.name} cover`} width={264} height={352} loading="eager" sizes="230px"/>:<span className="poster-fallback">Cover unavailable</span>}</div><GameReview id={id} title={game.name} platforms={game.platforms||[]} entry={tracking.entry} signedIn={!!user} error={tracking.error}/></div><div><p className="eyebrow">VIDEO GAME</p><h2 className="detail-title">{game.name}</h2><p className="title-meta">Released: {gameRelease(game.first_release_date)||"Not announced"}</p><p className="title-meta">{game.genres?.map(genre=>genre.name).join(" / ")||"Genres unavailable"}</p><p className="title-overview">{game.summary||"No summary available."}</p><dl className="game-detail-facts">{[["Developer",companies("developer")],["Publisher",companies("publisher")],["Platforms",game.platforms?.map(p=>p.name).join(" / ")],["Modes",game.game_modes?.map(mode=>mode.name).join(" / ")],["Franchises",game.franchises?.map(item=>item.name).join(" / ")],["Collections",game.collections?.map(item=>item.name).join(" / ")]].filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="catalog-score">IGDB player score: {game.rating_count&&game.rating!==undefined?`${game.rating.toFixed(1)} / 100 (${game.rating_count} ratings)`:"Not rated"}</p><p className="catalog-score">IGDB critic score: {game.aggregated_rating_count&&game.aggregated_rating!==undefined?`${game.aggregated_rating.toFixed(1)} / 100 (${game.aggregated_rating_count} ratings)`:"Not rated"}</p>{game.storyline&&<details className="saved-review"><summary>Storyline</summary><p>{game.storyline}</p></details>}{tracking.entry?.review&&<details className="saved-review"><summary>{tracking.entry.contains_spoilers?"Your review (contains spoilers)":"Your review"}</summary><p>{tracking.entry.review}</p></details>}<div className="title-actions">{user&&<AddToList id={id} kind="game" lists={lists.lists} error={lists.error}/>}<Link className="text-link" href={`https://www.igdb.com/games/${game.slug && /^[a-z0-9-]+$/i.test(game.slug) ? game.slug : id}`} target="_blank" rel="noreferrer">View on IGDB</Link></div></div></div><MediaActivity type="game" id={id} title={game.name} image={cover}/>{!!game.screenshots?.length&&<section className="dashboard-section"><h3>Screenshots</h3><div className="game-screenshots">{game.screenshots.slice(0,8).map(item=>gameImage(item.image_id,"screenshot_big")&&<MediaImage key={item.id} src={gameImage(item.image_id,"screenshot_big")!} alt={`${game.name} screenshot`} width={889} height={500} sizes="(max-width:550px) 90vw,550px"/>)}</div></section>}{[["DLC & expansions",[...(game.dlcs||[]),...(game.expansions||[])]],["Related games",game.similar_games||[]]].map(([label,items])=>{const games=items as typeof game.similar_games;return games?.length?<section className="dashboard-section" key={String(label)}><h3>{String(label)}</h3><div className="catalog-grid">{[...new Map(games.map(item=>[item.id,item])).values()].slice(0,5).map(item=><GameCard key={item.id} game={item} returnTo={returnTo}/>)}</div></section>:null;})}</>;
}
