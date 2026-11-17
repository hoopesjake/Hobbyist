import test from "node:test";
import assert from "node:assert/strict";
import { tvStatistics } from "../src/lib/tv-statistics.ts";
const show = (id, status = "watching", rating = null) => ({ tmdb_id: id, status, rating });
const episode = (id, season, number, date = null, extra = {}) => ({ tmdb_show_id: id, season_number: season, episode_number: number, watched: true, watched_on: date, rating: null, ...extra });
const title = (id, cast = [{ id: 10, name: "Shared Actor" }]) => ({ id, name: `Show ${id}`, genres: [{ id: 1, name: "Drama" }], credits: { cast } });
const season = (id, number, runtimes) => ({ showId: id, season_number: number, episodes: runtimes.map((runtime, index) => ({ episode_number: index + 1, runtime })) });

test("season completion requires every catalog episode; specials and unwatched episodes stay separate", () => {
  const stats = tvStatistics([show(1, "completed")], [episode(1, 1, 1), episode(1, 1, 2), episode(1, 2, 1), episode(1, 2, 2, null, { watched: false }), episode(1, 0, 1)], [], [season(1, 1, [20, 30]), season(1, 2, [40, 50]), season(1, 0, [15])], "2026-11-16");
  assert.equal(stats.episodes, 4);
  assert.equal(stats.seasonsStarted, 2);
  assert.equal(stats.seasonsCompleted, 1);
  assert.equal(stats.specials, 1);
  assert.equal(stats.minutes, 105);
  assert.equal(stats.perShow, 4);
});
test("binge days use watch dates, Monday week boundaries, and known runtimes only", () => {
  const stats = tvStatistics([show(1), show(2)], [episode(1, 1, 1, "2026-11-15"), episode(1, 1, 2, "2026-11-16"), episode(1, 1, 3, "2026-11-16"), episode(2, 1, 1), episode(2, 1, 2, "2026-11-17")], [], [season(1, 1, [20, 30, null])], "2026-11-16");
  assert.equal(stats.thisWeek, 2);
  assert.equal(stats.perDay, 1.5);
  assert.equal(stats.perShow, 2.5);
  assert.deepEqual(stats.topDay, { date: "2026-11-16", count: 2, minutes: 30, known: 1 });
  assert.equal(stats.runtimeCount, 2);
  assert.equal(stats.averageRuntime, 25);
  assert.equal(stats.undated, 1);
  assert.equal(stats.months.at(-1).count, 3);
});
test("shared actors count distinct viewed shows, excluding planned-only shows and duplicate cast", () => {
  const stats = tvStatistics([show(1), show(2, "watched"), show(3, "planned")], [], [title(1, [{ id: 10, name: "Shared Actor" }, { id: 10, name: "Shared Actor" }]), title(2), title(3)], [], "2026-11-16");
  assert.equal(stats.sharedActors.length, 1);
  assert.deepEqual(stats.sharedActors[0].shows.map(item => item.id), [1, 2]);
  assert.equal(stats.genres[0].count, 2);
});
test("show and episode ratings never blend or imply watched episodes", () => {
  const stats = tvStatistics([show(1, "completed", 5), show(2, "watched", 3)], [episode(1, 1, 1, null, { rating: 2 }), episode(1, 1, 2, null, { rating: 5, watched: false })], [], [], "2026-11-16");
  assert.equal(stats.showAverage, 4);
  assert.equal(stats.episodeAverage, 3.5);
  assert.equal(stats.episodes, 1);
  assert.equal(stats.seasonsCompleted, 0);
  assert.equal(stats.ratings.at(-1).shows, 1);
  assert.equal(stats.ratings.at(-1).episodes, 1);
});
test("empty and unavailable catalog data do not invent runtime, seasons, or favorites", () => {
  const empty = tvStatistics([], [], [], [], "2026-01-01");
  assert.equal(empty.perDay, null);
  assert.equal(empty.perShow, null);
  assert.equal(empty.showAverage, null);
  assert.equal(empty.topDay, null);
  assert.equal(empty.months[0].key, "2025-08");
  const partial = tvStatistics([show(1)], [episode(1, 1, 1)], [], [], "2026-11-16");
  assert.equal(partial.missingTitles, 1);
  assert.equal(partial.missingSeasons, 1);
  assert.equal(partial.minutes, 0);
  assert.equal(partial.runtimeCount, 0);
  assert.deepEqual(partial.sharedActors, []);
});
