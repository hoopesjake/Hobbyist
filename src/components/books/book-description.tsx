"use client";

import { useState } from "react";

export function BookDescription({ description, tagline }: { description: string; tagline?: string }) {
  const [expanded, setExpanded] = useState(false);
  return <div className="book-description">
    {tagline && <p className="book-tagline">{tagline}</p>}
    <p id="book-description" className={`title-overview${expanded || description.length <= 220 ? "" : " book-description-preview"}`}>{description || "No description is available."}</p>
    {description.length > 220 && <button type="button" className="text-link" aria-expanded={expanded} aria-controls="book-description" onClick={() => setExpanded(!expanded)}>{expanded ? "Read less" : "Read more"}</button>}
  </div>;
}
