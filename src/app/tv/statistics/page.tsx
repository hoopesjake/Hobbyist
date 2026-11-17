import { requireUser } from "@/lib/auth";
import { TVStatistics } from "@/components/media/tv-statistics";
export default async function Page(){await requireUser();return <><h2>Your TV statistics</h2><TVStatistics/></>;}
