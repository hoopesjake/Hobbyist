import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { activityCreateHref, activityEntryHref, getMediaActivity, type ActivityMediaType } from "@/lib/media-activity";
import { calendarTime, dateInZone, type CalendarEntry, type SessionEpisode } from "@/lib/calendar-domain";
import { getEpisode } from "@/lib/tmdb";
import { MediaActivityPanel } from "./media-activity-panel";

export function LibraryActivity({ type, id, plans }: { type: ActivityMediaType; id: number; plans: CalendarEntry[] }) {
  return <div className="library-activity">{plans[0] && <Link className="library-plan-indicator" href={activityEntryHref(plans[0])}><CalendarDays size={12}/><span>{plans.length > 1 ? `${plans.length} upcoming plans` : `${plans[0].event_date} · ${calendarTime(plans[0].start_time)}`}</span></Link>}<Link className="hobby-change" href={activityCreateHref(type, id, "plan")}>{type === "game" ? "Plan gaming session" : type === "book" ? "Plan reading session" : "Plan to watch"}</Link></div>;
}

export async function MediaActivity({ type, id, season, episode, title, image = null }: { type: ActivityMediaType; id: number; season?: number; episode?: number; title?: string; image?: string | null }) {
  if (!await currentUser()) return null;
  const result = await getMediaActivity(type, id);
  const entries = result.entries.filter(entry => season === undefined || (entry.season_number === season && (episode === undefined || entry.episode_number === episode)) || entry.episodes?.some(e => e.season_number === season && (episode === undefined || e.episode_number === episode)));
  let selectedEpisodes: SessionEpisode[] | undefined;
  if (type === "tv" && season !== undefined && episode !== undefined) {
    try { const e = await getEpisode(id, season, episode); selectedEpisodes = [{ season_number: e.season_number, episode_number: e.episode_number, tmdb_episode_id: e.id, name: e.name }]; } catch { /* Show and saved activity remain available. */ }
  }
  return <MediaActivityPanel type={type} id={id} title={title || entries[0]?.media_title || `${type === "movie" ? "Movie" : type === "tv" ? "TV show" : type === "book" ? "Book" : "Game"} #${id}`} image={image || entries[0]?.media_image || null} entries={entries} today={dateInZone(new Date(), "America/Denver")} error={result.error} season={season} episode={episode} selectedEpisodes={selectedEpisodes}/>;
}
