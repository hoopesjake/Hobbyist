"use client";
import { useState } from "react";
import { FavoritesGrid } from "./favorites-grid";
import { FavoritesEditor } from "./favorites-editor";
import type { FavoriteCategory, ResolvedFavorite } from "@/lib/favorites";

const titles: Record<FavoriteCategory, string> = { movie: "My Top 4 Movies", tv: "My Top 4 TV Shows", game: "My Top 4 Games", book: "My Top 4 Books" };

export function FavoritesManager({ category, favorites }: { category: FavoriteCategory; favorites: ResolvedFavorite[] }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <FavoritesEditor category={category} initial={favorites.map(favorite => favorite.option)} onDone={() => setEditing(false)}/>;
  return <section className="favorites-grid-section">
    <div className="favorites-grid-heading"><h3>{titles[category]}</h3><button type="button" className="text-link" onClick={() => setEditing(true)}>Edit</button></div>
    {favorites.length ? <FavoritesGrid favorites={favorites}/> : <p className="welcome-copy">Choose up to 4 favorite {category === "tv" ? "shows" : `${category}s`}.</p>}
  </section>;
}
