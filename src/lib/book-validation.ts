export const readingStatuses = { want_to_read: "Want to Read", reading: "Currently Reading", finished: "Finished" } as const;
export type ReadingStatus = keyof typeof readingStatuses;
export function parseBookTracking(form: FormData) {
  const text = (name: string) => String(form.get(name) || "").trim();
  let status = text("status") as ReadingStatus;
  const started_on = text("started_on") || null, finished_on = text("finished_on") || null;
  for (const date of [started_on, finished_on]) {
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) !== date)) return { error: "Choose valid reading dates." } as const;
  }
  if (started_on && finished_on && finished_on < started_on) return { error: "The finish date cannot be before the start date." } as const;
  if (finished_on) status = "finished";
  else if (started_on && status !== "finished") status = "reading";
  const total = text("total_pages"), current = text("current_page"), rawRating = text("rating");
  const total_pages = total ? Number(total) : null, manual_current_page = current ? Number(current) : 0, rating = rawRating ? Number(rawRating) : null;
  if (!(status in readingStatuses)) return { error: "Choose a reading status." } as const;
  if ((total_pages !== null && (!Number.isInteger(total_pages) || total_pages < 1 || total_pages > 100000)) || !Number.isInteger(manual_current_page) || manual_current_page < 0 || manual_current_page > 100000 || (total_pages !== null && manual_current_page > total_pages)) return { error: "Choose valid page counts; progress cannot exceed the book length." } as const;
  if (rating !== null && (!Number.isFinite(rating) || rating < 0.5 || rating > 5 || !Number.isInteger(rating * 2))) return { error: "Choose a half-star rating from 0.5 to 5." } as const;
  const review = text("review"), private_notes = text("private_notes"), edition_id = text("edition_id") || null;
  if ([...review].length > 10000 || [...private_notes].length > 10000) return { error: "Reviews and notes can contain up to 10,000 characters." } as const;
  if (edition_id && !/^OL[1-9]\d*M$/.test(edition_id)) return { error: "Choose a valid edition." } as const;
  return { fields: { status, total_pages, manual_current_page, rating, review, private_notes, edition_id, started_on, finished_on, contains_spoilers: text("contains_spoilers") === "on" } } as const;
}

export function parseReadingPages(form: FormData, actual: boolean, book: boolean) {
  const start = String(form.get("reading_start_page") || "").trim(), end = String(form.get("reading_end_page") || "").trim();
  if (!start && !end) return { reading_start_page: null, reading_end_page: null } as const;
  if (!actual || !book || !/^[1-9]\d{0,5}$/.test(start) || !/^[1-9]\d{0,5}$/.test(end) || Number(start) > Number(end) || Number(end) > 100000) return { error: "Choose a valid starting and ending page for this reading session." } as const;
  return { reading_start_page: Number(start), reading_end_page: Number(end) } as const;
}
