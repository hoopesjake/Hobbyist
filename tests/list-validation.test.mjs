import test from "node:test";
import assert from "node:assert/strict";
import { listId, listFields, listItem } from "../src/lib/list-validation.ts";
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
test("list names are trimmed and bounded, with private visibility by default", () => {
  assert.deepEqual(listFields(form({ name: "  Weekend picks  " })), { name: "Weekend picks", visibility: "private", description: "" });
  assert.deepEqual(listFields(form({ name: "Shared picks", is_public: "on" })), { name: "Shared picks", visibility: "public", description: "" });
  assert.ok(listFields(form({ name: "  " })).error);
  assert.ok(listFields(form({ name: "a".repeat(101) })).error);
  assert.equal(listFields(form({ name: "🍿".repeat(100) })).name.length, 200);
});
test("list identities reject malformed input and items distinguish movie, TV and game identities", () => {
  assert.ok(listId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
  for (const value of [null, "", "../../profile", "not-a-uuid"]) assert.equal(listId(value), null);
  assert.deepEqual(listItem(form({ media_type: "movie", tmdb_id: "550" })), { media_type: "movie", tmdb_id: 550 });
  assert.ok(listItem(form({ media_type: "tv", tmdb_id: "1396" })));
  for (const media_type of ["person", "episode", "all"]) assert.equal(listItem(form({ media_type, tmdb_id: "1" })), null);
  for (const tmdb_id of ["0", "-1", "01", "1.5", "1e3", "2147483648"]) assert.equal(listItem(form({ media_type: "movie", tmdb_id })), null);
});

test("games use an explicit IGDB identity and descriptions are bounded",()=>{ assert.deepEqual(listItem(form({media_type:"game",igdb_id:"1942"})),{media_type:"game",igdb_id:1942}); assert.equal(listItem(form({media_type:"game",tmdb_id:"1942"})),null); assert.ok(listFields(form({name:"Games",description:"x".repeat(2001)})).error); });
