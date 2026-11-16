import { Discovery,type DiscoveryParams } from "@/components/media/discovery";
export default async function Page({searchParams}:{searchParams:Promise<DiscoveryParams>}){return <Discovery kind="tv" params={await searchParams}/>;}
