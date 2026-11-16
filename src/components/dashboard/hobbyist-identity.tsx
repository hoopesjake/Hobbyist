import Link from "next/link";
import { topFour } from "@/data/dashboard";

export function HobbyistIdentity() {
  return <div className="identity-preview"><Link className="top-four" href="/profile" aria-label="View your Top 4 favorites">{topFour.map((title) => <span className="identity-tile" key={title}><span>{title}</span></span>)}</Link><Link className="mosaic-preview" href="/profile" aria-label="View your Hobbyist Mosaic">{["Films", "Books", "Games", "Projects"].map((label) => <span className="mosaic-tile" key={label}><span className="mosaic-overlay">{label}</span></span>)}<span className="identity-label">Your mosaic, taking shape</span></Link></div>;
}