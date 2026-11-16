import test from "node:test";
import assert from "node:assert/strict";
import { validId, isMediaType, parseViewing } from "../src/lib/media-validation.ts";
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
test("TMDB identifiers reject malformed, unsafe, negative, and noncanonical input", () => {
  for (const id of ["", "0", "-1", "1.5", "1e3", "001", "2147483648", "1/credits", "https://other.example"]) assert.equal(validId(id), null);
  assert.equal(validId("550"), 550);
  assert.equal(validId("2147483647"), 2147483647);
  assert.equal(isMediaType("movie"), true);
  assert.equal(isMediaType("tv"), true);
  assert.equal(isMediaType("person"), false);
});
test("a watchlist item can be unrated and undated", () => {
  assert.deepEqual(parseViewing(form({ status: "watchlist", rating: "", started_on: "", watched_on: "" })).value, { status: "watchlist", rating: null, started_on: null, watched_on: null });
});
test("half-star ratings are distinct from TMDB's ten-point score", () => {
  for (const rating of ["0.5", "1", "3.5", "5"]) assert.equal(parseViewing(form({ status: "completed", rating })).value.rating, Number(rating));
  for (const rating of ["0", "6", "8.2", "3.7", "NaN", "Infinity"]) assert.ok(parseViewing(form({ status: "completed", rating })).error);
});
test("dates must be real, not future, and chronologically consistent", () => {
  for (const watched_on of ["2026-02-30", "2026-13-01", "2026-11-17", "bad", "26-01-01"]) assert.ok(parseViewing(form({ status: "completed", watched_on }), "2026-11-16").error);
  assert.ok(parseViewing(form({ status: "completed", started_on: "2026-11-16", watched_on: "2026-11-15" }), "2026-11-16").error);
  assert.equal(parseViewing(form({ status: "completed", started_on: "2024-02-29", watched_on: "2026-11-16" }), "2026-11-16").value.watched_on, "2026-11-16");
});
test("unknown viewing statuses are rejected", () => { assert.ok(parseViewing(form({ status: "admin" })).error); });
