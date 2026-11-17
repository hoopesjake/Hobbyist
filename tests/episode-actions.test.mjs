import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";
import { parseTracking, episodeIndex } from "../src/lib/tracking-validation.ts";
import { validId } from "../src/lib/media-validation.ts";

function setup(status = "planned", failEpisode = false) {
  const parent = { user_id: "owner", tmdb_id: 1, status, rating: 4, review: "Keep this", started_on: "2026-01-01", completed_on: status === "completed" ? "2026-01-02" : null };
  const saved = [];
  let refreshes = 0;
  const client = { from(table) {
    return {
      async upsert(data) {
        if (table === "tv_episode_tracking") {
          if (failEpisode) return { error: { code: "test_failure" } };
          saved.push(...(Array.isArray(data) ? data : [data]));
        }
        return { error: null };
      },
      select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { watched_on: "2026-01-01" }, error: null }; },
      update(values) {
        const filters = [];
        return {
          eq(key, value) { filters.push(row => row[key] === value); return this; },
          neq(key, value) { filters.push(row => row[key] !== value); return this; },
          then(resolve, reject) { return Promise.resolve().then(() => { if (filters.every(matches => matches(parent))) Object.assign(parent, values); return { error: null }; }).then(resolve, reject); },
        };
      },
    };
  } };
  const stubs = {
    "next/cache": { revalidatePath() { refreshes++; } },
    "@/lib/auth": { currentUser: async () => ({ id: "owner" }) },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/media-validation": { validId },
    "@/lib/tracking-validation": { parseTracking, episodeIndex },
    "@/lib/tmdb": {
      TmdbError: class extends Error {},
      getEpisode: async (_id, season, number) => ({ id: 100 + number, season_number: season, episode_number: number }),
      getSeason: async (_id, season) => ({ episodes: [1, 2].map(number => ({ id: 100 + number, season_number: season, episode_number: number })) }),
    },
  };
  const source = readFileSync(new URL("../src/app/tracking-actions.ts", import.meta.url), "utf8");
  const actionModule = new Module("episode-actions-test");
  actionModule.require = name => { if (stubs[name]) return stubs[name]; throw new Error(`Unexpected dependency: ${name}`); };
  actionModule._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, "episode-actions-test.cjs");
  return { actions: actionModule.exports, parent, saved, refreshes: () => refreshes };
}
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries({ tmdb_show_id: "1", season_number: "1", episode_number: "1", ...values })) data.set(key, value); return data; };

test("quick watched action starts/resumes unfinished shows and preserves personal fields", async () => {
  for (const status of ["planned", "paused", "dropped", "watched", "watching"]) {
    const state = setup(status);
    const before = { ...state.parent };
    const result = await state.actions.toggleEpisode({}, form({ watched: "true" }));
    assert.ok(result.message);
    assert.deepEqual(state.parent, { ...before, status: "watching" });
    assert.equal(state.saved[0].watched_on, "2026-01-01");
    assert.equal(state.refreshes(), 1);
  }
});
test("completed shows stay completed and marking unwatched does not change show status", async () => {
  const completed = setup("completed");
  await completed.actions.toggleEpisode({}, form({ watched: "true" }));
  assert.equal(completed.parent.status, "completed");
  const paused = setup("paused");
  await paused.actions.toggleEpisode({}, form({ watched: "false" }));
  assert.equal(paused.parent.status, "paused");
});
test("episode rating saves also start watching; blank unwatched saves do not", async () => {
  const state = setup();
  await state.actions.saveEpisode({}, form({ rating: "4.5" }));
  assert.equal(state.parent.status, "watching");
  const blank = setup();
  await blank.actions.saveEpisode({}, form({}));
  assert.equal(blank.parent.status, "planned");
});
test("watch season starts watching without completing the show or changing its review", async () => {
  const state = setup();
  await state.actions.watchSeason({}, form({}));
  assert.equal(state.parent.status, "watching");
  assert.equal(state.saved.length, 2);
  assert.equal(state.parent.review, "Keep this");
  assert.equal(state.parent.completed_on, null);
});
test("failed episode writes do not change show status", async () => {
  const state = setup("planned", true);
  const result = await state.actions.toggleEpisode({}, form({ watched: "true" }));
  assert.ok(result.error);
  assert.equal(state.parent.status, "planned");
});
