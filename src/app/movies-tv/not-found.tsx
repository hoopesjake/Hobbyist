import Link from "next/link";
export default function NotFound() { return <section className="library-panel"><h2>We could not find that title or person</h2><p>Try searching the catalog for something else.</p><Link className="text-link" href="/movies-tv">Back to discover</Link></section>; }
