import "server-only";
import { getTitle,titleName,titleDate,imageUrl,type CatalogItem } from "@/lib/tmdb";
import { getGame,gameImage,gameRelease,type GameSummary } from "@/lib/igdb";
import { getBook,type BookDetails } from "@/lib/open-library";
import type { ListItem } from "@/lib/lists";
import type { LibraryOption } from "@/lib/calendar-domain";
export type ListCatalogItem=CatalogItem|(GameSummary&{media_type:"game"})|(BookDetails&{media_type:"book"});
export async function getListCatalogItem(item:ListItem):Promise<ListCatalogItem>{
 if(item.media_type==="game"){try{return {...await getGame(item.igdb_id!),media_type:"game"};}catch{return {id:item.igdb_id!,name:`Game #${item.igdb_id} (catalog unavailable)`,media_type:"game"};}}
 if(item.media_type==="book"){try{return {...await getBook(item.ol_id!),media_type:"book"};}catch{return {id:item.ol_id!,work_key:`/works/OL${item.ol_id}W`,title:`Book #${item.ol_id} (catalog unavailable)`,authors:[],cover_url:null,description:"",subjects:[],media_type:"book"};}}
 try{return await getTitle(item.media_type,item.tmdb_id!);}catch{return {id:item.tmdb_id!,media_type:item.media_type,title:`${item.media_type==="movie"?"Movie":"Show"} #${item.tmdb_id}`};}
}
// Normalizes a saved list item's catalog details into the same compact shape the List
// Builder's search already uses, so the edit flow can reuse that component as-is.
export function toLibraryOption(item:ListCatalogItem):LibraryOption{
 if(item.media_type==="game")return {key:`game:${item.id}`,title:item.name,media_type:"game",provider_id:item.id,image_url:gameImage(item.cover?.image_id),year:gameRelease(item.first_release_date)?.slice(0,4)};
 if(item.media_type==="book")return {key:`book:${item.id}`,title:item.title,media_type:"book",provider_id:item.id,image_url:item.cover_url,year:item.first_publish_year?String(item.first_publish_year):undefined};
 return {key:`${item.media_type}:${item.id}`,title:titleName(item),media_type:item.media_type as "movie"|"tv",provider_id:item.id,image_url:imageUrl("poster_path" in item?item.poster_path:null),year:titleDate(item)?.slice(0,4)||undefined};
}
