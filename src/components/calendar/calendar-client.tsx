"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Check, Clock3, BookOpen, LockKeyhole } from "lucide-react";
import { CalendarEditor, type CalendarDraft } from "@/components/calendar/calendar-editor";
import { addCalendarDays, actualMinutes, calendarRange, calendarTime, categoryLabels, dateInZone, durationLabel, entryOnDate, mediaHref, type CalendarEntry, type CalendarView } from "@/lib/calendar-domain";

import { RatingStars } from "@/components/movies/rating-stars";
import { ActivityPhotos } from "@/components/calendar/activity-photos";
import { CalendarEvent } from "@/components/calendar/calendar-event";

type Props = { allHistory?: boolean; entries: CalendarEntry[]; date: string; today: string; view: CalendarView; timeZone: string; initialDraft?: CalendarDraft; initialEntry?: CalendarEntry | null };
const dateLabel = (date: string, options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" }) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });

export function CalendarClient({ entries, date, today, view, timeZone, initialDraft, initialEntry, allHistory }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<CalendarDraft | null>(initialEntry || initialDraft || null);
  const [feedback, setFeedback] = useState<{ message: string } | null>(null);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(timer);
  }, [feedback]);
  const { start, end } = calendarRange(view, date);
  const days = Array.from({ length: view === "month" ? 42 : view === "week" ? 7 : view === "day" ? 1 : 31 }, (_, i) => addCalendarDays(start, i)).filter(day => day < end);
  const visible = allHistory && view === "agenda" ? entries : entries.filter(entry => entry.event_date < end && (entry.end_date || entry.event_date) >= start);
  const agendaDays = allHistory ? [...new Set(visible.map(e => e.event_date))].sort().reverse() : days;
  const planCount = visible.filter(entry => entry.kind === "plan").length;
  const actualCount = visible.filter(entry => entry.kind === "actual").length;
  function create(kind: "plan" | "actual", day = date, time?: string) {
    setDraft({ id: crypto.randomUUID(), kind, event_date: day, start_time: time || null, time_zone: timeZone });
  }
  function close() {
    setDraft(null);
    if (initialEntry || initialDraft) router.replace(calendarUrl(view, date, timeZone), { scroll: false });
  }
  function openActual(plan: CalendarEntry) {
    const actual = entries.find(entry => entry.plan_id === plan.id);
    if (actual) { setDraft(actual); return; }
    const now = dateInZone(new Date(), plan.time_zone);
    setDraft({ id: crypto.randomUUID(), kind: "actual", plan_id: plan.id, event_date: plan.event_date > now ? now : plan.event_date,
      title: plan.title, category: plan.category, time_zone: plan.time_zone, participants: plan.participants,
      media_type: plan.media_type, provider: plan.provider, provider_id: plan.provider_id, media_title: plan.media_title, media_image: plan.media_image, episodes: plan.episodes,
      season_number: plan.season_number, episode_number: plan.episode_number });
  }
  return <>
    <div className="calendar-action-row"><div className="calendar-legend"><span><i/>Planned</span><span><Check size={13}/>Logged</span><span><LockKeyhole size={12}/>Private</span></div><div className="calendar-actions"><button className="calendar-secondary" onClick={() => create("actual")}><BookOpen size={15}/>Log activity</button><button className="account-button" onClick={() => create("plan")}><Plus size={16}/>Plan activity</button></div></div>
    {feedback && <p className="calendar-feedback" role="status">{feedback.message}</p>}
    {view === "month" && <div className="calendar-month"><div className="calendar-weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-month-grid">{days.map(day => {
      const activities = visible.filter(entry => entryOnDate(entry, day));
      return <section key={day} className={`calendar-cell${day.slice(0, 7) !== date.slice(0, 7) ? " calendar-outside" : ""}${day === today ? " calendar-today" : ""}${day === date ? " calendar-selected" : ""}`} aria-label={dateLabel(day, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}>
        <div className="calendar-cell-heading"><Link href={calendarUrl("day", day, timeZone)} aria-label={`Open ${dateLabel(day)}`}>{Number(day.slice(8))}</Link><button aria-label={`Add activity on ${dateLabel(day)}`} onClick={() => create("plan", day)}><Plus size={12}/></button></div>
        <div className="calendar-cell-events">{activities.slice(0, 3).map(entry => <CalendarEvent entry={entry} className={`calendar-event calendar-category-${entry.category} calendar-event-${entry.kind}`} key={entry.id} onClick={() => setDraft(entry)}><span className="calendar-event-icon">{entry.kind === "actual" ? <Check size={10}/> : <i/>}</span><span>{entry.start_time && <small>{calendarTime(entry.start_time)}</small>}{entry.title}</span></CalendarEvent>)}{activities.length > 3 && <Link className="calendar-more" href={calendarUrl("day", day, timeZone)}>+{activities.length - 3} more</Link>}</div>
      </section>;
    })}</div></div>}
    {(view === "week" || view === "day") && <Schedule key={`${view}-${date}`} days={days} entries={visible} today={today} timeZone={timeZone} onCreate={create} onOpen={setDraft}/>}
    {view === "agenda" && <div className="calendar-agenda">{visible.length ? agendaDays.filter(day => visible.some(entry => entryOnDate(entry, day))).map(day => <section className="calendar-agenda-day" key={day}><header><Link href={calendarUrl("day", day, timeZone)}><span>{dateLabel(day, { weekday: "short" })}</span><strong>{Number(day.slice(8))}</strong><small>{dateLabel(day, { month: "short", year: "numeric" })}</small></Link></header><div>{visible.filter(entry => entryOnDate(entry, day)).map(entry => <ActivityCard key={entry.id} entry={entry} onOpen={() => setDraft(entry)}/>)}</div></section>) : <EmptyCalendar onPlan={() => create("plan")} onLog={() => create("actual")}/>}</div>}
    <div className="calendar-period-summary"><span>{planCount} {planCount === 1 ? "plan" : "plans"}</span><span>{actualCount} actual {actualCount === 1 ? "activity" : "activities"}</span><span><Clock3 size={13}/>{durationLabel(actualMinutes(visible)) || "0m"} logged</span></div>
    {draft && <CalendarEditor key={draft.id} draft={draft} onClose={close} onSaved={message => { setFeedback({ message }); close(); router.refresh(); }} onLog={draft.kind === "plan" && draft.updated_at ? () => openActual(draft as CalendarEntry) : undefined} related={entries.find(entry => entry.plan_id === draft.id)} originalPlan={entries.find(entry => entry.id === draft.plan_id)} onOpenPlan={entries.some(entry => entry.id === draft.plan_id) ? () => setDraft(entries.find(entry => entry.id === draft.plan_id)!) : undefined}/>}
  </>;
}

