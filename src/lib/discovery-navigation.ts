export type DiscoveryRoot = "/games" | "/movies" | "/tv";

export function discoveryReturnTo(value: unknown, root: DiscoveryRoot): string {
  const fallback = `${root}/discover`;
  if (typeof value !== "string" || value.length > 2000) return fallback;
  try {
    const url = new URL(value, "https://hobbyist.local");
    if (url.origin !== "https://hobbyist.local" || url.pathname !== fallback) return fallback;
    const params = new URLSearchParams();
    for (const key of root === "/games" ? ["q", "page", "genre", "platform"] : ["q", "page"]) {
      const entry = url.searchParams.get(key);
      if (entry) params.set(key, entry);
    }
    return `${fallback}${params.size ? `?${params}` : ""}`;
  } catch {
    return fallback;
  }
}

export function withDiscoveryReturnTo(href: string, returnTo?: string): string {
  if (!returnTo) return href;
  const [path, hash] = href.split("#", 2);
  return `${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams({ returnTo })}${hash ? `#${hash}` : ""}`;
}
