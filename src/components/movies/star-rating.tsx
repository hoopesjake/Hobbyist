"use client";
import { Star } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";

export function StarRating({ defaultValue, value, name = "rating", label = "Your rating", onChange }: { defaultValue: number | null; value?: number | null; name?: string; label?: string; onChange?: (value: number | null) => void }) {
  const [localRating, setRating] = useState(defaultValue || 0);
  const gradientId = useId();
  const rating = value === undefined ? localRating : value || 0;
  function update(value: number) { setRating(value); onChange?.(value || null); }
  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    update(event.key === "Home" ? 0.5 : event.key === "End" ? 5 : Math.max(0, Math.min(5, rating + (["ArrowLeft", "ArrowDown"].includes(event.key) ? -0.5 : 0.5))));
  }
  return <div className="review-rating">
    <input type="hidden" name={name} value={rating || ""} />
    <div className="review-rating-heading"><span>{label}</span><output aria-live="polite" aria-label={label === "Your rating" ? "Selected rating" : `Selected ${label.toLowerCase()}`}>{rating ? `${rating} / 5` : "Not rated"}</output></div>
    <div className="rating-stars" role="group" aria-label={label === "Your rating" ? "Your Hobbyist rating" : label} onKeyDown={handleKeys}>
      {[1, 2, 3, 4, 5].map(value => {
        const selected = Math.ceil(rating) === value;
        const halfSelected = rating === value - 0.5;
        const fill = Math.max(0, Math.min(1, rating - value + 1)) * 100;
        const id = `${gradientId}-${value}`;
        return <button key={value} type="button" className="rating-star" aria-label={`${value} ${value === 1 ? "star" : "stars"}${halfSelected ? ", half selected" : selected ? ", selected" : ""}`} aria-pressed={selected} onClick={() => update(rating === value ? value - 0.5 : rating === value - 0.5 ? value - 1 : value)}>
        <span className="rating-star-glyph" aria-hidden="true">
          <Star className="rating-star-icon" size={34} strokeWidth={1.4} fill={fill === 0 ? "none" : fill === 100 ? "var(--accent)" : `url(#${id}-fill)`} stroke={fill === 0 ? "#6c6e66" : fill === 100 ? "var(--accent)" : `url(#${id}-stroke)`}>
            <defs>
              <linearGradient id={`${id}-fill`}><stop offset={`${fill}%`} stopColor="var(--accent)"/><stop offset={`${fill}%`} stopColor="transparent"/></linearGradient>
              <linearGradient id={`${id}-stroke`}><stop offset={`${fill}%`} stopColor="var(--accent)"/><stop offset={`${fill}%`} stopColor="#6c6e66"/></linearGradient>
            </defs>
          </Star>
        </span>
      </button>;
      })}
      <button type="button" className="rating-clear" disabled={!rating} onClick={() => update(0)}>Clear</button>
    </div>
  </div>;
}
