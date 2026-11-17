import { GameDiscovery,type GameSearchParams } from "@/components/games/game-discovery";
export default async function Page({searchParams}:{searchParams:Promise<GameSearchParams>}){return <GameDiscovery params={await searchParams}/>;}
