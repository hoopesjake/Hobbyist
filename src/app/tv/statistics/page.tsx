import { requireUser } from "@/lib/auth";
import { MediaStatistics } from "@/components/media/statistics";
export default async function Page(){await requireUser();return <><h2>Your TV statistics</h2><MediaStatistics kind="tv"/></>;}
