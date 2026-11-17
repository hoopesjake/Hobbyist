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
export function listItem(form: FormData) {
  const type = form.get("media_type");
  const id = String(form.get(type === "game" ? "igdb_id" : "tmdb_id") || "");
  if ((type !== "movie" && type !== "tv" && type !== "game") || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) > 2147483647) return null;
  if (type === "game") return { media_type: type, igdb_id: Number(id) } as const;
  return { media_type: type, tmdb_id: Number(id) } as const;
}
