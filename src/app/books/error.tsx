"use client";
import { BackLink } from "@/components/layout/back-link";
export default function BooksError({ reset }: { reset: () => void }) { return <section className="library-panel" role="alert"><h2>Books could not be loaded</h2><p>Your reading records have not been changed.</p><button className="calendar-secondary" onClick={reset}>Try again</button><BackLink href="/books">Back to books</BackLink></section>; }
