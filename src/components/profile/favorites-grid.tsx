import Link from "next/link";
import { ImageOff } from "lucide-react";
import { MediaImage } from "@/components/movies/media-image";
import type { ResolvedFavorite } from "@/lib/favorites";

const categoryHref: Record<string, string> = { movie: "/movies", tv: "/tv", game: "/games", book: "/books" };

export function FavoritesGrid({ favorites }: { favorites: ResolvedFavorite[] }) {
  if (!favorites.length) return null;
  return <div className="favorites-grid">
    {favorites.map(favorite => {
      const root = categoryHref[favorite.row.category];
      const id = favorite.row.category === "book" ? `OL${favorite.option.provider_id}W` : favorite.option.provider_id;
      return <Link key={favorite.option.key} className="favorites-grid-tile" href={`${root}/${id}`} title={favorite.option.title}>
        {favorite.option.image_url ? <MediaImage src={favorite.option.image_url} alt={`${favorite.option.title} cover`} width={180} height={270} sizes="(max-width:550px) 22vw,120px"/> : <span className="poster-fallback"><ImageOff size={18}/></span>}
      </Link>;
    })}
  </div>;
}
