"use client";
import { useRef, type ReactNode } from "react";
import { Pencil, X } from "lucide-react";
import { RatingStars } from "@/components/movies/rating-stars";
import { BookTrackingForm } from "./book-tracking-form";
import type { BookTracking } from "@/lib/books";
import type { BookEdition } from "@/lib/open-library";

// Collapsed to just the rating and an edit pencil, same as movies/TV/games: the full
// reading-status/edition/pages/dates/review form only appears once you ask for it.
export function BookTrackingPanel({ id, entry, editions, defaultEditionId, unavailable, editionNav }: { id: number; entry: BookTracking | null; editions: BookEdition[]; defaultEditionId?: string; unavailable?: boolean; editionNav?: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <div className="poster-review">
    <div className="rating-edit-trigger"><RatingStars rating={entry?.rating} centered/><button type="button" className="icon-button rating-edit-pencil" aria-label="Edit your reading status, rating, and dates" onClick={() => dialog.current?.showModal()}><Pencil size={14}/></button></div>
    <dialog ref={dialog} className="review-dialog" aria-label="Your reading" onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <div className="review-dialog-content">
        <div className="review-dialog-header"><div/><button type="button" className="icon-button" aria-label="Close" onClick={() => dialog.current?.close()}><X size={20}/></button></div>
        <BookTrackingForm id={id} entry={entry} editions={editions} defaultEditionId={defaultEditionId} unavailable={unavailable} onSaved={() => dialog.current?.close()}/>
        {editionNav}
      </div>
    </dialog>
  </div>;
}
