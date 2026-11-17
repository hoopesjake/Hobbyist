export function bookReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 2000) return "/books";
  try {
    const url = new URL(value, "https://hobbyist.local");
    if (url.origin !== "https://hobbyist.local" || !["/books", "/books/discover", "/books/library"].includes(url.pathname)) return "/books";
    const params = new URLSearchParams();
    for (const key of url.pathname === "/books/library" ? ["status", "page"] : ["q", "page"]) {
      const entry = url.searchParams.get(key);
      if (entry) params.set(key, entry);
    }
    return `${url.pathname}${params.size ? `?${params}` : ""}`;
  } catch { return "/books"; }
}
