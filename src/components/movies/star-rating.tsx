"use client";
import { Star } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

export function StarRating({ defaultValue }: { defaultValue: number | null }) {
  const [rating, setRating] = useState(defaultValue || 0);
  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    setRating(value => event.key === "Home" ? 0.5 : event.key === "End" ? 5 : Math.max(0, Math.min(5, value + (["ArrowLeft", "ArrowDown"].includes(event.key) ? -0.5 : 0.5))));
  }
  return <div className="review-rating">
    <input type="hidden" name="rating" value={rating || ""} />
    <div className="review-rating-heading"><span>Your rating</span><output aria-live="polite" aria-label="Selected rating">{rating ? `${rating} / 5` : "Not rated"}</output></div>
    <div className="rating-stars" role="group" aria-label="Your Hobbyist rating" onKeyDown={handleKeys}>
      {[1, 2, 3, 4, 5].map(value => {
        const selected = Math.ceil(rating) === value;
        const halfSelected = rating === value - 0.5;
        return <button key={value} type="button" className="rating-star" aria-label={`${value} ${value === 1 ? "star" : "stars"}${halfSelected ? ", half selected" : selected ? ", selected" : ""}`} aria-pressed={selected} onClick={event => {
          const bounds = event.currentTarget.getBoundingClientRect();
          setRating(event.clientX < bounds.left + bounds.width / 2 ? value - 0.5 : value);
        }}>
        <Star className="star-outline" size={34} strokeWidth={1.4} aria-hidden="true" />
        <span className="star-fill" style={{ width: `${Math.max(0, Math.min(1, rating - value + 1)) * 100}%` }} aria-hidden="true"><Star size={34} fill="currentColor" strokeWidth={1.4} /></span>
      </button>;
      })}
      <button type="button" className="rating-clear" disabled={!rating} onClick={() => setRating(0)}>Clear</button>
    </div>
  </div>;
}
