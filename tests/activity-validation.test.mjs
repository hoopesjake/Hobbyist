import test from "node:test";
import assert from "node:assert/strict";
import { parseActivityDetails } from "../src/lib/activity-validation.ts";
const form = values => { const data = new FormData(); for (const [key,value] of Object.entries(values)) data.set(key,value); return data; };
test("unrated sessions do not imply rating or review changes", () => {
 const result = parseActivityDetails(form({}),true,"movie");
 assert.equal(result.rating,null); assert.equal(result.changed,false); assert.equal(result.review,null);
});
test("ratings use the existing half-star scale and explicit current-rating intent", () => {
 for(const rating of ["0","0.3","6","NaN","Infinity"]) assert.ok(parseActivityDetails(form({rating}),true,"movie").error);
 const result = parseActivityDetails(form({rating:"4.5",rating_changed:"on",update_current:"on",review_changed:"on",review:"A review",contains_spoilers:"on",notes:"PRIVATE"}),true,"movie");
 assert.equal(result.rating,4.5); assert.equal(result.changed,true); assert.equal(result.updateCurrent,true); assert.equal(result.review,"A review"); assert.equal(result.spoilers,true);
 assert.ok(parseActivityDetails(form({rating:"4",rating_changed:"on"}),false,"movie").error);
 assert.ok(parseActivityDetails(form({review_changed:"on"}),true,null).error);
});
test("episode identities, independent rating edits and limits are validated", () => {
 const episodes=[{season_number:1,episode_number:3,tmdb_episode_id:10,rating:4,rating_changed:true,update_current:false},{season_number:1,episode_number:4,tmdb_episode_id:11,rating:4.5,rating_changed:true,update_current:true}];
 const result=parseActivityDetails(form({episodes:JSON.stringify(episodes)}),true,"tv");
 assert.equal(result.episodes[0].rating,4); assert.equal(result.episodes[1].rating,4.5); assert.equal(result.episodes[0].update_current,false);
 for(const invalid of [[episodes[0],episodes[0]],[{...episodes[0],rating:4.3}],[{...episodes[0],tmdb_episode_id:-1}],Array(101).fill(episodes[0])])assert.ok(parseActivityDetails(form({episodes:JSON.stringify(invalid)}),true,"tv").error);
 assert.ok(parseActivityDetails(form({episodes:JSON.stringify(episodes)}),true,"movie").error);
 assert.ok(parseActivityDetails(form({episodes:"malformed"}),true,"tv").error);
});
