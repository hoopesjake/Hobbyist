import test from "node:test";
import assert from "node:assert/strict";
import { gameStatistics } from "../src/lib/game-statistics.ts";
const entry=(id,extra={})=>({igdb_id:id,status:null,wishlist:false,to_be_played:false,want_to_play_more:false,favorite:false,owned:null,manual_playtime_minutes:null,platform_ids:[],rating:null,completed_on:null,...extra});
test("statistics use recorded playtime once and independent queue membership",()=>{
 const stats=gameStatistics([entry(1,{status:"completed",wishlist:true,want_to_play_more:true,manual_playtime_minutes:120,completed_on:"2026-11-16",platform_ids:[6],rating:5}),entry(2,{wishlist:true,to_be_played:true,manual_playtime_minutes:60}),entry(3,{status:"completed"})],[{id:1,name:"First",genres:[{id:1,name:"RPG"}],platforms:[{id:6,name:"PC"}]}],"2026-11-17");
 assert.equal(stats.total,3);assert.equal(stats.minutes,180);assert.equal(stats.wishlist,2);assert.equal(stats.playMore,1);assert.equal(stats.completed,2);assert.equal(stats.undated,1);assert.equal(stats.mostPlayed.id,1);assert.equal(stats.platforms[0].count,1);assert.equal(stats.months.at(-1).count,1);assert.deepEqual(stats.years,[["2026",1]]);assert.equal(stats.average,5);
});
test("missing data does not fabricate ratings, platforms, or dates",()=>{
 const stats=gameStatistics([entry(1)],[],"2026-01-01");assert.equal(stats.average,null);assert.equal(stats.mostPlayed,null);assert.equal(stats.minutes,0);assert.equal(stats.recorded,0);assert.equal(stats.genres.length,0);assert.equal(stats.platforms.length,0);assert.equal(stats.months[0].key,"2025-02");
});
