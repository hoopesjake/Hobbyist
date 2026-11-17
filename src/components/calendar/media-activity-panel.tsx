"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarEditor, type CalendarDraft } from "./calendar-editor";
import { ActivityPhotos } from "./activity-photos";
import { RatingStars } from "@/components/movies/rating-stars";
import { calendarTime, durationLabel, type CalendarEntry, type SessionEpisode } from "@/lib/calendar-domain";

export type MediaActivityPanelProps = { type: "movie" | "tv" | "game" | "book"; id: number; title: string; image: string | null; entries: CalendarEntry[]; today: string; error?: string | null; season?: number; episode?: number; selectedEpisodes?: SessionEpisode[] };
const entryHref = (entry: CalendarEntry) => `/calendar?${new URLSearchParams({ view: "agenda", date: entry.event_date, tz: entry.time_zone, entry: entry.id })}`;

export function MediaActivityPanel({ type, id, title, image, entries, today, error, season, episode, selectedEpisodes }: MediaActivityPanelProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<CalendarDraft | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string } | null>(null);
  const history = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(null), 3000); return () => clearTimeout(timer); }, [feedback]);
  const plans = entries.filter(e => e.kind === "plan" && ["planned", "changed"].includes(e.status || "") && e.event_date >= today).sort((a,b) => a.event_date.localeCompare(b.event_date) || (a.start_time || "99").localeCompare(b.start_time || "99"));
  const actuals = entries.filter(e => e.kind === "actual").sort((a,b) => b.event_date.localeCompare(a.event_date) || b.id.localeCompare(a.id));
  function create(kind: "plan" | "actual") {
    setDraft({ id: crypto.randomUUID(), kind, event_date: today, time_zone: "America/Denver", title, category: type === "movie" ? "movies" : type === "tv" ? "tv" : type === "book" ? "books" : "games", media_type: type, provider: type === "game" ? "igdb" : type === "book" ? "openlibrary" : "tmdb", provider_id: id, media_title: title, media_image: image, library_add: true, season_number: season ?? null, episode_number: episode ?? null, episodes: kind === "actual" ? selectedEpisodes : [] });
  }
  function logPlan(plan: CalendarEntry) {
    const actual = entries.find(e => e.plan_id === plan.id);
    if (actual) { setDraft(actual); return; }
    setDraft({ id: crypto.randomUUID(), kind: "actual", event_date: plan.event_date > today ? today : plan.event_date, time_zone: plan.time_zone, plan_id: plan.id, title: plan.title, category: plan.category, media_type: plan.media_type, provider: plan.provider, provider_id: plan.provider_id, media_title: plan.media_title, media_image: plan.media_image, participants: plan.participants, episodes: plan.episodes, season_number: plan.season_number, episode_number: plan.episode_number });
  }
  return <section className="dashboard-section media-activity-section" aria-label="Calendar activity">
    <div className="section-heading"><h2>Your time with this {type === "movie" ? "movie" : type === "tv" ? "show" : type === "book" ? "book" : "game"}</h2><button type="button" className="text-link calendar-history-toggle" aria-expanded={expanded} onClick={() => { setExpanded(value => !value); history.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}>{expanded ? "Show recent activity" : "View full history"}</button></div>
    <div className="calendar-actions"><button type="button" className="calendar-secondary" onClick={() => create("plan")}>{type === "game" ? "Plan gaming session" : type === "book" ? "Plan reading session" : "Plan to watch"}</button><button type="button" className="calendar-secondary" onClick={() => create("actual")}>{type === "game" ? "Log gaming session" : type === "book" ? "Log reading session" : "Log a viewing"}</button></div>
    {expanded && <p className="calendar-current-rating">All activity: {actuals.length} logged {actuals.length === 1 ? "session" : "sessions"} · {plans.length} upcoming {plans.length === 1 ? "plan" : "plans"}</p>}
    {feedback && <p role="status" className="calendar-feedback">{feedback.message}</p>}
    {error && <p className="calendar-error" role="status">{error}</p>}
    {type === "game" && <p className="calendar-session-total">Total session time: <strong>{durationLabel(actuals.reduce((total,e) => total + (e.duration_minutes || 0), 0)) || "0m"}</strong><small>Recorded sessions · separate from manual and imported playtime</small></p>}
    <div className={`calendar-preview-grid${expanded ? " calendar-history-expanded" : ""}`} ref={history}><div><h3>Upcoming plans</h3>{plans.length ? plans.slice(0, expanded ? undefined : 4).map(entry => <Session key={entry.id} entry={entry} onOpen={() => setDraft(entry)}/>) : <p className="welcome-copy">No upcoming plans.</p>}</div><div><h3>{type === "game" ? "Recent sessions" : "Activity history"}</h3>{actuals.length ? actuals.slice(0, expanded ? undefined : 5).map(entry => <Session key={entry.id} entry={entry} onOpen={() => setDraft(entry)}/>) : <p className="welcome-copy">No sessions logged yet.</p>}</div></div>
    {draft && <CalendarEditor key={draft.id} draft={draft} onClose={() => setDraft(null)} onSaved={message => { setFeedback({ message }); setDraft(null); router.refresh(); }} onLog={draft.kind === "plan" && draft.updated_at ? () => logPlan(draft as CalendarEntry) : undefined} related={entries.find(e => e.plan_id === draft.id)} originalPlan={entries.find(e => e.id === draft.plan_id)} onOpenPlan={entries.some(e => e.id === draft.plan_id) ? () => setDraft(entries.find(e => e.id === draft.plan_id)!) : undefined}/>}
  </section>;
}

function Session({ entry, onOpen }: { entry: CalendarEntry; onOpen: () => void }) {
  return <article className={`calendar-preview-item calendar-category-${entry.category}`}><span>{entry.event_date} · {calendarTime(entry.start_time)}{entry.end_time ? ` – ${calendarTime(entry.end_time)}` : ""} · {entry.kind === "actual" ? "Logged" : entry.status}</span><button type="button" className="calendar-session-title" onClick={onOpen}>{entry.title}</button>{entry.duration_minutes != null && <small>{entry.approximate ? "About " : ""}{durationLabel(entry.duration_minutes)}</small>}<RatingStars rating={entry.session_rating}/>{entry.pages_read != null && <small>Pages {entry.reading_start_page}?{entry.reading_end_page} ? {entry.pages_read} pages read</small>}{entry.episodes?.map(e => <small key={e.tmdb_episode_id}>S{e.season_number} E{e.episode_number}{e.rating != null ? ` · ${e.rating}/5` : ""}</small>)}{entry.participants && <small>With {entry.participants}</small>}{entry.notes && <p>{entry.notes}</p>}{entry.kind === "actual" && <ActivityPhotos entryId={entry.id} readOnly/>}<div className="calendar-session-links"><button type="button" className="hobby-change" onClick={onOpen}>Open activity</button><Link className="hobby-change" href={entryHref(entry)}>View in calendar</Link></div></article>;
}
