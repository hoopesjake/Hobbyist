import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { gameFilters,gameStatusLabels,type GameStatus } from "@/lib/game-validation";
import { GameLibrary } from "@/components/games/game-library";
import { AddMediaHeaderLink } from "@/components/ui/add-media-tile";
export default async function Page({searchParams}:{searchParams:Promise<{filter?:string;page?:string}>}){
 await requireUser();const params=await searchParams;const filter=gameFilters.includes(params.filter as typeof gameFilters[number])?params.filter!:"all";const labels:Record<string,string>={all:"All",...gameStatusLabels,wishlist:"Wishlist",to_be_played:"To Be Played",want_to_play_more:"Want to Play More",favorites:"Favorites",owned:"Owned"};
 return <><div className="section-heading"><h2>Your game library</h2><AddMediaHeaderLink href="/games/discover" label="Add a game"/></div><nav className="status-filters" aria-label="Game library filters">{gameFilters.map(value=><Link key={value} href={`?filter=${value}`} aria-current={filter===value?"page":undefined}>{labels[value as GameStatus]}</Link>)}</nav><GameLibrary filter={filter} page={Math.max(1,Math.min(100000,parseInt(params.page||"1",10)||1))}/></>;
}
