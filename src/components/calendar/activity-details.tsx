"use client";
import { ReadingSessionFields } from "@/components/books/reading-session-fields";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { loadActivityContext, loadActivitySeason } from "@/app/calendar/activity-actions";
import { StarRating } from "@/components/movies/star-rating";
import { RatingStars } from "@/components/movies/rating-stars";
import type { CalendarDraft } from "./calendar-editor";
import type { SessionEpisode } from "@/lib/calendar-domain";

import { useTvSeasons } from "./tv-episode-picker";

type EpisodeChoice = SessionEpisode & { current_rating: number | null };
export function ActivityDetails({ type, id, draft, date, planned = false, ratingTarget }: { type: "movie" | "tv" | "game" | "book"; id: number; draft: CalendarDraft; date: string; planned?: boolean; ratingTarget: HTMLElement | null }) {
  const same = draft.media_type === type && draft.provider_id === id;
  const [context, setContext] = useState<{ rating?: number | null; review?: string; spoilers?: boolean; error?: string; episodeRatings?: Record<number, number | null>; latestDate?: string; currentPage?: number; totalPages?: number | null } | null>(null);
  const [updateCurrent, setUpdateCurrent] = useState<boolean | null>(null);
  const [changed, setChanged] = useState(false);
  const [editedRating, setEditedRating] = useState<number | null>(null);
  const [reviewChanged, setReviewChanged] = useState(false);
  const [episodes, setEpisodes] = useState<SessionEpisode[]>(same ? draft.episodes || [] : []);
  const [choices, setChoices] = useState<EpisodeChoice[]>([]);
  const [season, setSeason] = useState(same ? draft.season_number ?? draft.episodes?.[0]?.season_number ?? null : null);
  const { seasons, error: seasonsError } = useTvSeasons(type === "tv" && !planned ? id : null);
  const selectedSeason = season ?? seasons.find(s => s.season_number > 0)?.season_number ?? seasons[0]?.season_number ?? null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadActivityContext(type, id, same ? draft.episodes?.map(e => e.tmdb_episode_id) : []).then(value => { if (active) setContext(value); }).catch(() => { if (active) setContext({ error: "Your current rating could not be loaded." }); });
    return () => { active = false; };
  }, [type, id, same, draft.episodes]);
  async function showSeason() {
    if (selectedSeason === null) return;
    setLoading(true); setError("");
    try { const result = await loadActivitySeason(id, selectedSeason); setChoices(result.episodes); setError(result.error || ""); }
    catch { setError("Episodes could not be loaded. Try again."); }
    finally { setLoading(false); }
  }
  function updateEpisode(episode: SessionEpisode, changes: Partial<SessionEpisode>) {
    setEpisodes(values => values.map(e => e.season_number === episode.season_number && e.episode_number === episode.episode_number ? { ...e, ...changes } : e));
  }
  const existing = !!draft.updated_at;
  const defaultUpdate = !existing && !!context && !context.error && (!context.latestDate || date >= context.latestDate);
  const snapshot = same ? draft.session_rating ?? null : null;
  const displayedRating = changed ? editedRating : snapshot ?? context?.rating ?? null;
  if (planned) return ratingTarget ? createPortal(<div className="calendar-header-rating" aria-label="Library rating"><span className="calendar-current-rating">Your rating{context?.rating != null ? `: ${context.rating} / 5` : ""}</span>{context?.error ? <p className="form-error" role="status">{context.error}</p> : context ? context.rating != null ? <RatingStars rating={context.rating}/> : <span className="calendar-current-rating">Not rated</span> : <span className="calendar-current-rating">Loading…</span>}</div>, ratingTarget) : null;
  return <section className="calendar-viewing-details" aria-label="Viewing details">
    <input type="hidden" name="rating_changed" value={changed ? "on" : ""}/>
    <input type="hidden" name="review_changed" value={reviewChanged ? "on" : ""}/>
    <input type="hidden" name="episodes" value={JSON.stringify(type === "tv" ? episodes.map(e => ({ ...e, update_current: e.update_current ?? defaultUpdate })) : [])}/>
    {ratingTarget && createPortal(<div className="calendar-header-rating"><StarRating defaultValue={null} value={displayedRating} label={snapshot != null ? "Viewing rating" : type === "tv" ? "Your show rating" : "Your rating"} onChange={rating => { setEditedRating(rating); setChanged(true); }}/></div>, ratingTarget)}
    {snapshot != null && context?.rating != null && context.rating !== snapshot && <p className="calendar-current-rating">Current {type === "tv" ? "show" : "library"} rating: {context.rating} / 5</p>}
    {context?.error && <p className="form-error" role="status">{context.error}</p>}
    {changed ? <label className="check-label"><input type="checkbox" name="update_current" checked={updateCurrent ?? defaultUpdate} onChange={event => setUpdateCurrent(event.target.checked)}/>Update current {type === "tv" ? "show" : "library"} rating</label> : <input type="hidden" name="update_current" value={defaultUpdate ? "on" : ""}/>}
    {type === "book" && <ReadingSessionFields key={`${id}`} draft={same ? draft : { ...draft, reading_start_page: null, reading_end_page: null }} currentPage={context?.currentPage} totalPages={context?.totalPages}/>}
    {type === "tv" && <div className="calendar-session-episodes">
      <h3>Episodes watched</h3>
      <div className="calendar-episode-select"><label>Season<select aria-label="Season" disabled={loading} value={selectedSeason ?? ""} onChange={event => { setSeason(event.target.value === "" ? null : Number(event.target.value)); setChoices([]); setError(""); }}><option value="">Choose season</option>{seasons.map(s => <option key={s.season_number} value={s.season_number}>{s.season_number === 0 ? "Specials" : s.name} ? {s.episode_count} episodes</option>)}</select></label><button type="button" className="calendar-secondary" disabled={loading || selectedSeason === null} onClick={showSeason}>{loading ? "Loading…" : "Choose episodes"}</button></div>
      {(error || seasonsError) && <p className="welcome-copy" role="status">{error || seasonsError}</p>}
      <div className="calendar-episode-choices">{choices.map(e => <label className="check-label" key={e.tmdb_episode_id}><input type="checkbox" checked={episodes.some(selected => selected.tmdb_episode_id === e.tmdb_episode_id)} onChange={event => setEpisodes(values => event.target.checked ? [...values, { season_number: e.season_number, episode_number: e.episode_number, tmdb_episode_id: e.tmdb_episode_id, name: e.name }] : values.filter(value => value.tmdb_episode_id !== e.tmdb_episode_id))}/>S{e.season_number} E{e.episode_number} · {e.name}{e.current_rating != null ? ` · Current ${e.current_rating}/5` : ""}</label>)}</div>
      {episodes.map(e => <div className="calendar-episode-rating" key={e.tmdb_episode_id}><div className="calendar-episode-heading"><strong>S{e.season_number} E{e.episode_number} · {e.name || "Episode"}</strong><button type="button" className="hobby-change" onClick={() => setEpisodes(values => values.filter(value => value.tmdb_episode_id !== e.tmdb_episode_id))}>Remove</button></div><StarRating name={`episode_rating_${e.tmdb_episode_id}`} label={`S${e.season_number} E${e.episode_number} session rating`} defaultValue={e.rating ?? null} onChange={rating => updateEpisode(e, { rating, rating_changed: true })}/>{context?.episodeRatings?.[e.tmdb_episode_id] != null && <p className="calendar-current-rating">Current episode rating: {context.episodeRatings[e.tmdb_episode_id]} / 5</p>}<label className="check-label"><input type="checkbox" checked={e.update_current ?? defaultUpdate} onChange={event => updateEpisode(e, { update_current: event.target.checked })}/>Update current episode rating</label></div>)}
    </div>}
    <details className="calendar-form-details"><summary>Review <span>Optional · separate from private memories</span></summary><div className="calendar-detail-fields">
      {context && !context.error ? <><label>Review<textarea aria-label="Review" key={`${type}-${id}`} name="review" rows={4} maxLength={10000} defaultValue={context.review || ""} onChange={() => setReviewChanged(true)}/></label><label className="check-label"><input type="checkbox" name="contains_spoilers" defaultChecked={context.spoilers} onChange={() => setReviewChanged(true)}/>Contains spoilers</label></> : <p className="welcome-copy">{context?.error ? "Review unavailable. Your saved review will be kept." : "Loading your review…"}</p>}
    </div></details>
  </section>;
}
