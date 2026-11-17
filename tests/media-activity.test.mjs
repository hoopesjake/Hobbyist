import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module, createRequire } from "node:module";
const compiledRequire=createRequire(import.meta.url);
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as domain from "../src/lib/calendar-domain.ts";
function compile(file, stubs) {
 const compiled=new Module(file);
 compiled.require=name=>{if(name in stubs)return stubs[name];if(name==="react/jsx-runtime")return compiled.constructor.createRequire(import.meta.url)(name);throw Error(`Unexpected import ${name}`);};
 compiled._compile(ts.transpileModule(readFileSync(new URL(file,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
 return compiled.exports;
}
const plan={id:"plan",kind:"plan",status:"planned",title:"Movie night",event_date:"2099-11-21",start_time:"19:00",time_zone:"America/Denver",media_type:"movie",provider_id:550,category:"movies"};
const actual={...plan,id:"actual",kind:"actual",status:null,event_date:"2020-11-15",title:"At the theater",notes:"A private memory",participants:"Sam",duration_minutes:120,session_rating:4.5};
function setup(signedIn=true,type="movie") {
 const service=compile("../src/lib/media-activity.ts",{"server-only":{},react:{cache:fn=>fn},"@/lib/auth":{},"@/lib/supabase/server":{},"@/lib/calendar-domain":domain,"@/lib/activity-artwork":{}});
 const panel=compile("../src/components/calendar/media-activity-panel.tsx",{
 react:compiledRequire("react"),"next/navigation":{useRouter:()=>({refresh(){}})},"next/link":{default:({href,children,...props})=>React.createElement("a",{href,...props},children)},
 "./calendar-editor":{},"./activity-photos":{ActivityPhotos:()=>null},"@/components/movies/rating-stars":{RatingStars:({rating})=>rating?React.createElement("span",null,`${rating}/5`):null},"@/lib/calendar-domain":domain,
 });
 const components=compile("../src/components/calendar/media-activity.tsx",{
 "next/link":{default:({href,children,...props})=>React.createElement("a",{href,...props},children)},
 "@/lib/tmdb":{getEpisode:async()=>({})},
 "./media-activity-panel":panel,
 "lucide-react":{CalendarDays:()=>null},"@/lib/auth":{currentUser:async()=>signedIn?{id:"owner"}:null},
 "@/lib/media-activity":{...service,getMediaActivity:async()=>({entries:[{...plan,media_type:type},{...actual,media_type:type}],error:null})},
 "@/lib/calendar-domain":domain,"@/components/movies/rating-stars":{RatingStars:({rating})=>rating?React.createElement("span",null,`${rating}/5`):null},
 });return {service,components};
}
test("library indicators open the exact planned event and create actions carry provider identity",()=>{
 const {components,service}=setup();
 const html=renderToStaticMarkup(React.createElement(components.LibraryActivity,{type:"movie",id:550,plans:[plan]}));
 assert.ok(html.includes("entry=plan"));assert.ok(html.includes("date=2099-11-21"));assert.ok(html.includes("7:00 PM"));assert.ok(html.includes("create=plan&amp;media=movie%3A550"));
 const href=service.activityCreateHref("tv",550,"actual",1,3);assert.ok(href.includes("media=tv%3A550"));assert.ok(href.includes("season=1&episode=3"));
});
test("media history displays actual session ratings, memories and distinct planned/session links",async()=>{
 const {components}=setup();const html=renderToStaticMarkup(await components.MediaActivity({type:"movie",id:550}));
 for(const expected of ["Upcoming plans","Activity history","Movie night","At the theater","A private memory","With Sam","4.5/5","Open activity","Log a viewing"])assert.ok(html.includes(expected),expected);
 assert.equal(await setup(false).components.MediaActivity({type:"movie",id:550}),null);
});
test("game session totals count actual durations once and label manual/imported time separately",async()=>{
 const {components}=setup(true,"game");const html=renderToStaticMarkup(await components.MediaActivity({type:"game",id:550}));
 assert.ok(html.includes("Total session time"));assert.ok(html.includes("2h"));assert.ok(html.includes("separate from manual and imported"));assert.ok(html.includes("Log gaming session"));
});
