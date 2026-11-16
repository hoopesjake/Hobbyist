import { MediaTitlePage } from "@/components/media/title-page";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{season?:string;episodes?:string}>}){return <MediaTitlePage kind="tv" id={(await params).id} filters={await searchParams}/>;}
