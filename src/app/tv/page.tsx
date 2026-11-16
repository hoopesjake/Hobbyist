import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { MediaStatistics } from "@/components/media/statistics";
import { PersonalLibrary } from "@/components/media/personal-library";
import { Discovery } from "@/components/media/discovery";
export const metadata={title:"TV Shows"};
export default async function Dashboard(){const user=await currentUser();return <><MediaStatistics kind="tv"/>{user&&<section className="dashboard-section"><div className="section-heading"><h2>Currently watching TV shows</h2><Link className="text-link" href="/tv/library?filter=watching">View all</Link></div><PersonalLibrary kind="tv" filter="watching" limit={6} preview/></section>}<section className="dashboard-section"><Discovery kind="tv" preview/></section></>;}
