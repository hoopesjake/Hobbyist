import { Star } from "lucide-react";

export function RatingStars({ rating, centered = false }: { rating: number | null | undefined; centered?: boolean }) {
  if (!rating) return null;
  return <span className={`personal-rating-stars${centered ? " centered" : ""}`} role="img" aria-label={`Your Hobbyist rating: ${rating} out of 5 stars`} title={`Your rating: ${rating} / 5`}>
    {[1, 2, 3, 4, 5].map(value => <span className="personal-rating-star" key={value} aria-hidden="true"><Star size={15} strokeWidth={1.5} className="personal-star-outline" /><span className="personal-star-fill" style={{ width: `${Math.max(0, Math.min(1, rating - value + 1)) * 100}%` }}><Star size={15} fill="currentColor" strokeWidth={1.5} /></span></span>)}
  </span>;
}
