import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";
import { PageLoading } from "@/components/ui/page-loading";

export const metadata: Metadata = {
  title: { default: "Hobbyist", template: "%s | Hobbyist" },
  description: "A home for everything you love to spend time with.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body><Suspense fallback={<PageLoading/>}><AppShell>{children}</AppShell></Suspense></body>
    </html>
  );
}
