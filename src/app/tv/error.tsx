"use client";
import Link from "next/link";
export default function CatalogError({ retry }: { retry: () => void }) {
  return <section className="library-panel" role="alert"><h2>We could not load this page</h2><p>The catalog may be temporarily unavailable. Your saved viewing activity is still stored in your account.</p><button className="account-button" onClick={retry}>Try again</button><p><Link className="text-link" href="/tv">Back to discover</Link></p></section>;
}
