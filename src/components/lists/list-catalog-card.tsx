import { CatalogCard } from "@/components/movies/catalog-card";
import { GameCard } from "@/components/games/game-card";
import type { ListCatalogItem } from "@/lib/list-catalog";
export function ListCatalogCard({item}:{item:ListCatalogItem}){return item.media_type==="game"?<GameCard game={item}/>:<CatalogCard item={item}/>;}
