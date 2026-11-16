import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { quickLinks } from "@/lib/navigation";

export function QuickAccess() {
  return <div className="quick-grid">{quickLinks.map(({ label, subtitle, href, icon: Icon }) => <Link className="quick-link" href={href} key={label}><span className="quick-icon"><Icon size={17} strokeWidth={1.8} aria-hidden="true" /></span><span className="quick-link-label"><strong>{label}</strong><span>{subtitle}</span></span><ChevronRight size={14} aria-hidden="true" style={{ marginLeft: "auto", flexShrink: 0, color: "#777b76" }} /></Link>)}</div>;
}