export interface EnjoyingItem { category: string; title: string; detail: string; progressLabel: string; progress: number; href: string; artworkClass: string; }
export const enjoyingItems: EnjoyingItem[] = [
  { category: "Watching", title: "The Quiet Wild", detail: "Season 1 · Episode 4", progressLabel: "4 of 8 episodes", progress: 50, href: "/movies-tv", artworkClass: "art-watch" },
  { category: "Playing", title: "Tides of Ember", detail: "Chapter 6 · 14h played", progressLabel: "About halfway", progress: 54, href: "/games", artworkClass: "art-play" },
  { category: "Reading", title: "A Map of Small Things", detail: "Mira Ellery", progressLabel: "Page 182 of 310", progress: 59, href: "/books", artworkClass: "art-read" },
  { category: "Building", title: "Greenhouse No. 4", detail: "Weekend project", progressLabel: "Bag 6 of 10", progress: 60, href: "/projects", artworkClass: "art-build" },
];
export interface ActivityItem { kind: "game" | "movie" | "project"; description: string; title: string; time: string; rating?: string; }
export const recentActivity: ActivityItem[] = [
  { kind: "game", description: "Completed", title: "Tides of Ember", time: "Yesterday", rating: "4.5 / 5" },
  { kind: "movie", description: "Rated", title: "The Long Way Home", time: "Sunday", rating: "4 / 5" },
  { kind: "project", description: "Finished a build", title: "Little Bookshop", time: "Nov 12" },
];
export interface FriendActivityItem { initials: string; name: string; action: string; title: string; time: string; style: string; }
export const friendsActivity: FriendActivityItem[] = [
  { initials: "J", name: "Jamie", action: "started reading", title: "The Orchard at Dusk", time: "2 hours ago", style: "friend-one" },
  { initials: "R", name: "Riley", action: "finished watching", title: "A Small Season", time: "Yesterday", style: "friend-two" },
];
