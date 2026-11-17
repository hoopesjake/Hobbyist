import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ComponentProps } from "react";

export function BackLink({ children, className = "", ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} className={`back-link ${className}`.trim()}><span className="back-link-arrow" aria-hidden="true"><ArrowLeft size={16}/></span><span>{children}</span></Link>;
}
