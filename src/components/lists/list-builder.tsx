"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, BookOpen, Check, Clapperboard, GripVertical, ImageOff, Plus, Search, Tv, Gamepad2, X } from "lucide-react";
import { MediaImage } from "@/components/movies/media-image";
import { searchCalendarCatalog } from "@/app/calendar/actions";
import { createListWithItems, updateListWithItems } from "@/app/lists/actions";
import type { LibraryOption } from "@/lib/calendar-domain";

type Category = "movie" | "tv" | "game" | "book";
type Step = "details" | "category" | "search" | "review";
const categories: { value: Category; label: string; icon: typeof Clapperboard }[] = [
  { value: "movie", label: "Movies", icon: Clapperboard },
  { value: "tv", label: "TV Shows", icon: Tv },
  { value: "game", label: "Games", icon: Gamepad2 },
  { value: "book", label: "Books", icon: BookOpen },
];
const categoryLabel: Record<Category, string> = { movie: "Movie", tv: "TV Show", game: "Game", book: "Book" };

export function ListBuilder({ mode, listId, initial }: { mode: "create" | "edit"; listId?: string; initial?: { name: string; description: string; visibility: "private" | "public"; items: LibraryOption[] } }) {
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [visibility, setVisibility] = useState<"private" | "public">(initial?.visibility || "private");
  const [items, setItems] = useState<LibraryOption[]>(initial?.items || []);
  const [category, setCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LibraryOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [justAdded, setJustAdded] = useState<{ title: string; duplicate: boolean } | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== "search" || !category) return;
    const term = query.trim();
    if (term.length < 2) return;
    let stopped = false;
    const timer = setTimeout(async () => {
      setSearching(true); setSearchError("");
      try {
        const result = await searchCalendarCatalog(term, category, 1);
        if (stopped) return;
        setResults(result.items);
        if (result.error) setSearchError(result.error);
      } catch { if (!stopped) setSearchError("Search is unavailable. Please try again."); }
      finally { if (!stopped) setSearching(false); }
    }, 300);
    return () => { stopped = true; clearTimeout(timer); };
  }, [step, category, query]);

  useEffect(() => { if (step === "search") input.current?.focus(); }, [step, category]);

  function openCategory(value: Category) { setCategory(value); setQuery(""); setResults([]); setSearchError(""); setJustAdded(null); setStep("search"); }
  function addItem(item: LibraryOption) {
    const duplicate = items.some(existing => existing.media_type === item.media_type && existing.provider_id === item.provider_id);
    if (!duplicate) setItems(current => [...current, item]);
    setJustAdded({ title: item.title, duplicate });
  }
  function removeItem(item: LibraryOption) { setItems(current => current.filter(existing => !(existing.media_type === item.media_type && existing.provider_id === item.provider_id))); }
  function move(item: LibraryOption, direction: -1 | 1) {
    setItems(current => {
      const index = current.findIndex(existing => existing.media_type === item.media_type && existing.provider_id === item.provider_id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function reorderByDrag(overItem: LibraryOption) {
    if (!dragKey) return;
    setItems(current => {
      const from = current.findIndex(entry => `${entry.media_type}:${entry.provider_id}` === dragKey);
      const to = current.findIndex(entry => entry.media_type === overItem.media_type && entry.provider_id === overItem.provider_id);
      if (from < 0 || to < 0 || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function save() {
    if (!name.trim()) { setError("Give your list a name."); setStep("details"); return; }
    setError("");
    const payload = { name, description, visibility, items: items.map(item => ({ media_type: item.media_type, id: item.provider_id })) };
    startTransition(async () => {
      const result = mode === "create" ? await createListWithItems(payload) : await updateListWithItems(listId!, payload);
      if (result?.error) setError(result.error);
    });
  }

  return <div className="list-builder">
    {step === "details" && <div className="list-builder-step">
      <p className="eyebrow">{mode === "create" ? "NEW LIST" : "EDIT LIST"}</p>
      <label>List name<input value={name} onChange={event => setName(event.target.value)} maxLength={100} placeholder="Rainy day favorites" autoFocus/></label>
      <label>Description<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={2000} rows={3} placeholder="What ties these together? (optional)"/></label>
      <label className="list-visibility-toggle"><span>Public list</span><input type="checkbox" role="switch" checked={visibility === "public"} onChange={event => setVisibility(event.target.checked ? "public" : "private")}/></label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="list-builder-actions">
        <button type="button" className="account-button" disabled={!name.trim()} onClick={() => setStep("category")}><Plus size={15}/>Add Media</button>
        {items.length > 0 && <button type="button" className="calendar-secondary" onClick={() => setStep("review")}>Review &amp; save ({items.length})</button>}
      </div>
    </div>}

    {step === "category" && <div className="list-builder-step">
      <div className="hobby-search-heading"><button type="button" className="icon-button" aria-label="Back" onClick={() => setStep(items.length ? "review" : "details")}><ArrowLeft size={16}/></button><h3>Add media</h3></div>
      <div className="list-builder-categories" role="group" aria-label="Media category">{categories.map(({ value, label, icon: Icon }) => <button type="button" key={value} className="list-builder-category" onClick={() => openCategory(value)}><Icon size={26} strokeWidth={1.6}/><span>{label}</span></button>)}</div>
    </div>}

    {step === "search" && category && <div className="list-builder-step">
      <div className="hobby-search-heading"><button type="button" className="icon-button" aria-label="Back to categories" onClick={() => setStep("category")}><ArrowLeft size={16}/></button><h3>Search {categories.find(c => c.value === category)!.label.toLowerCase()}</h3></div>
      <div className="hobby-search-input"><Search size={17}/><input ref={input} type="search" value={query} placeholder={`Search ${categories.find(c => c.value === category)!.label.toLowerCase()}…`} onChange={event => { const value = event.target.value; setQuery(value); setJustAdded(null); if (value.trim().length < 2) { setResults([]); setSearching(false); setSearchError(""); } }}/></div>
      {justAdded && <div className="list-builder-added" role="status">
        <span>{justAdded.duplicate ? <>“{justAdded.title}” is already on this list.</> : <><Check size={14}/> Added “{justAdded.title}”.</>}</span>
        <div className="list-builder-added-actions">
          <button type="button" className="calendar-secondary" onClick={() => setJustAdded(null)}>Add another {categoryLabel[category].toLowerCase()}</button>
          <button type="button" className="calendar-secondary" onClick={() => setStep("category")}>Add other media</button>
          <button type="button" className="account-button" onClick={() => setStep("review")}>Done adding ({items.length})</button>
        </div>
      </div>}
      {query.trim().length < 2 ? <p className="hobby-search-status">Search for a title to add to this list.</p> : <div className="hobby-results" role="listbox" aria-label={`Matching ${category}`}>
        {results.map(item => { const added = items.some(existing => existing.media_type === item.media_type && existing.provider_id === item.provider_id); return <button key={item.key} type="button" role="option" aria-selected={added} className="hobby-result" onClick={() => addItem(item)}><BuilderCover item={item}/><span><strong>{item.title}</strong><small>{item.year ? item.year : categoryLabel[item.media_type]}</small></span>{added ? <Check size={15}/> : <Plus size={15}/>}</button>; })}
        {searching && <p className="hobby-search-status" role="status">Searching…</p>}
        {!searching && !searchError && !results.length && <p className="hobby-search-status">No matching titles.</p>}
        {searchError && <p className="form-error" role="alert">{searchError}</p>}
      </div>}
    </div>}

    {step === "review" && <div className="list-builder-step list-builder-review">
      <div className="hobby-search-heading"><button type="button" className="icon-button" aria-label="Back" onClick={() => setStep("details")}><ArrowLeft size={16}/></button><h3>Review your list</h3></div>
      <label>List name<input value={name} onChange={event => setName(event.target.value)} maxLength={100}/></label>
      <label>Description<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={2000} rows={2}/></label>
      <div className="list-builder-carousel-heading"><span>{items.length} {items.length === 1 ? "item" : "items"}</span><button type="button" className="text-link" onClick={() => setStep("category")}><Plus size={13}/> Add more media</button></div>
      {items.length ? <div className="list-builder-carousel" role="list">
        {items.map(item => <div key={item.key} role="listitem" className="list-builder-carousel-item" draggable onDragStart={() => setDragKey(`${item.media_type}:${item.provider_id}`)} onDragOver={event => event.preventDefault()} onDrop={() => reorderByDrag(item)} onDragEnd={() => setDragKey(null)}>
          <span className="list-builder-drag-handle" aria-hidden="true"><GripVertical size={14}/></span>
          <BuilderCover item={item} large/>
          <strong>{item.title}</strong>
          <span className="list-builder-carousel-controls">
            <button type="button" className="icon-button" aria-label={`Move ${item.title} earlier`} onClick={() => move(item, -1)}><ArrowLeft size={14}/></button>
            <button type="button" className="icon-button" aria-label={`Remove ${item.title} from list`} onClick={() => removeItem(item)}><X size={14}/></button>
            <button type="button" className="icon-button" aria-label={`Move ${item.title} later`} onClick={() => move(item, 1)}><ArrowLeft size={14} style={{ transform: "rotate(180deg)" }}/></button>
          </span>
        </div>)}
      </div> : <p className="welcome-copy">No media added yet.</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <button type="button" className="account-button" disabled={pending} onClick={save}>{pending ? "Please wait…" : mode === "create" ? "Create List" : "Save changes"}</button>
    </div>}
  </div>;
}

function BuilderCover({ item, large = false }: { item: LibraryOption; large?: boolean }) {
  return <span className={`hobby-cover${large ? " hobby-cover-large" : ""}`}>{item.image_url ? <MediaImage src={item.image_url} alt={`${item.title} cover`} width={large ? 180 : 72} height={large ? 270 : 108} sizes={large ? "100px" : "40px"}/> : <ImageOff size={large ? 25 : 15}/>}</span>;
}
