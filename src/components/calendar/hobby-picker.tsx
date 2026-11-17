"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Search, Library, Plus, ArrowLeft, Check, ImageOff, ChevronRight, Clapperboard, Tv, Gamepad2, BookOpen } from "lucide-react";
import { loadCalendarLibrary, searchCalendarCatalog } from "@/app/calendar/actions";
import { MediaImage } from "@/components/movies/media-image";
import type { LibraryOption } from "@/lib/calendar-domain";

type Mode = "choose" | "library" | "catalog";
type HobbyType = LibraryOption["media_type"] | "book";
const labels = { movie: "Movie", tv: "TV show", game: "Game", book: "Book" };
const hobbyTypes = [{ value: "movie", label: "Movies", icon: Clapperboard }, { value: "tv", label: "TV shows", icon: Tv }, { value: "game", label: "Games", icon: Gamepad2 }, { value: "book", label: "Books", icon: BookOpen }] as const;
export function HobbyPicker({ initial, onSelect, onPicking, onCustom, ratingRef }: {
  initial: LibraryOption | null;
  onSelect: (item: LibraryOption, addToLibrary: boolean) => void;
  onPicking: (picking: boolean) => void;
  onCustom: () => void;
  ratingRef?: (element: HTMLDivElement | null) => void;
}) {
  const [selected, setSelected] = useState(initial);
  const [mode, setMode] = useState<Mode>("choose");
  const [choosing, setChoosing] = useState(!initial);
  const [custom, setCustom] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<HobbyType | null>(null);
  const [items, setItems] = useState<LibraryOption[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  useEffect(() => { if (choosing && mode !== "choose") input.current?.focus(); }, [choosing, mode, type]);
  useEffect(() => {
    if (!choosing || mode === "choose") return;
    let stopped = false;
    const timer = setTimeout(async () => {
      setPending(true); setError("");
      try {
        if (mode === "catalog") {
          const types = type ? [type] : ["movie", "tv", "game", "book"] as const;
          const found = new Map<string, LibraryOption>();
          const results = query.trim().length >= 2 ? await Promise.all(types.map(async kind => {
            const result = await searchCalendarCatalog(query, kind, page);
            if (!stopped) { for (const item of result.items) found.set(item.key, item); setItems([...found.values()]); }
            return result;
          })) : [];
          if (!stopped) {
            setItems([...new Map(results.flatMap(result => result.items).map(item => [item.key, item])).values()]);
            setMore(results.some(result => result.hasMore));
            setError(results.some(result => result.error) ? "Some catalogs are temporarily unavailable." : "");
          }
        } else {
          let current = 1, hasMore = true;
          const found = new Map<string, LibraryOption>();
          while (!stopped && hasMore && current <= 10000) {
            const result = await loadCalendarLibrary(type === "movie" ? "movies" : type === "tv" ? "tv" : type === "game" ? "games" : type === "book" ? "books" : "all", current);
            for (const item of result.items) if (!query.trim() || item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) found.set(item.key, item);
            if (!stopped) { setItems([...found.values()]); setError(result.error || ""); }
            if (result.error) break;
            hasMore = result.hasMore;
            // Browse recent items first; a search continues through older pages.
            if (!query.trim() && current >= page) break;
            current++;
          }
          if (!stopped) setMore(hasMore && !query.trim());
        }
      } catch { if (!stopped) setError("Your hobbies could not be loaded. Please try again."); }
      finally { if (!stopped) setPending(false); }
    }, query.trim() ? 300 : 0);
    return () => { stopped = true; clearTimeout(timer); };
  }, [mode, choosing, query, type, page]);
  // Enrich an existing selected card without making editing depend on a catalog.
  useEffect(() => {
    if (!initial || initial.image_url) return;
    let stopped = false;
    loadCalendarLibrary(initial.media_type === "game" ? "games" : initial.media_type === "movie" ? "movies" : initial.media_type === "book" ? "books" : "tv", 1).then(result => {
      const item = result.items.find(item => item.key === initial.key);
      if (!stopped && item) setSelected(item);
    }).catch(() => {});
    return () => { stopped = true; };
  }, [initial]);
  function open(next: Mode) { setCustom(false); setMode(next); setType(null); setPending(next === "library"); setChoosing(true); setQuery(""); setItems([]); setError(""); setActive(0); setPage(1); onPicking(true); }
  function chooseType(value: HobbyType | null) { const next = value === type ? null : value; setType(next); setPending(mode === "library" || query.trim().length >= 2); setItems([]); setError(""); setActive(0); setPage(1); setMore(false); }
  function choose(item: LibraryOption) { setCustom(false); setSelected(item); setChoosing(false); onPicking(false); onSelect(item, item.in_library === false); }
  const needsQuery = mode === "catalog" && query.trim().length < 2;
  return <section className="hobby-picker" aria-label="Link hobby">
    {custom && !choosing ? <div className="hobby-custom-selected"><Library size={22}/><div><h3>Your own moment</h3><p>A hobby, project, or memory.</p></div><button type="button" className="hobby-change" onClick={() => open("choose")}>Link hobby</button></div> : !choosing && selected ? <div className="hobby-selected">
      {selected.image_url && <div className="hobby-selected-backdrop" style={{ backgroundImage: `url("${selected.image_url}")` }}/>}<div className="hobby-selected-content"><HobbyCover item={selected} large/><div><p className="eyebrow"><Check size={12}/>HOBBY LINKED</p><h3>{selected.title}</h3><div className="hobby-selected-rating" ref={ratingRef}/><p>{labels[selected.media_type]}{selected.year ? ` · ${selected.year}` : ""}</p><button type="button" className="hobby-change" onClick={() => open("library")}>Change hobby</button></div></div>
    </div> : mode === "choose" ? <div className="hobby-start"><p className="eyebrow">START WITH WHAT YOU LOVE</p><h3>Link a hobby to your time.</h3><button type="button" className="hobby-path" onClick={() => open("library")}><Library size={22}/><span><strong>Link hobby</strong><small>Pick something from your library</small></span><ChevronRight size={17}/></button><button type="button" className="hobby-path" onClick={() => open("catalog")}><Plus size={22}/><span><strong>Add a new hobby</strong><small>Find a movie, show, game, or book</small></span><ChevronRight size={17}/></button><button className="hobby-custom" type="button" onClick={() => { setSelected(null); setCustom(true); setChoosing(false); onPicking(false); onCustom(); }}>Other activity</button></div> : <div className="hobby-search-panel">
      <div className="hobby-search-heading"><button type="button" className="icon-button" aria-label="Back to hobby choices" onClick={() => open("choose")}><ArrowLeft size={16}/></button><h3>{mode === "library" ? "Link hobby" : "Find a new hobby"}</h3>{selected && <button type="button" className="hobby-change" onClick={() => choose(selected)}>Keep selected</button>}</div>
      <div className="hobby-search-input"><Search size={17}/><input ref={input} type="search" role="combobox" aria-label={mode === "library" ? "Search library" : "Search catalog"} aria-autocomplete="list" aria-expanded={!needsQuery} aria-controls={listId} aria-activedescendant={items[active] ? `${listId}-${active}` : undefined} value={query} autoComplete="off" placeholder="What are you watching, reading, playing?" onChange={event => { setQuery(event.target.value); setPending(mode === "library" || event.target.value.trim().length >= 2); setPage(1); setActive(0); setItems([]); setMore(false); }} onKeyDown={event => {
        if (event.key === "ArrowDown") { event.preventDefault(); setActive(value => Math.min(items.length - 1, value + 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive(value => Math.max(0, value - 1)); }
        if (event.key === "Enter") { event.preventDefault(); if (items[active]) choose(items[active]); }
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (selected) { setChoosing(false); onPicking(false); } else open("choose"); }
      }}/></div>
      <div className="hobby-type-picker" role="group" aria-label="Hobby type">{hobbyTypes.map(({ value, label, icon: Icon }) => <button type="button" key={value} aria-label={label} aria-pressed={type === value} onClick={() => chooseType(value)}><span className="hobby-type-label"><Icon size={15}/><span>{label}</span></span></button>)}</div>
      <>
      <div id={listId} role="listbox" aria-label="Matching hobbies" className="hobby-results" aria-busy={pending}>{!needsQuery && items.map((item, index) => <button id={`${listId}-${index}`} role="option" aria-selected={active === index} key={item.key} type="button" className="hobby-result" onMouseEnter={() => setActive(index)} onClick={() => choose(item)}><HobbyCover item={item}/><span><strong>{item.title}</strong><small>{labels[item.media_type]}{item.year ? ` · ${item.year}` : ""}{item.in_library ? " · In your library" : mode === "catalog" ? " · Add to library" : ""}</small></span><Plus size={15}/></button>)}</div>
      {pending && <p className="hobby-search-status" role="status">Searching...</p>}
      {needsQuery && <p className="hobby-search-status">Search for a title to add to your library and calendar.</p>}
      {!pending && !error && !needsQuery && !items.length && <p className="hobby-search-status">{mode === "library" ? "No matching hobbies in your library." : "No matching titles."}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {more && !pending && <button type="button" className="hobby-change" onClick={() => setPage(value => value + 1)}>Show more</button>}
      {mode === "library" && <button type="button" className="hobby-find-new" onClick={() => open("catalog")}><Plus size={14}/>Find something new instead</button>}
      </>
    </div>}
  </section>;
}

export function HobbyCover({ item, large = false }: { item: LibraryOption; large?: boolean }) {
  return <span className={`hobby-cover${large ? " hobby-cover-large" : ""}`}>{item.image_url ? <MediaImage src={item.image_url} alt={`${item.title} cover`} width={large ? 180 : 72} height={large ? 270 : 108} sizes={large ? "100px" : "40px"}/> : <ImageOff size={large ? 25 : 15}/>}</span>;
}
