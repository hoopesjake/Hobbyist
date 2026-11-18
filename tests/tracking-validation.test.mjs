import test from "node:test";
import assert from "node:assert/strict";
import { parseTracking,episodeIndex,showProgress,nextEpisode } from "../src/lib/tracking-validation.ts";
const form = values => {const result=new FormData();for(const [key,value] of Object.entries(values))result.set(key,value);return result;};
test("movies only accept movie flags/date/review, ignoring obsolete progress fields",()=>{
 const result=parseTracking("movie",form({on_watchlist:"on",watched:"on",watched_on:"2026-11-15",rating:"4.5",review:"Good film",contains_spoilers:"on",status:"watching",started_on:"bad"}),"2026-11-16");
 assert.deepEqual(result.movie,{on_watchlist:true,watched:true,watched_on:"2026-11-15",rating:4.5,review:"Good film",contains_spoilers:true});
 assert.ok(parseTracking("movie",form({watched_on:"2026-11-15"}),"2026-11-16").error);
});
test("episodes may be watched without a review; ratings also mark watched",()=>{
 assert.equal(parseTracking("episode",form({watched:"on"})).episode.rating,null);
 assert.equal(parseTracking("episode",form({rating:"3.5"})).episode.watched,true);
 assert.equal(parseTracking("episode",form({rating:"4",review:"A reveal",contains_spoilers:"on"})).episode.contains_spoilers,true);
});
test("show dates and rating remain separate from episode/movie fields",()=>{
 const result=parseTracking("show",form({status:"watching",rating:"5",started_on:"2026-01-05",completed_on:"2026-02-12",watched_on:"bad",watched:"on"}),"2026-11-16");
 assert.equal(result.show.rating,5);assert.equal(result.show.completed_on,"2026-02-12");assert.equal("watched_on" in result.show,false);
 assert.ok(parseTracking("show",form({status:"watchlist"})).error);
 assert.ok(parseTracking("show",form({status:"completed",started_on:"2026-02-12",completed_on:"2026-01-05"}),"2026-11-16").error);
});
test("rating, review size, and real watch dates are validated",()=>{
 for(const rating of ["NaN","Infinity","3.7","6","0"])assert.ok(parseTracking("episode",form({rating})).error);
 for(const watched_on of ["2026-02-30","2026-11-17","bad"])assert.ok(parseTracking("episode",form({watched:"on",watched_on}),"2026-11-16").error);
 assert.ok(parseTracking("movie",form({review:"x".repeat(10001)})).error);
});
test("specials use season 0 and episodes require positive indices",()=>{
 assert.equal(episodeIndex("0",true),0);assert.equal(episodeIndex("0"),null);assert.equal(episodeIndex("-1",true),null);assert.equal(episodeIndex("1/credits"),null);assert.equal(episodeIndex("7"),7);
});
test("actual watched episode keys determine progress; specials and duplicate keys do not inflate it",()=>{
 const result=showProgress([{season_number:0,episode_count:2},{season_number:1,episode_count:7}],[{season_number:0,episode_number:1},{season_number:1,episode_number:1},{season_number:1,episode_number:1},{season_number:1,episode_number:2}]);
 assert.deepEqual(result,{watched:2,total:7,percentage:29});assert.equal("status" in result,false);
 assert.deepEqual(showProgress([],[]),{watched:0,total:0,percentage:0});
});

test("movie and episode reviews imply watched without inventing dates",()=>{
 for(const kind of ["movie","episode"]){
  for(const values of [{rating:"4.5"},{review:"Loved it"}]){
   const result=parseTracking(kind,form(values));
   assert.equal(result[kind].watched,true);
   assert.equal(result[kind].watched_on,null);
  }
  const watchedOnly=parseTracking(kind,form({watched:"on"}))[kind];
  assert.equal(watchedOnly.watched,true);assert.equal(watchedOnly.rating,null);assert.equal(watchedOnly.review,"");
  assert.equal(parseTracking(kind,form({review:"   "}))[kind].watched,false);
 }
});
test("rating or reviewing a show never overrides the status the user explicitly chose",()=>{
 // Regression test: a rating/review used to silently flip "watching" (and paused/dropped) to
 // "watched", desyncing the displayed status from real episode progress.
 const result=parseTracking("show",form({status:"watching",rating:"5",started_on:"2026-01-05"}),"2026-11-16").show;
 assert.equal(result.status,"watching");assert.equal(result.started_on,"2026-01-05");assert.equal(result.completed_on,null);
 assert.equal(parseTracking("show",form({status:"completed",review:"Excellent"})).show.status,"completed");
 assert.equal(parseTracking("show",form({status:"watching"})).show.status,"watching");
 assert.equal(parseTracking("show",form({status:"paused",rating:"4"})).show.status,"paused");
 assert.equal(parseTracking("show",form({status:"dropped",review:"Not for me"})).show.status,"dropped");
});
test("nextEpisode finds the next air-order episode, crossing seasons, without assuming no gaps",()=>{
 const seasons=[{season_number:0,episode_count:3},{season_number:1,episode_count:4},{season_number:2,episode_count:6}];
 assert.deepEqual(nextEpisode(seasons,{season_number:1,episode_number:2}),{season_number:1,episode_number:3});
 assert.deepEqual(nextEpisode(seasons,{season_number:1,episode_number:4}),{season_number:2,episode_number:1});
 assert.equal(nextEpisode(seasons,{season_number:2,episode_number:6}),null);
 // Specials (season 0) are outside the main sequence, same convention as showProgress: a
 // special watched-latest falls through to the first main-season episode, not special #2.
 assert.deepEqual(nextEpisode(seasons,{season_number:0,episode_number:1}),{season_number:1,episode_number:1});
});
