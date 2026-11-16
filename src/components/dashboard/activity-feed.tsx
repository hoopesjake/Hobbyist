import { BookOpen, Check, Clapperboard, Gamepad2, Star } from "lucide-react";
import { recentActivity } from "@/data/dashboard";

const activityIcons = { game: Gamepad2, movie: Clapperboard, project: Check };

export function ActivityFeed() {
  return <div className="activity-list">{recentActivity.map((item) => { const Icon = activityIcons[item.kind]; return <article className="activity-row" key={`${item.kind}-${item.title}`}><span className="activity-icon"><Icon size={16} strokeWidth={1.8} aria-hidden="true" /></span><div className="activity-copy">{item.description} <strong>{item.title}</strong><span>{item.time}</span></div>{item.rating ? <span className="activity-rating"><Star size={12} fill="currentColor" aria-hidden="true" /> {item.rating}</span> : <BookOpen size={14} color="#858983" aria-hidden="true" />}</article>; })}</div>;
}