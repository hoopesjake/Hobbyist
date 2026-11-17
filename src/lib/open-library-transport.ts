export class BookCatalogError extends Error {
  readonly status: number;
  constructor(message = "The book catalog is temporarily unavailable. Please try again.", status = 503) { super(message); this.name = "BookCatalogError"; this.status = status; }
}
export function openLibraryWorkId(value: unknown): number | null {
  const match = typeof value === "string" ? /^(?:\/works\/)?OL([1-9]\d{0,9})W$/.exec(value) : null;
  return match && Number(match[1]) <= 2147483647 ? Number(match[1]) : null;
}
export function bookCover(id: unknown) { return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false` : null; }

// Requests are serialized and paced conservatively below Open Library's identified
// 3 requests/second limit. No credentials or API key are required.
export function createOpenLibraryTransport(contact: () => string | undefined, fetcher: typeof fetch = fetch) {
  let queue: Promise<unknown> = Promise.resolve(), nextStart = 0;
  return { request<T>(path: string): Promise<T> {
    const run = async () => {
      const email = contact()?.trim();
      if (!email || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new BookCatalogError("Book search needs OPEN_LIBRARY_CONTACT_EMAIL configured on the server.");
      if (!path.startsWith("/") || path.startsWith("//")) throw new BookCatalogError("Invalid book lookup.", 400);
      for (let attempt = 0; attempt < 2; attempt++) {
        const delay = Math.max(0, nextStart - Date.now());
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        nextStart = Date.now() + 400;
        let response: Response;
        try { response = await fetcher(`https://openlibrary.org${path}`, { headers: { "User-Agent": `Hobbyist/1.0 (${email})`, email, Accept: "application/json" }, signal: AbortSignal.timeout(12000), cache: "no-store" }); }
        catch { throw new BookCatalogError(); }
        if ((response.status === 429 || response.status === 503) && attempt === 0) {
          nextStart = Date.now() + Math.min(10000, Math.max(1000, Number(response.headers.get("retry-after")) * 1000 || 1000));
          await response.body?.cancel(); continue;
        }
        if (!response.ok) throw new BookCatalogError(response.status === 404 ? "This book could not be found." : undefined, response.status === 404 ? 404 : 503);
        try { return await response.json() as T; } catch { throw new BookCatalogError(); }
      }
      throw new BookCatalogError();
    };
    const result = queue.then(run, run); queue = result.catch(() => {}); return result;
  } };
}
