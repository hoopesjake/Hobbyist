import Link from "next/link";
import { Plus } from "lucide-react";
export function AddMediaTile({ href, label }: { href: string; label: string }) {
  return <Link className="catalog-card add-media-tile" href={href} aria-label={label}>
    <div className="catalog-poster add-media-poster"><Plus size={28} strokeWidth={1.5}/></div>
  </Link>;
}
export function AddMediaHeaderLink({ href, label }: { href: string; label: string }) {
  return <Link className="add-media-header-link" href={href} aria-label={label}><Plus size={16} strokeWidth={2}/></Link>;
}