export function calendarUrl(view: CalendarView, date: string, timeZone: string) {
  return `/calendar?${new URLSearchParams({ view, date, tz: timeZone })}`;
}

function EmptyCalendar({ onPlan, onLog }: { onPlan: () => void; onLog: () => void }) {
  return <div className="calendar-empty"><BookOpen size={25}/><h2>A little space for your life.</h2><p>No activities in this period yet.</p><div className="calendar-actions"><button className="calendar-secondary" onClick={onLog}>Log a memory</button><button className="account-button" onClick={onPlan}>Make a plan</button></div></div>;
}

function ActivityCard({ entry, onOpen }: { entry: CalendarEntry; onOpen: () => void }) {
  const linked = mediaHref(entry);
  return <article className={`calendar-activity-card calendar-category-${entry.category}`}><div className="calendar-activity-meta"><span>{categoryLabels[entry.category]}</span><span>{entry.kind === "actual" ? <><Check size={12}/>Logged</> : `Plan · ${entry.status}`}</span></div><button className="calendar-activity-title" onClick={onOpen}>{entry.title}</button><p className="calendar-activity-time">{calendarTime(entry.start_time)}{entry.end_time ? ` – ${calendarTime(entry.end_time)}${entry.end_date !== entry.event_date ? ` (${entry.end_date})` : ""}` : ""} · {entry.approximate ? "About " : ""}{durationLabel(entry.duration_minutes)}{entry.start_time && <small>{entry.time_zone.replaceAll("_", " ")}</small>}</p><RatingStars rating={entry.session_rating}/>{entry.pages_read != null && <p className="calendar-participants">Pages {entry.reading_start_page}?{entry.reading_end_page} ? {entry.pages_read} pages read</p>}{entry.episodes?.map(e => <p className="calendar-participants" key={e.tmdb_episode_id}>S{e.season_number} E{e.episode_number}{e.rating != null ? ` ? ${e.rating}/5` : ""}</p>)}{entry.notes && <p className="calendar-memory-preview">{entry.notes}</p>}{entry.participants && <p className="calendar-participants">With {entry.participants}</p>}{linked && <Link className="text-link calendar-media-link" href={linked}>{entry.media_title || "Linked title"}{entry.season_number !== null ? ` · S${entry.season_number}${entry.episode_number !== null ? ` E${entry.episode_number}` : ""}` : ""}</Link>}{entry.kind === "actual" && entry.media_type && <ActivityPhotos entryId={entry.id} readOnly/>}<button className="calendar-edit" onClick={onOpen}>Edit activity</button></article>;
}

