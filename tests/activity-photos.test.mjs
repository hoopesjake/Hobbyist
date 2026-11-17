import test from "node:test";
import assert from "node:assert/strict";
import { Module } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as validation from "../src/lib/activity-photo-validation.ts";
import { calendarId } from "../src/lib/calendar-domain.ts";
const owner="a1111111-1111-4111-8111-111111111111",entry="a2222222-2222-4222-8222-222222222222",id="a3333333-3333-4333-8333-333333333333";
function setup(){
 let user=owner,failUpload=false;const rows=[],files=new Map();let uploads=0;
 const client={from(table){let operation="read",values,filters=[];const source=()=>table==="calendar_entries"?[{id:entry,user_id:owner,kind:"actual",media_type:"movie"}]:rows;const matches=row=>filters.every(([key,value])=>row[key]===value);
 const run=()=>{if(operation==="insert"){const row={...values,state:"pending",created_at:new Date().toISOString(),storage_path:`${values.user_id}/${values.entry_id}/${values.id}.jpg`};rows.push(row);return {data:row,error:null};}const found=source().filter(matches);if(operation==="update")for(const row of found)Object.assign(row,values);if(operation==="delete")for(const row of found)rows.splice(rows.indexOf(row),1);return {data:found,error:null};};
 const q={select(){return this;},eq(key,value){filters.push([key,value]);return this;},order(){return this;},insert(value){operation="insert";values=value;return this;},update(value){operation="update";values=value;return this;},delete(){operation="delete";return this;},async maybeSingle(){const result=run();return {...result,data:Array.isArray(result.data)?result.data[0]||null:result.data};},async single(){return this.maybeSingle();},then(resolve,reject){return Promise.resolve(run()).then(resolve,reject);}};return q;},storage:{from(){return {async upload(path,bytes){uploads++;if(failUpload)return {error:{message:"Offline"}};files.set(path,new Blob([bytes],{type:"image/jpeg"}));return {error:null};},async download(path){return files.has(path)?{data:files.get(path),error:null}:{data:null,error:{message:"Not found"}};}};}}};
 const stubs={"@/lib/auth":{currentUser:async()=>user?{id:user}:null},"@/lib/supabase/server":{createClient:async()=>client},"@/lib/calendar-domain":{calendarId},"@/lib/activity-photo-validation":validation,"@/lib/activity-photo-storage":{cleanActivityPhotos:async()=>{}}};
 const compile=file=>{const compiled=new Module(file);compiled.require=name=>{if(stubs[name])return stubs[name];throw Error(name);};compiled._compile(ts.transpileModule(readFileSync(new URL(file,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);return compiled.exports;};
 return {api:compile("../src/app/api/activity-photos/route.ts"),photo:compile("../src/app/api/activity-photos/[id]/route.ts"),rows,files,setUser:value=>{user=value;},fail:value=>{failUpload=value;},uploads:()=>uploads};
}
function request(bytes=new Uint8Array([255,216,255,0,255,217]),type="image/jpeg") {const body=new FormData();body.set("id",id);body.set("entry_id",entry);body.set("photo",new File([bytes],"photo.jpg",{type}));return new Request("http://localhost/api/activity-photos",{method:"POST",body});}
const context={params:Promise.resolve({id})};
test("photo uploads are idempotent, private, and can be read only through an owned record",async()=>{
 const state=setup();assert.equal((await state.api.POST(request())).status,200);assert.equal(state.rows.length,1);assert.equal(state.rows[0].state,"ready");
 assert.equal((await state.api.POST(request())).status,200);assert.equal(state.uploads(),1);
 const response=await state.photo.GET(new Request("http://localhost"),context);assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"private, no-store");assert.equal(response.headers.get("x-content-type-options"),"nosniff");
 state.setUser("other");assert.equal((await state.photo.GET(new Request("http://localhost"),context)).status,404);assert.equal((await state.api.POST(request())).status,400);
 state.setUser(owner);assert.equal((await state.photo.DELETE(new Request("http://localhost",{method:"DELETE"}),context)).status,204);assert.equal((await state.photo.GET(new Request("http://localhost"),context)).status,404);
});
test("failed uploads retain one reservation and retry without duplicate metadata",async()=>{
 const state=setup();state.fail(true);assert.equal((await state.api.POST(request())).status,503);assert.equal(state.rows.length,1);assert.equal(state.rows[0].state,"pending");
 state.fail(false);assert.equal((await state.api.POST(request())).status,200);assert.equal(state.rows.length,1);assert.equal(state.rows[0].state,"ready");
});
test("signed-out, cross-origin, invalid file signatures and oversized requests are rejected",async()=>{
 const state=setup();state.setUser(null);assert.equal((await state.api.POST(request())).status,401);state.setUser(owner);
 const cross=request();cross.headers.set("origin","https://untrusted.test");assert.equal((await state.api.POST(cross)).status,403);
 assert.equal((await state.api.POST(request(new TextEncoder().encode("<svg/>"),"image/svg+xml"))).status,400);
 const huge=request();huge.headers.set("content-length",String(validation.maxActivityPhotoBytes+100000));assert.equal((await state.api.POST(huge)).status,413);assert.equal(state.rows.length,0);
});

test("captions can be saved, edited and cleared only by the photo owner",async()=>{
 const state=setup();const original=request();const form=await original.formData();form.set("caption","Movie night");
 assert.equal((await state.api.POST(new Request("http://localhost/api/activity-photos",{method:"POST",body:form}))).status,200);
 assert.equal(state.rows[0].caption,"Movie night");
 const patch=caption=>new Request("http://localhost/api/activity-photos/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({caption})});
 assert.equal((await state.photo.PATCH(patch("With Sam"),context)).status,200);assert.equal(state.rows[0].caption,"With Sam");
 assert.equal((await state.photo.PATCH(patch("x".repeat(501)),context)).status,400);
 state.setUser("other");assert.equal((await state.photo.PATCH(patch("Forged"),context)).status,404);assert.equal(state.rows[0].caption,"With Sam");
 state.setUser(owner);assert.equal((await state.photo.PATCH(patch(""),context)).status,200);assert.equal(state.rows[0].caption,"");
});
