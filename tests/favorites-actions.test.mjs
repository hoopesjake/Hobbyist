import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";
import { draftListItems } from "../src/lib/list-validation.ts";
const favoriteCategories = ["movie", "tv", "game", "book"];

function setup(user = "owner") {
  const calls = [];
  const client = { rpc: async (name, args) => { calls.push({ name, args }); return { error: null }; } };
  const stubs = {
    "next/cache": { revalidatePath() {} },
    "@/lib/auth": { requireUser: async () => { if (!user) throw Error("redirect"); return { id: user }; } },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/list-validation": { draftListItems },
    "@/lib/favorites": { favoriteCategories },
  };
  const actionModule = new Module("favorites-actions-test");
  actionModule.require = name => { if (stubs[name]) return stubs[name]; throw Error(`Unexpected dependency: ${name}`); };
  const source = readFileSync(new URL("../src/app/profile/favorites-actions.ts", import.meta.url), "utf8");
  actionModule._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, "favorites-actions-test.cjs");
  return { actions: actionModule.exports, calls };
}

test("favorites are saved through the atomic per-category RPC with normalized identities", async () => {
  const state = setup();
  const result = await state.actions.saveFavorites("movie", [{ media_type: "movie", id: 550 }, { media_type: "movie", id: 27205 }]);
  assert.ok(result.message, result.error);
  assert.equal(state.calls[0].name, "set_profile_favorites");
  assert.equal(state.calls[0].args.p_category, "movie");
  assert.deepEqual(state.calls[0].args.p_items, [{ media_type: "movie", tmdb_id: 550 }, { media_type: "movie", tmdb_id: 27205 }]);
});
test("an invalid category, or an item that doesn't match it, is rejected before touching the database", async () => {
  const state = setup();
  assert.ok((await state.actions.saveFavorites("person", [])).error);
  assert.ok((await state.actions.saveFavorites("movie", [{ media_type: "tv", id: 1 }])).error);
  assert.equal(state.calls.length, 0);
});
test("more than 4 items is rejected client-side before the database's own cap", async () => {
  const state = setup();
  const items = Array.from({ length: 5 }, (_, i) => ({ media_type: "movie", id: i + 1 }));
  assert.ok((await state.actions.saveFavorites("movie", items)).error);
  assert.equal(state.calls.length, 0);
});
