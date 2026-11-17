import Link from "next/link";
import { CalendarDays, Plus, BookOpen } from "lucide-react";
import { getCalendarPreview } from "@/lib/calendar";
import { currentUser } from "@/lib/auth";
import { calendarTime, dateInZone, categoryLabels } from "@/lib/calendar-domain";

export async function CalendarPreview() {
  if (!await currentUser()) return null;
  const today = dateInZone(new Date(), "America/Denver");
  const { plans, memories, error } = await getCalendarPreview(today);
  const href = (date: string, extra: Record<string, string>) => `/calendar?${new URLSearchParams({ date, ...extra })}`;
  return <section className="dashboard-section calendar-home"><div className="section-heading"><div><p className="eyebrow">YOUR TIME, YOUR STORIES</p><h2><CalendarDays size={20}/>Calendar & memories</h2></div><Link className="text-link" href="/calendar">Open calendar</Link></div>
    <div className="calendar-home-actions"><Link className="calendar-secondary" href={href(today, { create: "plan" })}><Plus size={14}/>Plan activity</Link><Link className="calendar-secondary" href={href(today, { create: "actual" })}><BookOpen size={14}/>Log activity</Link><Link className="calendar-secondary" href="/calendar?view=agenda&history=all">View journal</Link></div>
    {error ? <p className="welcome-copy" role="status">Your calendar is temporarily unavailable. <Link className="text-link" href="/calendar">Try opening it again</Link></p> : <div className="calendar-preview-grid"><div><h3>Upcoming plans</h3>{plans.length ? plans.map(entry => <Link key={entry.id} className={`calendar-preview-item calendar-category-${entry.category}`} href={href(entry.event_date, { entry: entry.id, view: "day" })}><span>{entry.event_date === today ? "Today" : new Date(`${entry.event_date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} · {calendarTime(entry.start_time)}</span><strong>{entry.title}</strong><small>{categoryLabels[entry.category]}</small></Link>) : <p className="welcome-copy">No plans coming up. Make a little time for something you love.</p>}</div><div><h3>Recent memories</h3>{memories.length ? memories.map(entry => <Link key={entry.id} className={`calendar-preview-item calendar-category-${entry.category}`} href={href(entry.event_date, { entry: entry.id, view: "agenda" })}><span>{entry.event_date} · {categoryLabels[entry.category]}</span><strong>{entry.title}</strong>{entry.notes && <p>{entry.notes}</p>}</Link>) : <p className="welcome-copy">Your logged activities and memories will appear here.</p>}</div></div>}
  </section>;
}
