import { CalendarDays, BookOpen, ChartNoAxesColumn, Clapperboard, Gamepad2, Hammer, House, Layers3, Music2, UserRound, UsersRound, Tv, type LucideIcon } from "lucide-react";

export interface NavigationItem { label: string; href: string; icon: LucideIcon; keywords: string[]; }

export const navigationItems: NavigationItem[] = [
  { label: "Home", href: "/", icon: House, keywords: ["dashboard"] },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, keywords: ["schedule", "journal", "memories", "plan", "activity"] },
  { label: "Movies", href: "/movies", icon: Clapperboard, keywords: ["film", "watched", "watchlist"] },
  { label: "TV Shows", href: "/tv", icon: Tv, keywords: ["series", "episodes", "seasons"] },
  { label: "Actors", href: "/actors", icon: UsersRound, keywords: ["cast", "filmography", "followed"] },
  { label: "My Lists", href: "/lists", icon: Layers3, keywords: ["custom", "movies", "shows", "public", "private"] },
  { label: "Games", href: "/games", icon: Gamepad2, keywords: ["gaming", "backlog", "wishlist", "igdb", "playing"] },
  { label: "Books", href: "/books", icon: BookOpen, keywords: ["reading", "reading list"] },
  { label: "Music", href: "/music", icon: Music2, keywords: ["library", "albums"] },
  { label: "Collections", href: "/collections", icon: Layers3, keywords: ["custom", "lists"] },
  { label: "Projects", href: "/projects", icon: Hammer, keywords: ["making", "building"] },
  { label: "Community", href: "/community", icon: UsersRound, keywords: ["friends", "social"] },
  { label: "Hobby Reports", href: "/reports", icon: ChartNoAxesColumn, keywords: ["yearly", "stats"] },
  { label: "My Profile", href: "/profile", icon: UserRound, keywords: ["identity", "favorites", "mosaic"] },
];

export interface QuickLink { label: string; subtitle: string; href: string; icon: LucideIcon; }

export const quickLinks: QuickLink[] = [
  { label: "Movie watchlist", subtitle: "Movies", href: "/movies/library?filter=watchlist", icon: Clapperboard },
  { label: "TV library", subtitle: "TV Shows", href: "/tv/library", icon: Tv },
  { label: "Gaming backlog", subtitle: "Games", href: "/games/backlog", icon: Gamepad2 },
  { label: "Reading list", subtitle: "Books", href: "/books/reading-list", icon: BookOpen },
  { label: "Music library", subtitle: "Music", href: "/music/library", icon: Music2 },
  { label: "Collections", subtitle: "Your lists", href: "/collections", icon: Layers3 },
  { label: "Projects", subtitle: "In progress", href: "/projects", icon: Hammer },
];
