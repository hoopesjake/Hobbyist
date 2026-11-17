import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { MediaStatistics } from "@/components/media/statistics";
import { PersonalLibrary } from "@/components/media/personal-library";
import { Discovery } from "@/components/media/discovery";
export const metadata={title:"Movies"};
export default async function Dashboard(){const user=await currentUser();return <><MediaStatistics kind="movie"/>{user&&<section className="dashboard-section"><div className="section-heading"><h2>Recently watched movies</h2><Link className="text-link" href="/movies/library?filter=watched">View all</Link></div><PersonalLibrary kind="movie" filter="watched" limit={5} preview/></section>}<section className="dashboard-section"><Discovery kind="movie" preview/></section></>;}
