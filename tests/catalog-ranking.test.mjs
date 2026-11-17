import test from "node:test";
import assert from "node:assert/strict";
import { topWorks } from "../src/lib/catalog-ranking.ts";
test("portfolios sort by TMDB score and move unrated work below every rated work", () => {
  const works = [
    { id: 1, vote_count: 0, vote_average: 10, popularity: 500 },
    { id: 2, vote_count: 100, vote_average: 7 },
    { id: 3, vote_count: 500, vote_average: 8.5 },
    { id: 4, vote_count: 1, vote_average: 1 },
    { id: 5, popularity: 1000 },
    { id: 6, vote_count: 500, vote_average: 7 },
  ].sort(topWorks);
  assert.deepEqual(works.map(work => work.id), [3, 6, 2, 4, 5, 1]);
});
test("rating ties have deterministic fallbacks without mutating the work", () => {
  const a = { id: 1, vote_count: 10, vote_average: 8 };
  const b = { ...a, id: 2 };
  assert.ok(topWorks(a, b) < 0);
  assert.deepEqual(a, { id: 1, vote_count: 10, vote_average: 8 });
});
