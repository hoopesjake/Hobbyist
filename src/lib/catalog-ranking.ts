type RatedWork = { id: number; vote_average?: number; vote_count?: number; popularity?: number; release_date?: string; first_air_date?: string };
export function topWorks(a: RatedWork, b: RatedWork) {
  const ratedA = (a.vote_count || 0) > 0 && Number.isFinite(a.vote_average);
  const ratedB = (b.vote_count || 0) > 0 && Number.isFinite(b.vote_average);
  if (ratedA !== ratedB) return ratedA ? -1 : 1;
  return (ratedA ? (b.vote_average || 0) - (a.vote_average || 0) || (b.vote_count || 0) - (a.vote_count || 0) : 0)
    || (b.popularity || 0) - (a.popularity || 0)
    || (b.release_date || b.first_air_date || "").localeCompare(a.release_date || a.first_air_date || "") || a.id - b.id;
}
