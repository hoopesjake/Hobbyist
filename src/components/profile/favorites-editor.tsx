"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Check, ImageOff, Plus, Search, X } from "lucide-react";
import { MediaImage } from "@/components/movies/media-image";
import { searchCalendarCatalog } from "@/app/calendar/actions";
import { saveFavorites } from "@/app/profile/favorites-actions";
import type { LibraryOption } from "@/lib/calendar-domain";
import type { FavoriteCategory } from "@/lib/favorites";

const categoryLabel: Record<FavoriteCategory, string> = { movie: "movies", tv: "TV shows", game: "games", book: "books" };

export function FavoritesEditor({ category, initial, onDone }: { category: FavoriteCategory; initial: LibraryOption[]; onDone: () => void }) {
  const [items, setItems] = useState<LibraryOption[]>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LibraryOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    let stopped = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try { const result = await searchCalendarCatalog(term, category, 1); if (!stopped) setResults(result.items); }
      catch { if (!stopped) setError("Search is unavailable. Please try again."); }
      finally { if (!stopped) setSearching(false); }
    }, 300);
    return () => { stopped = true; clearTimeout(timer); };
  }, [query, category]);

  function add(item: LibraryOption) {
    if (items.length >= 4 || items.some(existing => existing.provider_id === item.provider_id)) return;
    setItems(current => [...current, item]);
  }
  function remove(item: LibraryOption) { setItems(current => current.filter(existing => existing.provider_id !== item.provider_id)); }
  function move(item: LibraryOption, direction: -1 | 1) {
    setItems(current => {
      const index = current.findIndex(existing => existing.provider_id === item.provider_id);
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function save() {
    setError("");
    startTransition(async () => {
      const result = await saveFavorites(category, items.map(item => ({ media_type: item.media_type, id: item.provider_id })));
      if (result.error) setError(result.error); else onDone();
    });
  }

  return <div className="favorites-editor">
    <div className="hobby-search-heading"><button type="button" className="icon-button" aria-label="Cancel" onClick={onDone}><ArrowLeft size={16}/></button><h3>Top 4 {categoryLabel[category]}</h3></div>
    {items.length > 0 && <div className="favorites-editor-selected">{items.map(item => <div className="favorites-editor-tile" key={item.key}><FavoriteCover item={item}/><button type="button" className="icon-button" aria-label={`Remove ${item.title}`} onClick={() => remove(item)}><X size={13}/></button><div className="favorites-editor-order"><button type="button" className="icon-button" aria-label={`Move ${item.title} earlier`} onClick={() => move(item, -1)}><ArrowLeft size={12}/></button><button type="button" className="icon-button" aria-label={`Move ${item.title} later`} onClick={() => move(item, 1)}><ArrowLeft size={12} style={{ transform: "rotate(180deg)" }}/></button></div></div>)}</div>}
    {items.length < 4 ? <>
      <div className="hobby-search-input"><Search size={17}/><input ref={input} type="search" value={query} placeholder={`Search ${categoryLabel[category]}…`} onChange={event => setQuery(event.target.value)}/></div>
      {query.trim().length >= 2 && <div className="hobby-results" role="listbox" aria-label={`Matching ${categoryLabel[category]}`}>
        {results.map(item => { const added = items.some(existing => existing.provider_id === item.provider_id); return <button key={item.key} type="button" role="option" aria-selected={added} className="hobby-result" disabled={added} onClick={() => add(item)}><FavoriteCover item={item}/><span><strong>{item.title}</strong><small>{item.year || ""}</small></span>{added ? <Check size={15}/> : <Plus size={15}/>}</button>; })}
        {searching && <p className="hobby-search-status" role="status">Searching…</p>}
        {!searching && !results.length && <p className="hobby-search-status">No matching titles.</p>}
      </div>}
    </> : <p className="welcome-copy">Remove one to add another &mdash; four is the limit.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="list-builder-actions">
      <button type="button" className="account-button" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save favorites"}</button>
      <button type="button" className="calendar-secondary" disabled={pending} onClick={onDone}>Cancel</button>
    </div>
  </div>;
}

function FavoriteCover({ item }: { item: LibraryOption }) {
  return <span className="hobby-cover">{item.image_url ? <MediaImage src={item.image_url} alt={`${item.title} cover`} width={72} height={108} sizes="40px"/> : <ImageOff size={15}/>}</span>;
}
