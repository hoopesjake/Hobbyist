import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface SectionHeadingProps { id: string; eyebrow: string; title: string; href?: string; linkLabel?: string; }

export function SectionHeading({ id, eyebrow, title, href, linkLabel }: SectionHeadingProps) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2 id={id}>{title}</h2></div>{href && linkLabel && <Link className="section-link" href={href}>{linkLabel}<ArrowUpRight size={14} aria-hidden="true" /></Link>}</div>;
}