import test from "node:test";
import assert from "node:assert/strict";
import { parseGame,gameId,gameSearchBody } from "../src/lib/game-validation.ts";
const form=values=>{const data=new FormData();for(const [key,value] of Object.entries(values))for(const item of Array.isArray(value)?value:[value])data.append(key,item);return data;};
test("ownership, status, queues and reviews remain independent",()=>{
 const result=parseGame(form({status:"completed",ownership:"owned",wishlist:"on",to_be_played:"on",want_to_play_more:"on",rating:"4.5",hours:"12.25",platform_ids:["6","48","6"],progress:"29.29"}),"2026-11-17");
 assert.equal(result.game.status,"completed");assert.equal(result.game.owned,true);assert.equal(result.game.wishlist,true);assert.equal(result.game.to_be_played,true);assert.equal(result.game.want_to_play_more,true);assert.equal(result.game.manual_playtime_minutes,735);assert.deepEqual(result.game.platform_ids,[6,48]);
 const queue=parseGame(form({wishlist:"on",review:"Interested"}));assert.equal(queue.game.status,null);assert.equal(queue.game.owned,null);assert.equal(queue.game.manual_playtime_minutes,null);
});
test("invalid ratings, playtime, progress, platforms, states and dates are rejected",()=>{
 for(const value of [{rating:"3.7"},{hours:"-1"},{hours:"Infinity"},{progress:"101"},{progress:"0.001"},{platform_ids:["0"]},{status:"wishlist"},{ownership:"maybe"},{started_on:"2026-02-30"},{started_on:"2026-11-17",completed_on:"2026-11-16"},{last_played_on:"2026-11-18"}])assert.ok(parseGame(form(value),"2026-11-17").error,JSON.stringify(value));
});
test("clearing a rating/review preserves explicitly selected status; review cannot override status",()=>{
 const game=parseGame(form({status:"playing",rating:"",review:"",contains_spoilers:"on"})).game;assert.equal(game.rating,null);assert.equal(game.review,"");assert.equal(game.status,"playing");
});
test("identities and catalog query inputs cannot become query fragments",()=>{
 for(const id of [0,-1,"1;drop", "01","1e3",2147483648])assert.equal(gameId(id),null);
 assert.equal(gameId("1942"),1942);
 const query=gameSearchBody('x"; fields *; //',-1,12,6);assert.ok(query.includes('search "x\\"; fields *; //";'));assert.ok(query.endsWith('offset 0;'));assert.throws(()=>gameSearchBody("",1,-1));
});
