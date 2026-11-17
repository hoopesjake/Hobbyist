import { requireUser } from "@/lib/auth";
import { MovieStatistics } from "@/components/media/movie-statistics";
export default async function Page(){await requireUser();return <><h2>Your movie statistics</h2><MovieStatistics/></>;}
