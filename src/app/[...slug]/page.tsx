import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";

interface PlaceholderRoute {
  title: string;
  description: string;
  note: string;
}

const placeholderRoutes: Record<string, PlaceholderRoute> = {
  "/games": { title: "Games", description: "Keep your adventures, finished games, and next-play plans together.", note: "Your game library and backlog will live here." },
  "/games/backlog": { title: "Gaming backlog", description: "A place for the games you cannot wait to get around to.", note: "Your backlog will take shape here." },
  "/books": { title: "Books", description: "Keep track of what you are reading, what moved you, and what is next on the shelf.", note: "Your reading lists and history will live here." },
  "/books/reading-list": { title: "Reading list", description: "A growing list of books you want to spend time with.", note: "Your reading list will take shape here." },
  "/music": { title: "Music", description: "Gather the albums, artists, and listening memories that make up your soundtrack.", note: "Your music space will live here." },
  "/music/library": { title: "Music library", description: "A personal home for the music you keep coming back to.", note: "Your music library will take shape here." },
  "/collections": { title: "Collections", description: "Bring your interests together in lists that are entirely your own.", note: "Your collections will take shape here." },
  "/projects": { title: "Projects", description: "Make room for the things you are building, learning, and creating.", note: "Your personal projects will live here." },
  "/community": { title: "Community", description: "Find what your friends love, share a little of your own, and discover something new together.", note: "Your community will take shape here." },
  "/reports": { title: "Hobby Reports", description: "A thoughtful look back at the time and attention you gave the things you love.", note: "Your personal hobby reports will live here." },
  "/profile": { title: "My Profile", description: "A small portrait of your many interests, from your all-time favorites to the things you are into right now.", note: "Your Top 4 and Hobbyist Mosaic will live here." },
};

type RouteParams = { slug: string[] };

export const instant = false;

function getRoute(slug: string[]) {
  return placeholderRoutes[`/${slug.join("/")}`];
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const route = getRoute((await params).slug);
  return route ? { title: route.title } : {};
}

export default async function PlaceholderPage({ params }: { params: Promise<RouteParams> }) {
  const route = getRoute((await params).slug);
  if (!route) notFound();

  return (
    <div className="placeholder-page">
      <Link className="back-link" href="/"><ArrowLeft size={15} aria-hidden="true" /> Back to home</Link>
      <p className="eyebrow">A PLACE FOR WHAT YOU LOVE</p>
      <h1>{route.title}</h1>
      <p>{route.description}</p>
      <section className="placeholder-panel" aria-label={`${route.title} preview`}>
        <p><Sparkles size={15} style={{ display: "inline", marginRight: 7, color: "var(--accent)", verticalAlign: "-3px" }} aria-hidden="true" />{route.note}</p>
        <span>HOBBYIST · A LITTLE OF EVERYTHING</span>
      </section>
    </div>
  );
}