import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";
import { listFields, listId, listItem, draftListItems } from "../src/lib/list-validation.ts";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries({ list_id: id, ...values })) data.set(key, value); return data; };
let nextId = 1;
function setup(user = "owner") {
  const lists = [{ id, user_id: "owner", name: "Favorites", description: "", visibility: "public" }];
  const items = [];
  function insertItems(listIdValue, draftItems) { for (const item of draftItems) items.push({ list_id: listIdValue, ...item }); }
  const client = {
    from(table) {
      let filters = [];
      let operation = null;
      const rows = () => table === "media_lists" ? lists : items;
      const matches = row => filters.every(([key, value]) => row[key] === value);
      const builder = {
        select() { return this; },
        eq(key, value) { filters.push([key, value]); return this; },
        async maybeSingle() { return { data: rows().find(matches) || null, error: null }; },
        insert(values) { operation = ["insert", values]; return this; },
        update(values) { operation = ["update", values]; return this; },
        delete() { operation = ["delete"]; return this; },
        async single() { return execute(); },
        then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); },
      };
      function execute() {
        if (operation?.[0] === "insert") {
          if (table === "media_list_items" && items.some(item => item.list_id === operation[1].list_id && item.media_type === operation[1].media_type && (item.igdb_id || item.ol_id || item.tmdb_id) === (operation[1].igdb_id || operation[1].ol_id || operation[1].tmdb_id))) return { error: { code: "23505" } };
          const row = { id, ...operation[1] };
          rows().push(row);
          return { data: row, error: null };
        }
        if (operation?.[0] === "update") for (const row of rows().filter(matches)) Object.assign(row, operation[1]);
        if (operation?.[0] === "delete") for (let i = rows().length - 1; i >= 0; i--) if (matches(rows()[i])) rows().splice(i, 1);
        return { error: null };
      }
      return builder;
    },
    // Mirrors create_media_list_with_items / update_media_list_with_items: atomic, owner-checked.
    async rpc(name, args) {
      if (name === "create_media_list_with_items") {
        const listIdValue = `bbbbbbbb-bbbb-4bbb-8bbb-${String(nextId++).padStart(12, "0")}`;
        lists.push({ id: listIdValue, user_id: user, name: args.p_name, description: args.p_description, visibility: args.p_visibility });
        insertItems(listIdValue, args.p_items);
        return { data: listIdValue, error: null };
      }
      if (name === "update_media_list_with_items") {
        const list = lists.find(entry => entry.id === args.p_list);
        if (!list || list.user_id !== user) return { data: null, error: { code: "42501" } };
        Object.assign(list, { name: args.p_name, description: args.p_description, visibility: args.p_visibility });
        for (let i = items.length - 1; i >= 0; i--) if (items[i].list_id === args.p_list) items.splice(i, 1);
        insertItems(args.p_list, args.p_items);
        return { data: null, error: null };
      }
      return { data: null, error: { code: "unknown_rpc" } };
    },
  };
  const stubs = {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(path) { throw new Error(`redirect:${path}`); } },
    "@/lib/auth": { currentUser: async () => user ? { id: user } : null },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/list-validation": { listFields, listId, listItem, draftListItems },
    "@/lib/igdb": { getGame: async () => ({ id: 1, name: "Game" }), IgdbError: class extends Error {} },
    "@/lib/tmdb": { getTitle: async () => ({ adult: false }), TmdbError: class extends Error {} },
    "@/lib/open-library": { getBook: async () => ({ id: 1, title: "Book" }), BookCatalogError: class extends Error {} },
  };
  const actionModule = new Module("list-actions-test");
  actionModule.require = name => { if (stubs[name]) return stubs[name]; throw new Error(`Unexpected dependency: ${name}`); };
  const source = readFileSync(new URL("../src/app/lists/actions.ts", import.meta.url), "utf8");
  actionModule._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, "list-actions-test.cjs");
  return { actions: actionModule.exports, lists, items };
}
const draft = (name, description, visibility, items) => ({ name, description, visibility, items });
test("owners create a list and every drafted item atomically", async () => {
  const state = setup();
  await assert.rejects(state.actions.createListWithItems(draft("  Sunday TV  ", "", "private", [{ media_type: "tv", id: 1396 }, { media_type: "book", id: 42 }])), /redirect:\/lists\//);
  const created = state.lists.at(-1);
  assert.equal(created.name, "Sunday TV");
  assert.equal(created.visibility, "private");
  assert.equal(state.items.filter(item => item.list_id === created.id).length, 2);
  assert.ok(state.items.some(item => item.list_id === created.id && item.media_type === "book" && item.ol_id === 42));
});
test("editing replaces fields and the full item set together", async () => {
  const state = setup();
  await assert.rejects(state.actions.createListWithItems(draft("Draft", "", "private", [{ media_type: "movie", id: 550 }])), /redirect:\/lists\//);
  const created = state.lists.at(-1);
  await assert.rejects(state.actions.updateListWithItems(created.id, draft("Renamed", "Updated", "public", [{ media_type: "game", id: 1942 }])), new RegExp(`redirect:/lists/${created.id}`));
  assert.equal(created.name, "Renamed");
  assert.equal(created.visibility, "public");
  const remaining = state.items.filter(item => item.list_id === created.id);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].igdb_id, 1942);
});
test("movie and show with the same TMDB id coexist and duplicate adds are harmless", async () => {
  const state = setup();
  for (const media_type of ["movie", "tv", "movie"]) assert.ok((await state.actions.addListItem({}, form({ media_type, tmdb_id: "550" }))).message);
  assert.equal(state.items.length, 2);
  await state.actions.removeListItem({}, form({ media_type: "movie", tmdb_id: "550" }));
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].media_type, "tv");
});
test("public visibility does not let visitors edit, add, remove, or delete", async () => {
  const state = setup("visitor");
  for (const name of ["addListItem", "removeListItem", "deleteList"]) {
    const result = await state.actions[name]({}, form({ name: "Hijacked", media_type: "movie", tmdb_id: "550" }));
    assert.ok(result.error, name);
  }
  assert.ok((await state.actions.updateListWithItems(id, draft("Hijacked", "", "public", []))).error);
  assert.equal(state.lists[0].name, "Favorites");
  assert.equal(state.items.length, 0);
});
test("signed-out writes and malformed inputs cannot mutate lists", async () => {
  const state = setup(null);
  assert.ok((await state.actions.createListWithItems(draft("Test", "", "private", []))).error);
  assert.ok((await state.actions.addListItem({}, form({ media_type: "movie", tmdb_id: "550" }))).error);
  const owner = setup();
  assert.ok((await owner.actions.createListWithItems(draft("", "", "private", []))).error);
  assert.ok((await owner.actions.addListItem({}, form({ media_type: "person", tmdb_id: "1" }))).error);
  assert.equal(owner.lists[0].name, "Favorites");
});
test("owners can delete their list", async () => {
  const state = setup();
  await assert.rejects(state.actions.deleteList({}, form({})), /redirect:\/lists/);
  assert.equal(state.lists.length, 0);
});
test("game additions extend the same list without colliding with movie/TV identities", async () => { const state = setup(); for (const media_type of ["movie", "tv", "game"]) assert.ok((await state.actions.addListItem({}, form({media_type,tmdb_id:"550",igdb_id:"550"}))).message); assert.equal(state.items.length,3); assert.equal(state.items[2].igdb_id,550); assert.equal(state.items[2].tmdb_id,undefined); });
test("book additions use an explicit Open Library identity", async () => { const state = setup(); assert.ok((await state.actions.addListItem({}, form({ media_type: "book", ol_id: "42" }))).message); assert.equal(state.items[0].ol_id, 42); assert.equal(state.items[0].tmdb_id, undefined); });
