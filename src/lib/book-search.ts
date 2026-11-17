export type BookSearchMatch = { title: string; readinglog_count?: number };

function normalize(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

// Title similarity always wins over popularity. Keep the provider's relevance
// order for equally popular matches instead of alphabetically shuffling them.
export function rankBookTitles<T extends BookSearchMatch>(books: T[], query: string): T[] {
  const wanted = normalize(query), words = wanted.split(" ").filter(Boolean);
  function relevance(book: T) {
    const title = normalize(book.title);
    if (title === wanted) return 4;
    if (title.startsWith(`${wanted} `)) return 3;
    if (title.includes(wanted)) return 2;
    const titleWords = new Set(title.split(" "));
    return words.length && words.every(word => titleWords.has(word)) ? 1 : 0;
  }
  return [...books].sort((a, b) => relevance(b) - relevance(a) || (b.readinglog_count || 0) - (a.readinglog_count || 0));
}
