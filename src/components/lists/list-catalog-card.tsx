import { CatalogCard } from "@/components/movies/catalog-card";
import { GameCard } from "@/components/games/game-card";
import { BookCard } from "@/components/books/book-card";
import type { ListCatalogItem } from "@/lib/list-catalog";
export function ListCatalogCard({item}:{item:ListCatalogItem}){
  if(item.media_type==="game")return <GameCard game={item}/>;
  if(item.media_type==="book")return <BookCard book={item}/>;
  return <CatalogCard item={item}/>;
}
