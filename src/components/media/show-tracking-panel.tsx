"use client";
import { useState } from "react";
import { ActionForm, type FormState } from "@/components/auth/action-form";
import { StarRating } from "@/components/movies/star-rating";
import { RatingStars } from "@/components/movies/rating-stars";
import { saveShow, removeTracking } from "@/app/tracking-actions";
import { showStatusOptions, showStatusLabels, type ShowStatus } from "@/lib/tracking-validation";
import type { ShowTracking } from "@/lib/tracking";

type Episode = { season_number: number; episode_number: number };

// Collapsed by default behind a "Review" button, same as movies/episodes, so the page isn't
// crowded with the full rating/review/status/date form until the viewer actually wants it.
export function ShowTrackingPanel({ id, entry, signedIn, unavailable, latest, next }: { id: number; entry: ShowTracking | null; signedIn: boolean; unavailable: boolean; latest: Episode | null; next: Episode | null }) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<ShowStatus>(entry?.status || "planned");
  const [feedback, setFeedback] = useState("");
  async function save(state: FormState, form: FormData) {
    const result = await saveShow(state, form);
    if (result.message) setFeedback(result.message);
    return result;
  }
  async function remove(state: FormState, form: FormData) {
    if (!window.confirm("Remove this show and all its personal episode tracking?")) return {};
    const result = await removeTracking(state, form);
    if (result.message) setFeedback(result.message);
    return result;
  }
  if (unavailable) return <p className="welcome-copy">Your tracking data could not be loaded. Refresh before making changes.</p>;
  if (!signedIn) return <p className="review-sign-in">Sign in to rate, review, and track this show.</p>;
  const showsStarted = status !== "planned";
  const showsFinished = status === "completed";
  if (!expanded) return (
    <div className="show-tracking-panel show-tracking-collapsed">
      <button type="button" className="account-button review-trigger" onClick={() => setExpanded(true)}>Review</button>
      <p className="poster-saved-status">{showStatusLabels[status]}</p>
      <RatingStars rating={entry?.rating} centered/>
      {status === "watching" && latest && <p className="show-tracking-progress">Season {latest.season_number} &middot; Episode {latest.episode_number} watched{next ? <> &mdash; up next: {next.season_number === latest.season_number ? `Episode ${next.episode_number}` : `S${next.season_number} E${next.episode_number}`}</> : <> &mdash; you&rsquo;re all caught up</>}</p>}
    </div>
  );
  return (
    <div className="show-tracking-panel">
      <button type="button" className="calendar-edit show-tracking-collapse" onClick={() => setExpanded(false)}>Hide</button>
      <ActionForm key={entry?.updated_at || "new"} action={save} label="Save">
        <input type="hidden" name="tmdb_id" value={id} />
        <input type="hidden" name="kind" value="show" />
        <StarRating defaultValue={entry?.rating ?? null} label="My rating" />
        <div className="show-tracking-review-row">
          <label htmlFor="show-review-field">Review</label>
          <label className="check-label show-tracking-spoilers"><input type="checkbox" name="contains_spoilers" defaultChecked={entry?.contains_spoilers || false} /><span className="spoilers-full">Contains spoilers</span><span className="spoilers-short">Spoilers?</span></label>
        </div>
        <textarea id="show-review-field" name="review" aria-label="Review text" defaultValue={entry?.review || ""} maxLength={10000} rows={3} placeholder="What stayed with you? (optional)" />
        <label>Watching status
          <select aria-label="Show status" name="status" value={status} onChange={(event) => setStatus(event.target.value as ShowStatus)}>
            {showStatusOptions.map((value) => <option key={value} value={value}>{showStatusLabels[value]}</option>)}
            {entry?.status === "watched" && <option value="watched">{showStatusLabels.watched}</option>}
          </select>
        </label>
        <div className="calendar-form-row show-tracking-dates">
          {showsStarted ? <label>Start date<input type="date" name="started_on" defaultValue={entry?.started_on || ""} /></label> : <input type="hidden" name="started_on" value={entry?.started_on || ""} />}
          {showsFinished ? <label>Date finished<input type="date" name="completed_on" defaultValue={entry?.completed_on || ""} /></label> : <input type="hidden" name="completed_on" value={entry?.completed_on || ""} />}
        </div>
        {status === "watching" && (
          <p className="show-tracking-progress">
            {latest ? <>Season {latest.season_number} &middot; Episode {latest.episode_number} watched{next ? <> &mdash; up next: {next.season_number === latest.season_number ? `Episode ${next.episode_number}` : `S${next.season_number} E${next.episode_number}`}</> : <> &mdash; you&rsquo;re all caught up</>}</> : "No episodes marked watched yet."}
          </p>
        )}
        {status === "watching" && latest && !next && <p className="show-tracking-progress-hint"><button type="button" className="calendar-edit" onClick={() => setStatus("completed")}>Mark as Completed</button></p>}
      </ActionForm>
      {feedback && <p className="tracking-feedback" role="status">{feedback}</p>}
      {entry && <div className="review-remove"><ActionForm action={remove} label="Remove show & episode tracking"><input type="hidden" name="tmdb_id" value={id} /><input type="hidden" name="kind" value="show" /></ActionForm></div>}
    </div>
  );
}
