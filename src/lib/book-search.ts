export type BookSearchMatch = { title: string; author_name?: string[]; readinglog_count?: number };

function normalize(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function bookSearchQuery(query: string) {
  // Use only literal words: user input cannot inject Solr field operators.
  const words=normalize(query).split(" ").filter(Boolean).slice(0,20).join(" AND ");
  return words ? `(title:(${words}) OR author:(${words})) AND language:eng AND cover_i:*` : "";
}

export function isBookSearchResult(book: BookSearchMatch, query: string) {
  if(!book.title.trim() || book.title.length>180 || !book.author_name?.length)return false;
  const derivatives=/\b(study guide|summary of|summary and analysis|workbook|analysis of|conversation starters)\b/;
  return !derivatives.test(normalize(book.title)) || derivatives.test(normalize(query));
}

// Title similarity always wins over popularity. Keep the provider's relevance
// order for equally popular matches instead of alphabetically shuffling them.
export function rankBookTitles<T extends BookSearchMatch>(books: T[], query: string): T[] {
  const wanted = normalize(query), words = wanted.split(" ").filter(Boolean);
  function relevance(book: T) {
    const title = normalize(book.title);
    if (title === wanted) return 6;
    if (book.author_name?.some(author=>normalize(author)===wanted)) return 5;
    if (title.startsWith(`${wanted} `)) return 4;
    if (title.includes(wanted)) return 3;
    const titleWords = new Set(title.split(" "));
    return words.length && words.every(word => titleWords.has(word)) ? 1 : 0;
  }
  return [...books].sort((a, b) => relevance(b) - relevance(a) || (b.readinglog_count || 0) - (a.readinglog_count || 0));
}