function Schedule({ days, entries, today, timeZone, onCreate, onOpen }: { days: string[]; entries: CalendarEntry[]; today: string; timeZone: string; onCreate: (kind: "plan" | "actual", date: string, time?: string) => void; onOpen: (entry: CalendarEntry) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const single = days.length === 1;
  return <div className={`calendar-schedule${single ? " calendar-schedule-day" : ""}`}><div className="calendar-schedule-scroll" ref={element => { if (element && scroller.current !== element) element.scrollTop = 7 * 48; scroller.current = element; }}><div className="calendar-schedule-inner" style={{ minWidth: single ? undefined : 760 }}>
    <div className="calendar-schedule-head" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}><span className="calendar-zone-label">Local<br/>times</span>{days.map(day => <div key={day} className={day === today ? "calendar-today" : ""}><Link href={calendarUrl("day", day, timeZone)}>{dateLabel(day, { weekday: "short" })}<strong>{Number(day.slice(8))}</strong></Link></div>)}</div>
    <div className="calendar-untimed" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}><span>Date<br/>only</span>{days.map(day => <div key={day}>{entries.filter(entry => !entry.start_time && entryOnDate(entry, day)).map(entry => <CalendarEvent entry={entry} key={entry.id} className={`calendar-event calendar-category-${entry.category} calendar-event-${entry.kind}`} onClick={() => onOpen(entry)}>{entry.kind === "actual" && <Check size={10}/>}<span>{entry.title}</span></CalendarEvent>)}</div>)}</div>
    <div className="calendar-time-grid" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}><div className="calendar-hours">{Array.from({ length: 24 }, (_, hour) => <span key={hour}>{hour === 0 ? "12 AM" : `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`}</span>)}</div>{days.map(day => {
      const items = entries.filter(entry => entry.start_time && entryOnDate(entry, day)).map(entry => {
        const start = entry.event_date < day ? 0 : Number(entry.start_time!.slice(0, 2)) * 60 + Number(entry.start_time!.slice(3, 5));
        const end = entry.end_date && entry.end_time ? entry.end_date > day ? 1440 : Number(entry.end_time.slice(0, 2)) * 60 + Number(entry.end_time.slice(3, 5)) : Math.min(1440, start + (entry.duration_minutes || 30));
        return { entry, start, end: Math.max(end, start + 30), lane: 0 };
      }).sort((a, b) => a.start - b.start || a.end - b.end);
      const lanes: number[] = [];
      for (const item of items) { let lane = lanes.findIndex(end => end <= item.start); if (lane < 0) lane = lanes.length; lanes[lane] = item.end; item.lane = lane; }
      return <div className="calendar-day-column" key={day}>{Array.from({ length: 24 }, (_, hour) => <button className="calendar-time-slot" key={hour} aria-label={`Plan activity on ${dateLabel(day)} at ${calendarTime(`${String(hour).padStart(2, "0")}:00`)}`} onClick={() => onCreate("plan", day, `${String(hour).padStart(2, "0")}:00`)}/>)}{items.map(({ entry, start, end, lane }) => <CalendarEvent entry={entry} key={entry.id} className={`calendar-time-event calendar-category-${entry.category} calendar-event-${entry.kind}`} style={{ top: start * 0.8, height: Math.min(1440 - start, end - start) * 0.8, left: `calc(${lane / Math.max(1, lanes.length) * 100}% + 3px)`, width: `calc(${100 / Math.max(1, lanes.length)}% - 6px)` }} onClick={() => onOpen(entry)}><strong>{entry.kind === "actual" && <Check size={10}/>} {entry.title}</strong><small>{calendarTime(entry.start_time)} · {durationLabel(entry.duration_minutes)}</small></CalendarEvent>)}</div>;
    })}</div>
    </div></div>{single && <div className="calendar-day-details"><h2>Activities & memories</h2>{entries.filter(entry => entryOnDate(entry, days[0])).length ? entries.filter(entry => entryOnDate(entry, days[0])).map(entry => <ActivityCard key={entry.id} entry={entry} onOpen={() => onOpen(entry)}/>) : <p className="welcome-copy">No activities yet. Choose a time above or log a memory.</p>}</div>}</div>;
}
