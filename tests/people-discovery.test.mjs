import test from "node:test";
import assert from "node:assert/strict";
import { popularPeople } from "../src/lib/people-discovery.ts";
const person = (id, extra = {}) => ({ id, name: `Person ${id}`, profile_path: null, popularity: 100 - id, ...extra });
const title = (id, cast, crew = [], extra = {}) => ({ id, media_type: "movie", title: `Film ${id}`, adult: false, vote_count: 1000, credits: { cast, crew }, ...extra });
test("discovery excludes adult people, adult titles, and low-vote titles", () => {
  const results = popularPeople([
    title(1, [person(1), person(2, { adult: true })]),
    title(2, [person(3)], [], { adult: true }),
    title(3, [person(4)], [], { vote_count: 99 }),
  ]);
  assert.deepEqual(results.map(item => item.id), [1]);
});
test("people are deduplicated across movie and TV credits with recognizable works", () => {
  const results = popularPeople([title(1, [person(1)]), title(2, [person(1)], [], { media_type: "tv", title: undefined, name: "Series" })]);
  assert.equal(results.length, 1);
  assert.deepEqual(results[0].known_for_titles, ["Film 1", "Series"]);
  assert.equal(results[0].known_for_department, "Acting");
});
test("directors have reserved space and unrelated crew are excluded", () => {
  const titles = Array.from({ length: 5 }, (_, index) => title(index, Array.from({ length: 5 }, (_, cast) => person(index * 5 + cast)), [{ ...person(100 + index), job: "Director" }, { ...person(200), job: "Producer" }]));
  const results = popularPeople(titles);
  assert.equal(results.length, 20);
  assert.equal(results.filter(item => item.known_for_department === "Directing").length, 5);
  assert.ok(!results.some(item => item.id === 200));
});
test("ranking uses popularity with deterministic ties and no country or language restriction", () => {
  const results = popularPeople([title(1, [person(2, { name: "Korean Actor", popularity: 500 }), person(1, { popularity: 100 }), person(3, { popularity: 100 })])]);
  assert.deepEqual(results.map(item => item.id), [2, 1, 3]);
});
