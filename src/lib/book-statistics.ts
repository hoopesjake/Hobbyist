type Book = { ol_work_id: number; title: string; authors: string[]; edition_id: string | null; effective_status: string; current_page: number; total_pages: number | null; manual_current_page: number; effective_finished_on: string | null; rating: number | null };
export type ReadingSession = { id: string; kind: string; event_date: string; provider_id: number | null; reading_edition_id: string | null; reading_start_page: number | null; reading_end_page: number | null; duration_minutes: number | null };

function uniquePages(ranges: [number, number][]) {
  let total = 0, end = 0;
  for (const [start, finish] of [...ranges].sort((a,b) => a[0]-b[0])) {
    total += Math.max(0, finish-Math.max(end,start-1)); end = Math.max(end,finish);
  }
  return total;
}

export function bookStatistics(books: Book[], sessions: ReadingSession[], today: string) {
  const actual = [...new Map(sessions.filter(s => s.kind === "actual" && s.event_date <= today).map(s => [s.id,s])).values()];
  const finished = books.filter(b => b.effective_status === "finished");
  const dated = finished.filter(b => b.effective_finished_on && b.effective_finished_on <= today);
  const ranges = new Map<string,[number,number][]>(), logged = new Map<string,[number,number][]>();
  function add(map: typeof ranges, key: string, start: number, end: number) {
    if (start >= 1 && end >= start) map.set(key,[...(map.get(key)||[]),[start,end]]);
  }
  for (const s of actual) if (s.provider_id && s.reading_start_page && s.reading_end_page) {
    const key = `${s.provider_id}:${s.reading_edition_id || "unknown"}`;
    add(ranges,key,s.reading_start_page,s.reading_end_page);add(logged,key,s.reading_start_page,s.reading_end_page);
  }
  for (const b of books) add(ranges,`${b.ol_work_id}:${b.edition_id || "unknown"}`,1,b.effective_status === "finished" && b.total_pages ? b.total_pages : b.manual_current_page);
  const sumPages = (map: typeof ranges) => [...map.values()].reduce((sum,ranges) => sum+uniquePages(ranges),0);
  const rated = books.filter(b => b.rating !== null), year = today.slice(0,4), month = today.slice(0,7);
  const now = new Date(`${today}T12:00:00Z`);
  const months = Array.from({length:12},(_,index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-11+index,1)), key = date.toISOString().slice(0,7);
    return {key,label:date.toLocaleDateString("en-US",{month:"short",timeZone:"UTC"}),count:dated.filter(b => b.effective_finished_on!.startsWith(key)).length};
  });
  const years = new Map<string,number>();
  for (const b of dated) { const key=b.effective_finished_on!.slice(0,4);years.set(key,(years.get(key)||0)+1); }
  const authors = new Map<string,number>();
  for (const b of finished) for (const author of new Set(b.authors)) authors.set(author,(authors.get(author)||0)+1);
  return {total:books.length,reading:books.filter(b=>b.effective_status==="reading").length,want:books.filter(b=>b.effective_status==="want_to_read").length,
    finished:finished.length,finishedYear:dated.filter(b=>b.effective_finished_on!.startsWith(year)).length,finishedMonth:dated.filter(b=>b.effective_finished_on!.startsWith(month)).length,
    minutes:actual.reduce((sum,s)=>sum+(s.duration_minutes||0),0),sessions:actual.length,timedSessions:actual.filter(s=>s.duration_minutes!==null).length,pages:sumPages(ranges),loggedPages:sumPages(logged),
    average:rated.length?rated.reduce((sum,b)=>sum+b.rating!,0)/rated.length:null,
    undated:finished.filter(b=>!b.effective_finished_on).length,months,years:[...years].sort((a,b)=>b[0].localeCompare(a[0])),
    authors:[...authors].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)),
    ratings:Array.from({length:10},(_,index)=>({rating:(index+1)/2,count:rated.filter(b=>b.rating===(index+1)/2).length}))};
}

const genres: [string,RegExp][] = [
  ["Fantasy",/\bfantasy\b|\bmagic\b/], ["Science fiction",/science fiction|sci fi|space opera/],
  ["Mystery",/\bmystery\b|detective/], ["Thriller",/\bthriller\b|\bsuspense\b/], ["Romance",/\bromance\b|love stories/],
  ["Horror",/\bhorror\b|ghost stories/], ["Historical fiction",/historical fiction/], ["Biography & memoir",/biograph|autobiograph|\bmemoir/],
  ["History",/^history$|^history /], ["Poetry",/\bpoetry\b/], ["Comics & graphic novels",/comic|graphic novel|\bmanga\b/],
  ["Science",/^science$|^popular science$/], ["Self-help",/self help|personal development/],
];
export function bookGenreRanking(subjects: { id: number; subjects: string[] }[]) {
  const counts = new Map<string,number>();
  for (const book of new Map(subjects.map(book=>[book.id,book])).values()) {
    const labels = new Set<string>();
    for (const subject of book.subjects) for (const [genre,pattern] of genres) if(pattern.test(subject.toLowerCase().replace(/[_-]/g," "))) labels.add(genre);
    for (const label of labels) counts.set(label,(counts.get(label)||0)+1);
  }
  return [...counts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
}
