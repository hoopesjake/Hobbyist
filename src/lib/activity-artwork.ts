import "server-only";
import { getTitle, getEpisode, imageUrl, titleName } from "@/lib/tmdb";
import { getGameCards, gameImage } from "@/lib/igdb";
import type { CalendarEntry } from "@/lib/calendar-domain";

// Imported dated tracking stores provider identity, not a second catalog. Resolve
// its display metadata through the existing provider cache, with stable fallbacks.
export async function activityArtwork(entries: CalendarEntry[]) {
  const metadata = new Map<string, { title: string; image: string | null }>();
  const unresolved = [...new Map(entries.filter(e => e.media_type && e.media_type !== "book" && e.provider_id && (!e.media_image || e.source_key)).map(e => [`${e.media_type}:${e.provider_id}`, e])).values()];
  for (let offset = 0; offset < unresolved.length; offset += 8) {
    await Promise.all(unresolved.slice(offset, offset + 8).map(async entry => {
      try {
        const key = `${entry.media_type}:${entry.provider_id}`;
        if (entry.media_type === "game") {
          const game = (await getGameCards([entry.provider_id!]))[0];
          if (game) metadata.set(key, { title: game.name, image: gameImage(game.cover?.image_id) });
        } else {
          const title = await getTitle(entry.media_type as "movie" | "tv", entry.provider_id!);
          metadata.set(key, { title: titleName(title), image: imageUrl(title.poster_path) });
        }
      } catch { /* Saved personal activities remain usable during catalog outages. */ }
    }));
  }
  return Promise.all(entries.map(async original => {
    let e = original;
    if (e.media_type === "tv" && e.season_number !== null && e.episode_number !== null && !e.episodes?.length) {
      try {
        const episode = await getEpisode(e.provider_id!, e.season_number, e.episode_number);
        e = { ...e, episodes: [{ season_number: episode.season_number, episode_number: episode.episode_number, tmdb_episode_id: episode.id, name: episode.name }] };
      } catch { /* Existing show links remain usable without live episode metadata. */ }
    }
    const meta = metadata.get(`${e.media_type}:${e.provider_id}`);
    if (!meta) return e;
    const generic = /^(Movie|TV show|Game) #\d+$/.test(e.title);
    return { ...e, media_title: meta.title, media_image: e.media_image || meta.image, title: generic ? meta.title : e.title };
  }));
}
