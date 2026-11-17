import Link from "next/link";
import { CalendarDays, Plus, BookOpen } from "lucide-react";
import { calendarTime, categoryLabels, type CalendarEntry } from "@/lib/calendar-domain";
import { MediaImage } from "@/components/movies/media-image";

type Props={today:string;todayEntries:CalendarEntry[];plans:CalendarEntry[];memories:CalendarEntry[];error:string|null};
export function CalendarPreviewView({today,todayEntries,plans,memories,error}:Props) {
  const href=(date:string,extra:Record<string,string>)=>`/calendar?${new URLSearchParams({date,...extra})}`;
  function event(entry:CalendarEntry,isToday:boolean) {
    return <Link key={entry.id} className={`calendar-preview-item calendar-category-${entry.category}`} href={href(isToday?today:entry.event_date,{entry:entry.id,view:"day"})}>
      {entry.media_image&&<div className="home-event-cover"><MediaImage src={entry.media_image} alt="" width={40} height={58} sizes="40px"/></div>}
      <div className="home-event-copy"><span>{isToday?"Today":new Date(`${entry.event_date}T12:00:00Z`).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:"UTC"})}{" · "}{calendarTime(entry.start_time)}{entry.end_time?` – ${calendarTime(entry.end_time)}`:""}</span><strong>{entry.title}</strong><small>{categoryLabels[entry.category]}</small></div>
    </Link>;
  }
  return <section className="dashboard-section calendar-home"><div className="section-heading"><div><p className="eyebrow">MAKE A LITTLE TIME</p><h2><CalendarDays size={20}/>Your calendar</h2></div><Link className="text-link" href="/calendar">Open calendar</Link></div>
    <div className="calendar-home-actions"><Link className="calendar-secondary" href={href(today,{create:"plan"})}><Plus size={14}/>Plan activity</Link><Link className="calendar-secondary" href={href(today,{create:"actual"})}><BookOpen size={14}/>Log activity</Link><Link className="calendar-secondary" href="/calendar?view=agenda&history=all">View journal</Link></div>
    {error?<p className="welcome-copy" role="status">Your calendar is temporarily unavailable. <Link className="text-link" href="/calendar">Open calendar</Link></p>:<>
      <div className="calendar-preview-grid"><section><div className="section-heading"><h3>Today</h3><Link className="text-link" href={href(today,{view:"day"})}>View day</Link></div>{todayEntries.length?todayEntries.map(entry=>event(entry,true)):<p className="welcome-copy">Nothing planned for today. A little room for you.</p>}</section><section><div className="section-heading"><h3>Upcoming</h3><Link className="text-link" href="/calendar?view=agenda">View all</Link></div>{plans.length?plans.map(entry=>event(entry,false)):<p className="welcome-copy">No plans in the next 90 days.</p>}</section></div>
      {memories.length>0&&<details className="home-recent-memories"><summary>Recent memories</summary><div className="home-memory-grid">{memories.map(entry=><Link key={entry.id} href={href(entry.event_date,{entry:entry.id,view:"agenda"})}><span>{entry.event_date}</span><strong>{entry.title}</strong></Link>)}</div></details>}
    </>}
  </section>;
}
