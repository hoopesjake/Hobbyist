import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Module} from "node:module";
import ts from "typescript";
import {gameId,parseGame,gameStatuses} from "../src/lib/game-validation.ts";
const form=values=>{const result=new FormData();for(const [key,value] of Object.entries({igdb_id:"1",...values}))for(const item of Array.isArray(value)?value:[value])result.append(key,item);return result;};
function setup(user="owner"){
 const rows=[{user_id:"owner",igdb_id:1,status:"completed",owned:true,rating:5,review:"Keep",manual_playtime_minutes:75,wishlist:false,want_to_play_more:true}];
 const client={from(){let filters=[];return {async upsert(data,options){const existing=rows.find(row=>row.user_id===data.user_id&&row.igdb_id===data.igdb_id);if(existing&&!options.ignoreDuplicates)Object.assign(existing,data);else if(!existing)rows.push(data);return {error:null};},update(change){this.operation=["update",change];return this;},delete(){this.operation=["delete"];return this;},eq(key,value){filters.push([key,value]);return this;},then(resolve,reject){return Promise.resolve().then(()=>{const matches=row=>filters.every(([key,value])=>row[key]===value);for(let index=rows.length-1;index>=0;index--)if(matches(rows[index])){if(this.operation[0]==="update")Object.assign(rows[index],this.operation[1]);else rows.splice(index,1);}return {error:null};}).then(resolve,reject);}};}};
 const stubs={"next/cache":{revalidatePath(){}},"@/lib/auth":{currentUser:async()=>user?{id:user}:null},"@/lib/supabase/server":{createClient:async()=>client},"@/lib/game-validation":{gameId,parseGame,gameStatuses},"@/lib/igdb":{getGame:async()=>({id:1,platforms:[{id:6,name:"PC"}]}),IgdbError:class extends Error{}}};
 const actionModule=new Module("game-actions-test");actionModule.require=name=>{if(stubs[name])return stubs[name];throw Error(name);};actionModule._compile(ts.transpileModule(readFileSync(new URL("../src/app/games/actions.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,"game-actions-test.cjs");return {actions:actionModule.exports,rows};
}
test("quick queue additions preserve progress, ownership, review, rating and recorded hours",async()=>{
 const state=setup();const before={...state.rows[0]};assert.ok((await state.actions.quickAddGame({},form({intent:"wishlist"}))).message);assert.deepEqual(state.rows[0],{...before,wishlist:true});
 await state.actions.quickAddGame({},form({intent:"playing"}));assert.equal(state.rows[0].status,"playing");assert.equal(state.rows[0].manual_playtime_minutes,75);assert.equal(state.rows[0].want_to_play_more,true);
});
test("full saves persist manual minutes and selected platforms; scores can be cleared",async()=>{
 const state=setup();const result=await state.actions.saveGame({},form({status:"paused",ownership:"owned",platform_ids:["6"],hours:"2.5",rating:"4.5",review:"Updated",wishlist:"on",want_to_play_more:"on"}));assert.ok(result.message);assert.equal(state.rows[0].manual_playtime_minutes,150);assert.equal(state.rows[0].rating,4.5);assert.deepEqual(state.rows[0].platform_ids,[6]);
 await state.actions.saveGame({},form({status:"paused",rating:"",review:""}));assert.equal(state.rows[0].rating,null);assert.equal(state.rows[0].review,"");assert.equal(state.rows[0].status,"paused");
});
test("platforms not available for a game are rejected before writing",async()=>{
 const state=setup();assert.ok((await state.actions.saveGame({},form({platform_ids:["999"]}))).error);assert.equal(state.rows[0].review,"Keep");
});
test("users cannot forge owner identity or remove another user's tracking",async()=>{
 const state=setup("visitor");await state.actions.removeGame({},form({user_id:"owner"}));assert.equal(state.rows.length,1);await state.actions.quickAddGame({},form({intent:"wishlist",user_id:"owner"}));assert.equal(state.rows[0].wishlist,false);assert.equal(state.rows[1].user_id,"visitor");
});
test("signed-out and invalid actions cannot write",async()=>{
 const state=setup(null);assert.ok((await state.actions.saveGame({},form({}))).error);assert.ok((await state.actions.quickAddGame({},form({intent:"playing"}))).error);const owner=setup();assert.ok((await owner.actions.quickAddGame({},form({intent:"unknown"}))).error);assert.equal(owner.rows.length,1);
});
