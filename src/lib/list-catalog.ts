import "server-only";
import { getTitle,type CatalogItem } from "@/lib/tmdb";
import { getGame,type GameSummary } from "@/lib/igdb";
import type { ListItem } from "@/lib/lists";
export type ListCatalogItem=CatalogItem|(GameSummary&{media_type:"game"});
export async function getListCatalogItem(item:ListItem):Promise<ListCatalogItem>{
 if(item.media_type==="game"){try{return {...await getGame(item.igdb_id!),media_type:"game"};}catch{return {id:item.igdb_id!,name:`Game #${item.igdb_id} (catalog unavailable)`,media_type:"game"};}}
 try{return await getTitle(item.media_type,item.tmdb_id!);}catch{return {id:item.tmdb_id!,media_type:item.media_type,title:`${item.media_type==="movie"?"Movie":"Show"} #${item.tmdb_id}`};}
}
