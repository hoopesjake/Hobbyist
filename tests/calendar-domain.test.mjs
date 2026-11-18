import test from "node:test";
import assert from "node:assert/strict";
import { parseCalendarEntry, possibleInstants, calendarRange, addCalendarDays, shiftCalendarMonth, dateInZone, actualMinutes, entryOnDate, mediaHref } from "../src/lib/calendar-domain.ts";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const now = new Date("2026-11-17T18:00:00Z");
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries({ id, kind: "actual", title: "A little gaming", category: "games", event_date: "2026-11-16", time_zone: "America/Denver", ...values })) data.set(key, value); return data; };
test("date-only memories retain unknown timing and are private by default", () => {
  const result = parseCalendarEntry(form({ notes: "A win with friends.", participants: "Alex & Sam" }), now);
  assert.equal(result.entry.starts_at, null); assert.equal(result.entry.start_time, null);
  assert.equal(result.entry.ends_at, null); assert.equal(result.entry.duration_minutes, null);
  assert.equal(result.entry.privacy, "private"); assert.equal(result.entry.notes, "A win with friends.");
});
test("approximate duration without a start is preserved without fabricated timestamps", () => {
  const result = parseCalendarEntry(form({ duration_minutes: "65", approximate: "on" }), now);
  assert.equal(result.entry.duration_minutes, 65); assert.equal(result.entry.approximate, true); assert.equal(result.entry.starts_at, null);
});
test("plans can be future-dated; actual logs cannot, including later today", () => {
  assert.ok(parseCalendarEntry(form({ event_date: "2026-12-01", kind: "plan" }), now).entry);
  assert.ok(parseCalendarEntry(form({ event_date: "2026-12-01" }), now).error);
  assert.ok(parseCalendarEntry(form({ event_date: "2026-11-17", start_time: "23:00" }), now).error);
  assert.ok(parseCalendarEntry(form({ event_date: "2026-11-17" }), now).entry);
});
test("normal timed and overnight logs calculate elapsed minutes", () => {
  const result = parseCalendarEntry(form({ start_time: "23:00", end_date: "2026-11-17", end_time: "01:00", duration_minutes: "999" }), now);
  assert.equal(result.entry.duration_minutes, 120); assert.equal(result.entry.starts_at, "2026-11-17T06:00:00.000Z");
  assert.ok(parseCalendarEntry(form({ start_time: "23:00", end_time: "01:00" }), now).error);
  assert.ok(parseCalendarEntry(form({ end_time: "01:00" }), now).error);
});
test("DST spring gaps are rejected, and elapsed duration crosses the spring jump", () => {
  assert.deepEqual(possibleInstants("2026-03-08", "02:30", "America/Denver"), []);
  assert.ok(parseCalendarEntry(form({ event_date: "2026-03-08", start_time: "02:30" }), now).error);
  const result = parseCalendarEntry(form({ event_date: "2026-03-08", start_time: "01:30", end_time: "03:30" }), now);
  assert.equal(result.entry.duration_minutes, 60);
});
test("DST fall folds require an explicit occurrence and preserve distinct instants", () => {
  const values = { event_date: "2026-11-01", start_time: "01:30" };
  assert.equal(possibleInstants(values.event_date, values.start_time, "America/Denver").length, 2);
  assert.ok(parseCalendarEntry(form(values), now).error);
  const early = parseCalendarEntry(form({ ...values, start_occurrence: "earlier" }), now).entry;
  const late = parseCalendarEntry(form({ ...values, start_occurrence: "later" }), now).entry;
  assert.equal(Date.parse(late.starts_at) - Date.parse(early.starts_at), 3600000);
});
test("half-hour DST folds and quarter-hour time zones resolve correctly", () => {
  const values = possibleInstants("2026-04-05", "01:45", "Australia/Lord_Howe");
  assert.equal(values.length, 2); assert.equal(values[1] - values[0], 1800000);
  assert.equal(new Date(possibleInstants("2026-11-16", "12:00", "Asia/Kathmandu")[0]).toISOString(), "2026-11-16T06:15:00.000Z");
});
test("calendar dates and ranges cross leap days, year boundaries and month ends", () => {
  assert.equal(addCalendarDays("2024-02-28", 1), "2024-02-29");
  assert.equal(shiftCalendarMonth("2026-01-31", 1), "2026-02-28");
  assert.equal(shiftCalendarMonth("2026-01-31", -1), "2025-12-31");
  assert.deepEqual(calendarRange("month", "2026-11-17"), { start: "2026-11-01", end: "2026-12-13" });
  assert.deepEqual(calendarRange("week", "2026-11-17"), { start: "2026-11-15", end: "2026-11-22" });
  assert.deepEqual(calendarRange("day", "2026-11-17"), { start: "2026-11-17", end: "2026-11-18" });
  assert.deepEqual(calendarRange("agenda", "2026-11-17"), { start: "2026-11-01", end: "2026-12-01" });
  assert.equal(dateInZone(new Date("2026-11-17T02:00Z"), "America/Denver"), "2026-11-16");
});
test("only actual activity contributes duration, even for completed plans", () => {
  assert.equal(actualMinutes([{ kind: "plan", status: "completed", duration_minutes: 120 }, { kind: "actual", duration_minutes: 60 }, { kind: "actual", duration_minutes: null }]), 60);
});
test("multi-day records appear on each occupied date, excluding midnight end boundaries", () => {
  const entry = { event_date: "2026-11-16", end_date: "2026-11-17", end_time: "00:00" };
  assert.equal(entryOnDate(entry, "2026-11-16"), true); assert.equal(entryOnDate(entry, "2026-11-17"), false);
  assert.equal(entryOnDate({ ...entry, end_time: "01:00" }, "2026-11-17"), true);
});
test("provider types stay distinct and TV supports specials and specific episodes", () => {
  for (const [category, media, provider] of [["movies", "movie:550", "tmdb"], ["tv", "tv:550", "tmdb"], ["games", "game:550", "igdb"], ["books", "book:550", "openlibrary"]]) {
    const result = parseCalendarEntry(form({ category, media }), now);
    assert.equal(result.entry.provider_id, 550); assert.equal(result.entry.provider, provider);
  }
  const tv = parseCalendarEntry(form({ category: "tv", media: "tv:550", season_number: "0", episode_number: "1" }), now).entry;
  assert.equal(mediaHref(tv), "/tv/550/season/0/episode/1");
  assert.ok(parseCalendarEntry(form({ category: "tv", media: "tv:550", episode_number: "1" }), now).error);
  assert.ok(parseCalendarEntry(form({ media: "movie:550" }), now).error);
});
test("invalid identities, dates, durations, privacy, media and zones cannot be saved", () => {
  for (const values of [{ id: "forged" }, { kind: "review" }, { title: " " }, { title: "x".repeat(201) }, { notes: "x".repeat(10001) }, { category: "hack" }, { event_date: "2026-02-30" }, { event_date: "1899-12-01" }, { start_time: "24:00" }, { duration_minutes: "0" }, { duration_minutes: "0.5" }, { duration_minutes: "Infinity" }, { duration_minutes: "10081" }, { privacy: "public" }, { media: "game:01" }, { media: "game:2147483648" }, { time_zone: "Unknown/Zone" }, { time_zone: "+01:00" }, { plan_id: id }, { kind: "plan", plan_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }]) {
    assert.ok(parseCalendarEntry(form(values), now).error, JSON.stringify(values));
  }
});
