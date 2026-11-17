import { connection } from "next/server";
import { getCalendarPreview } from "@/lib/calendar";
import { currentUser } from "@/lib/auth";
import { dateInZone } from "@/lib/calendar-domain";
import { CalendarPreviewView } from "./calendar-preview-view";
export async function CalendarPreview() {
 await connection();if (!await currentUser()) return null;
 const today=dateInZone(new Date(),"America/Denver");
 return <CalendarPreviewView today={today} {...await getCalendarPreview(today)}/>;
}
