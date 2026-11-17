import test from "node:test";
import assert from "node:assert/strict";
import { movieStatistics } from "../src/lib/movie-statistics.ts";
const entry = (id, date, extra = {}) => ({ tmdb_id: id, watched: true, watched_on: date, rating: 5, review: "", on_watchlist: false, ...extra });
const film = id => ({ id, runtime: 120, release_date: "1999-01-01", genres: [{ id: 1, name: "Drama" }], credits: { cast: [{ id: 10, name: "Actor" }] } });
test("weekly counts use Monday boundaries and actual watch dates, excluding future and undated movies", () => {
  const stats = movieStatistics([entry(1, "2026-11-15"), entry(2, "2026-11-16"), entry(3, null), entry(4, "2026-11-17"), entry(5, "2026-11-16", { watched: false })], [], "2026-11-16");
  assert.equal(stats.thisWeek, 1);
  assert.equal(stats.thisYear, 2);
  assert.equal(stats.watched, 4);
  assert.equal(stats.undated, 1);
});
test("favorites aggregate watched films and remain usable when catalog details fail", () => {
  const stats = movieStatistics([entry(1, null), entry(2, null, { rating: 3 }), entry(3, null), entry(4, null, { watched: false })], [film(1), film(2), film(4)], "2026-11-16");
  assert.equal(stats.genres[0].count, 2);
  assert.equal(stats.actors[0].count, 2);
  assert.equal(stats.minutes, 240);
  assert.equal(stats.missingCatalog, 1);
  assert.equal(stats.fiveStars, 2);
  assert.deepEqual(stats.decades[0], ["1990s", 2]);
  assert.equal(stats.ratings.reduce((sum, row) => sum + row.count, 0), 3);
});
test("empty libraries have no invented favorites or ratings", () => {
  const stats = movieStatistics([], [], "2026-01-01");
  assert.equal(stats.average, null);
  assert.deepEqual(stats.genres, []);
  assert.deepEqual(stats.months.map(month => month.key), ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"]);
});
