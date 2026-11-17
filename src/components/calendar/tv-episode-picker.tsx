"use client";
import { useEffect, useState } from "react";
import { loadActivitySeasons, loadActivitySeason } from "@/app/calendar/activity-actions";

export function useTvSeasons(showId: number | null) {
  const [seasons, setSeasons] = useState<{ season_number: number; name: string; episode_count: number }[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (showId === null) return;
    let active = true;
    loadActivitySeasons(showId).then(result => { if (active) { setSeasons(result.seasons); setError(result.error || ""); } }).catch(() => { if (active) setError("Seasons could not be loaded. Please try again."); });
    return () => { active = false; };
  }, [showId]);
  return { seasons, error };
}

export function TvEpisodePicker({ showId, initialSeason, initialEpisode }: { showId: number; initialSeason: number | null; initialEpisode: number | null }) {
  const { seasons, error: seasonError } = useTvSeasons(showId);
  const [season, setSeason] = useState<number | null>(initialSeason);
  const [episode, setEpisode] = useState<number | null>(initialEpisode);
  const [result, setResult] = useState<{ season: number; episodes: { episode_number: number; name?: string }[]; error?: string } | null>(null);
  useEffect(() => {
    if (season === null) return;
    let active = true;
    loadActivitySeason(showId, season).then(value => { if (active) setResult({ season, ...value }); }).catch(() => { if (active) setResult({ season, episodes: [], error: "Episodes could not be loaded. Please try again." }); });
    return () => { active = false; };
  }, [showId, season]);
  const options = result?.season === season ? result.episodes : [];
  const loading = season !== null && result?.season !== season;
  return <details className="calendar-form-details" open={initialSeason !== null}><summary>Season & episode <span>Optional</span></summary><div className="calendar-detail-fields">
    {loading && episode !== null && <input type="hidden" name="episode_number" value={episode}/>}
    <div className="calendar-form-row"><label>Season<select name="season_number" aria-label="Season" value={season ?? ""} onChange={event => { setSeason(event.target.value === "" ? null : Number(event.target.value)); setEpisode(null); }}><option value="">Whole show</option>{initialSeason !== null && !seasons.some(s => s.season_number === initialSeason) && <option value={initialSeason}>Saved season {initialSeason}</option>}{seasons.map(s => <option key={s.season_number} value={s.season_number}>{s.season_number === 0 ? "Specials" : s.name} · {s.episode_count} episodes</option>)}</select></label>
    <label>Episode<select name="episode_number" aria-label="Episode" disabled={season === null || loading} value={episode ?? ""} onChange={event => setEpisode(event.target.value === "" ? null : Number(event.target.value))}><option value="">{loading ? "Loading episodes…" : "Whole season"}</option>{episode === initialEpisode && season === initialSeason && initialEpisode !== null && !options.some(e => e.episode_number === initialEpisode) && <option value={initialEpisode}>Saved episode {initialEpisode}</option>}{options.map(e => <option key={e.episode_number} value={e.episode_number}>Episode {e.episode_number} · {e.name}</option>)}</select></label></div>
    {(seasonError || result?.season === season && result.error) && <p role="status" className="form-error">{seasonError || result?.error}</p>}
  </div></details>;
}
