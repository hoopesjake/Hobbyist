import "server-only";
export class IgdbError extends Error {
  constructor(message: string, readonly status = 503) { super(message); this.name = "IgdbError"; }
}
export function createIgdbTransport(clientId: () => string | undefined, secret: () => string | undefined, fetcher: typeof fetch = fetch) {
  let token: { value: string; expires: number } | null = null;
  let pendingToken: Promise<string> | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;
  let nextRequest = 0;
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  async function accessToken() {
    if (token && token.expires > Date.now()) return token.value;
    if (pendingToken) return pendingToken;
    const id = clientId()?.trim(), password = secret()?.trim();
    if (!id || !password) throw new IgdbError("The game catalog is not configured yet.");
    pendingToken = (async () => {
      let response: Response;
      try { response = await fetcher("https://id.twitch.tv/oauth2/token", { method: "POST", body: new URLSearchParams({ client_id: id, client_secret: password, grant_type: "client_credentials" }), cache: "no-store", signal: AbortSignal.timeout(10000) }); }
      catch { throw new IgdbError("Game catalog authentication is temporarily unavailable."); }
      if (!response.ok) throw new IgdbError("Game catalog authentication failed. Check the server configuration.");
      let data;
      try { data = await response.json(); } catch { throw new IgdbError("Game catalog authentication returned an invalid response."); }
      if (!data || typeof data.access_token !== "string" || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new IgdbError("Game catalog authentication returned an invalid response.");
      token = { value: data.access_token, expires: Date.now() + Math.max(1, data.expires_in - 60) * 1000 };
      return token.value;
    })();
    try { return await pendingToken; } finally { pendingToken = null; }
  }
  async function request<T>(endpoint: "games" | "genres" | "platforms", body: string): Promise<T[]> {
    if (pending >= 64) throw new IgdbError("The game catalog is busy. Please try again shortly.", 429);
    pending++;
    const operation = tail.catch(() => undefined).then(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const bearer = await accessToken();
        await wait(Math.max(0, nextRequest - Date.now()));
        nextRequest = Date.now() + 300;
        let response: Response;
        try { response = await fetcher(`https://api.igdb.com/v4/${endpoint}`, { method: "POST", headers: { "Client-ID": clientId()!.trim(), Authorization: `Bearer ${bearer}`, Accept: "application/json", "Content-Type": "text/plain" }, body, cache: "no-store", signal: AbortSignal.timeout(12000) }); }
        catch { throw new IgdbError("The game catalog is taking too long to respond."); }
        if (response.status === 401 && attempt < 2) { token = null; continue; }
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          const retry = Number(response.headers.get("Retry-After") || 1);
          await wait(Math.min(2000, Math.max(300, Number.isFinite(retry) ? retry * 1000 : 1000)));
          continue;
        }
        if (!response.ok) throw new IgdbError(response.status === 429 ? "The game catalog is busy. Please try again shortly." : "The game catalog is temporarily unavailable.", response.status);
        let data: unknown;
        try { data = await response.json(); } catch { throw new IgdbError("The game catalog returned an invalid response."); }
        if (!Array.isArray(data)) throw new IgdbError("The game catalog returned an invalid response.");
        return data as T[];
      }
      throw new IgdbError("The game catalog is temporarily unavailable.");
    });
    tail = operation;
    try { return await operation; } finally { pending--; }
  }
  return { request };
}
