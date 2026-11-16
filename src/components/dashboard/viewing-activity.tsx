import { PersonalLibrary } from "@/components/media/personal-library";
export function ViewingActivity(){return <><h3>Recently watched movies</h3><PersonalLibrary kind="movie" filter="watched" limit={6} preview/><h3>Currently watching TV shows</h3><PersonalLibrary kind="tv" filter="watching" limit={6} preview/></>;}
