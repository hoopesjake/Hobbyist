export type DiscoveryPerson = { id: number; name: string; adult?: boolean; popularity?: number; profile_path: string | null; known_for_department?: string };
export type PopularCreditTitle = {
  id: number; media_type: "movie" | "tv"; title?: string; name?: string; adult?: boolean; vote_count?: number;
  credits: { cast: DiscoveryPerson[]; crew?: (DiscoveryPerson & { job: string })[] };
};
export function popularPeople(titles: PopularCreditTitle[]) {
  const people = new Map<number, DiscoveryPerson & { media_type: "person"; works: Map<string, string>; director: boolean }>();
  for (const title of titles) {
    if (title.adult || (title.vote_count || 0) < 100) continue;
    const add = (person: DiscoveryPerson, director: boolean) => {
      if (person.adult || !person.name) return;
      const existing = people.get(person.id);
      const entry = existing || { ...person, media_type: "person" as const, works: new Map<string, string>(), director };
      entry.director ||= director;
      entry.works.set(`${title.media_type}-${title.id}`, title.title || title.name || "Untitled");
      people.set(person.id, entry);
    };
    title.credits.cast.slice(0, 5).forEach(person => add(person, false));
    title.credits.crew?.filter(person => person.job === "Director").forEach(person => add(person, true));
  }
  const ranked = [...people.values()].sort((a, b) => (b.popularity || 0) - (a.popularity || 0) || b.works.size - a.works.size || a.id - b.id);
  // Reserve space for directors so the browse feed includes both professions.
  const directors = ranked.filter(person => person.director).slice(0, 5);
  const actors = ranked.filter(person => !person.director).slice(0, 20 - directors.length);
  return [...actors, ...directors].sort((a, b) => (b.popularity || 0) - (a.popularity || 0) || a.id - b.id).map(({ works, director, ...person }) => ({
    ...person, known_for_department: director ? "Directing" : "Acting", known_for_titles: [...works.values()].slice(0, 2),
  }));
}
