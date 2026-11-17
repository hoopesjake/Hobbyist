import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";
import * as domain from "../src/lib/calendar-domain.ts";
import * as bookValidation from "../src/lib/book-validation.ts";
import * as activityValidation from "../src/lib/activity-validation.ts";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const planId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries({ id, kind: "actual", title: "Fortnite with friends", category: "games", event_date: "2020-11-17", time_zone: "America/Denver", ...values })) data.set(key, value); return data; };
function setup(user = "owner") {
  const records = [], writes = [], refreshes = [];
  let version = 0;
  const library = {
    book_tracking: [{user_id:"owner",ol_work_id:550,title:"A saved book",authors:["An author"],cover_url:null}],
    game_tracking: [{ user_id: "owner", igdb_id: 550 }, { user_id: "other", igdb_id: 999 }],
    movie_tracking: [{ user_id: "owner", tmdb_id: 550 }], tv_tracking: [{ user_id: "owner", tmdb_id: 550 }],
  };
  const client = { from(table) {
    const filters = []; let operation, values;
    const rows = () => table === "calendar_entries" ? records : library[table];
    const matches = row => filters.every(([key, value]) => row[key] === value);
    const builder = {
      select() { return this; }, eq(key, value) { filters.push([key, value]); return this; },
      insert(value) { operation = "insert"; values = value; return this; },
      update(value) { operation = "update"; values = value; return this; },
      delete() { operation = "delete"; return this; },
      async maybeSingle() { return execute(); }, async single() { return execute(); },
    };
    function execute() {
      if (!operation) return { data: structuredClone(rows().find(matches) || null), error: null };
      writes.push({ table, operation, values });
      if (operation === "insert") {
        if (records.some(row => row.id === values.id || (values.plan_id && row.plan_id === values.plan_id))) return { data: null, error: { code: "23505" } };
        const record = { ...values, updated_at: String(++version) }; records.push(record);
        return { data: structuredClone(record), error: null };
      }
      const index = rows().findIndex(matches);
      if (index < 0) return { data: null, error: null };
      if (operation === "delete") return { data: records.splice(index, 1)[0], error: null };
      Object.assign(records[index], values, { updated_at: String(++version) });
      return { data: structuredClone(records[index]), error: null };
    }
    return builder;
  } };
  client.rpc = async (name, args) => {
    assert.ok(["save_calendar_activity","save_calendar_activity_with_version","save_reading_activity"].includes(name));
    const previous = records.find(row => row.id === args.p_entry.id && row.user_id === user);
    if (args.p_expected && (!previous || previous.updated_at !== args.p_expected)) return { data: null, error: { code: "40001" } };
    const query = client.from("calendar_entries");
    const result = args.p_expected ? await query.update(args.p_entry).eq("id", args.p_entry.id).eq("user_id", user).single() : await query.insert({ ...args.p_entry, user_id: user }).single();
    return { data: result.data ? name !== "save_calendar_activity" ? {id:result.data.id,updated_at:result.data.updated_at} : result.data.id : null, error: result.error };
  };
  const stubs = {
    "next/cache": { revalidatePath: path => refreshes.push(path) },
    "@/lib/auth": { currentUser: async () => user ? { id: user } : null },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/calendar-domain": domain,
    "@/lib/activity-validation": activityValidation,
    "@/lib/book-validation": bookValidation,
    "@/lib/open-library": { getBook: async id => ({id,title:"Verified Book",authors:["Verified Author"],cover_url:null}), searchBooks: async () => ({books:[],hasMore:false}) },
    "@/lib/activity-photo-storage": { cleanActivityPhotos: async () => {} },
    "@/lib/tmdb": { titleName: item => item.name, imageUrl: path => path ? `https://image.tmdb.org/t/p/w342${path}` : null, getTitle: async (_, id) => ({ id, name: "Verified title", poster_path: "/poster.jpg" }), getSeason: async (_, season) => { if (season > 10) throw Error("Not found"); return { season_number: season }; }, getEpisode: async (_, season, episode) => { if (episode > 20) throw Error("Not found"); return { season_number: season, episode_number: episode }; } },
    "@/lib/igdb": { getGameCards: async () => [], getGame: async id => { if (id === 9999) throw Error("Unavailable"); return { id, name: "Verified game", cover: { image_id: "cover" } }; }, gameImage: id => id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${id}.jpg` : null },
  };
  const actionModule = new Module("calendar-actions-test");
  actionModule.require = name => { if (stubs[name]) return stubs[name]; throw Error(`Unexpected dependency ${name}`); };
  actionModule._compile(ts.transpileModule(readFileSync(new URL("../src/app/calendar/actions.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, "calendar-actions-test.cjs");
  return { actions: actionModule.exports, records, library, writes, refreshes };
}
test("calendar creation persists ownership, private notes, historical dates and provider identity", async () => {
  const state = setup();
  assert.ok((await state.actions.saveCalendarEntry({}, form({ user_id: "forged", media: "game:550", notes: "A great memory.", participants: "Sam" }))).message);
  assert.equal(state.records[0].user_id, "owner"); assert.equal(state.records[0].provider, "igdb");
  assert.equal(state.records[0].notes, "A great memory."); assert.equal(state.records[0].privacy, "private");
  assert.deepEqual(state.refreshes, ["/calendar", "/", "/movies", "/tv", "/games"]);
});
test("editing notes and replacing a linked movie update the same record", async () => {
  const state = setup(); await state.actions.saveCalendarEntry({}, form({ media: "game:550" }));
  const result = await state.actions.saveCalendarEntry({}, form({ updated_at: state.records[0].updated_at, category: "movies", media: "movie:550", notes: "Movie night" }));
  assert.ok(result.message); assert.equal(state.records.length, 1);
  assert.equal(state.records[0].media_type, "movie"); assert.equal(state.records[0].provider, "tmdb");
  assert.equal(state.records[0].notes, "Movie night");
  assert.ok(state.writes.every(write => write.table === "calendar_entries"));
});
test("an actual log can differ from its original plan, and replay cannot duplicate it", async () => {
  const state = setup(); await state.actions.saveCalendarEntry({}, form({ id: planId, kind: "plan", title: "Cyberpunk", event_date: "2099-11-21" }));
  const logged = form({ plan_id: planId, title: "Fortnite", duration_minutes: "120" });
  assert.ok((await state.actions.saveCalendarEntry({}, logged)).message);
  assert.ok((await state.actions.saveCalendarEntry({}, logged)).error);
  assert.equal(state.records.length, 2); assert.equal(state.records[0].title, "Cyberpunk");
  assert.equal(state.records[1].plan_id, planId); assert.equal(state.records[1].title, "Fortnite");
});
test("stale edits and deletes cannot overwrite a newer record", async () => {
  const state = setup(); await state.actions.saveCalendarEntry({}, form({})); const old = state.records[0].updated_at;
  await state.actions.saveCalendarEntry({}, form({ updated_at: old, title: "Updated" }));
  assert.ok((await state.actions.saveCalendarEntry({}, form({ updated_at: old, title: "Stale" }))).error);
  assert.ok((await state.actions.deleteCalendarEntry({}, form({ updated_at: old }))).error);
  assert.equal(state.records[0].title, "Updated");
});
test("signed-out and cross-owner actions cannot read or mutate private records", async () => {
  const signedOut = setup(null);
  for (const name of ["saveCalendarEntry", "deleteCalendarEntry"]) assert.ok((await signedOut.actions[name]({}, form({ updated_at: "1" }))).error);
  assert.ok((await signedOut.actions.loadCalendarEntry(id)).error);
  const other = setup("other"); other.records.push({ id, user_id: "owner", kind: "actual", plan_id: null, title: "Private", updated_at: "1" });
  assert.ok((await other.actions.saveCalendarEntry({}, form({ updated_at: "1" }))).error);
  assert.ok((await other.actions.deleteCalendarEntry({}, form({ updated_at: "1" }))).error);
  assert.equal((await other.actions.loadCalendarEntry(id)).entry, null);
  assert.equal(other.records[0].title, "Private"); assert.equal(other.records.length, 1);
});
test("library membership is owner scoped, with historical associations retained after untracking", async () => {
  const state = setup(); assert.ok((await state.actions.saveCalendarEntry({}, form({ media: "game:999" }))).error);
  await state.actions.saveCalendarEntry({}, form({ media: "game:550" })); state.library.game_tracking.length = 0;
  assert.ok((await state.actions.saveCalendarEntry({}, form({ media: "game:550", updated_at: state.records[0].updated_at, notes: "Still editable" }))).message);
  assert.equal(state.records[0].notes, "Still editable");
});
test("TV episode references are verified before saving; nonexistent episodes are rejected", async () => {
  const state = setup();
  assert.ok((await state.actions.saveCalendarEntry({}, form({ category: "tv", media: "tv:550", season_number: "0", episode_number: "1" }))).message);
  const result = await state.actions.saveCalendarEntry({}, form({ category: "tv", media: "tv:550", season_number: "0", episode_number: "999", updated_at: state.records[0].updated_at }));
  assert.ok(result.error); assert.equal(state.records[0].episode_number, 1);
});
test("kind and plan associations cannot be changed by editing; owner can delete notes and activity", async () => {
  const state = setup(); await state.actions.saveCalendarEntry({}, form({ notes: "Private" }));
  assert.ok((await state.actions.saveCalendarEntry({}, form({ kind: "plan", updated_at: state.records[0].updated_at }))).error);
  assert.ok((await state.actions.saveCalendarEntry({}, form({ notes: "", updated_at: state.records[0].updated_at }))).message);
  assert.equal(state.records[0].notes, "");
  assert.ok((await state.actions.deleteCalendarEntry({}, form({ updated_at: state.records[0].updated_at }))).message);
  assert.equal(state.records.length, 0);
});

test("new catalog items are verified and flagged for the atomic library transaction", async () => {
  const state = setup();
  const result = await state.actions.saveCalendarEntry({}, form({ media: "movie:701", category: "movies", library_add: "on", media_title: "Forged title" }));
  assert.ok(result.message);
  assert.equal(state.records[0].library_add, true);
  assert.equal(state.records[0].media_title, "Verified title");
  assert.equal(state.records[0].media_image, "https://image.tmdb.org/t/p/w342/poster.jpg");
  // The action performs one calendar write. The tested SQL trigger owns the
  // transactional library addition; no separate preliminary library write exists.
  assert.ok(state.writes.every(write => write.table === "calendar_entries"));
});

test("unverified catalog titles cannot create a calendar record or library write", async () => {
  const state = setup();
  const result = await state.actions.saveCalendarEntry({}, form({ media: "game:9999", library_add: "on" }));
  assert.ok(result.error); assert.equal(state.records.length, 0); assert.equal(state.writes.length, 0);
});

test("actual activity in an existing library requests field-specific synchronization in the transaction", async () => {
  const state = setup();
  await state.actions.saveCalendarEntry({}, form({ media: "game:550", library_add: "on" }));
  assert.equal(state.records[0].library_add, true);
  assert.equal(state.library.game_tracking.length, 2);
});

test("book sessions persist stable Open Library identity and validated reading pages", async () => {
 const state=setup();
 const result=await state.actions.saveCalendarEntry({},form({category:"books",media:"book:550",reading_start_page:"1",reading_end_page:"30"}));
 assert.ok(result.message);assert.equal(state.records[0].provider,"openlibrary");assert.equal(state.records[0].reading_end_page,30);
 assert.ok((await state.actions.saveCalendarEntry({},form({category:"books",media:"book:550",reading_start_page:"40",reading_end_page:"30"}))).error);
});

test("photo workflows receive the saved version needed for conflict-safe upload retries", async () => {
 const state=setup();
 const result=await state.actions.saveCalendarEntry({},form({media:"game:550",photo_workflow:"on"}));
 assert.equal(result.id,id);assert.equal(result.updated_at,state.records[0].updated_at);assert.ok(result.message);
});
