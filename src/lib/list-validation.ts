export function listId(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
export function listFields(form: FormData) {
  const name = String(form.get("name") || "").trim();
  if (!name || [...name].length > 100) return { error: "Give your list a name up to 100 characters." } as const;
  const visibility = form.get("is_public") === "on" ? "public" : "private";
  const description = String(form.get("description") || "").trim();
  if ([...description].length > 2000) return { error: "Keep your list description within 2,000 characters." } as const;
  return { name, visibility, description } as const;
}
const listIdField: Record<string, string> = { game: "igdb_id", book: "ol_id" };
export function listItem(form: FormData) {
  const type = form.get("media_type");
  const id = String(form.get(listIdField[type as string] || "tmdb_id") || "");
  if ((type !== "movie" && type !== "tv" && type !== "game" && type !== "book") || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) > 2147483647) return null;
  if (type === "game") return { media_type: type, igdb_id: Number(id) } as const;
  if (type === "book") return { media_type: type, ol_id: Number(id) } as const;
  return { media_type: type, tmdb_id: Number(id) } as const;
}
export type DraftListItem = { media_type: "movie" | "tv" | "game" | "book"; id: number; title: string; year: string | null; cover_url: string | null };
// Shape the builder submits for the whole draft list: enough to persist identity, nothing more
// (title/cover are only needed for the wizard's own display, re-fetched live when rendering later).
export function draftListItems(value: unknown): { media_type: string; tmdb_id?: number; igdb_id?: number; ol_id?: number }[] | null {
  if (!Array.isArray(value) || value.length > 500) return null;
  const items: { media_type: string; tmdb_id?: number; igdb_id?: number; ol_id?: number }[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const type = (entry as Record<string, unknown>).media_type;
    const id = (entry as Record<string, unknown>).id;
    if ((type !== "movie" && type !== "tv" && type !== "game" && type !== "book") || typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) return null;
    items.push({ media_type: type, [type === "game" ? "igdb_id" : type === "book" ? "ol_id" : "tmdb_id"]: id });
  }
  return items;
}
