import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { friendsActivity } from "@/data/dashboard";

export function FriendsActivity() {
  return <div className="friend-list">{friendsActivity.map((friend) => <article className="friend-row" key={friend.name}><span className={`friend-avatar ${friend.style}`} aria-hidden="true">{friend.initials}</span><div className="friend-copy"><strong>{friend.name}</strong> {friend.action}<span>{friend.time}</span><div className="friend-activity">{friend.title}</div></div></article>)}<Link className="section-link" href="/community" style={{ justifySelf: "start", marginTop: 6 }}>Find your people <ArrowUpRight size={14} /></Link></div>;
}