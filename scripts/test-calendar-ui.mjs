// Browser verification of the real Calendar components with isolated fixtures.
// This harness never contacts Supabase or renders fixture data in the app itself.
import { createServer } from "node:http";
import { readFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const toolsRoot = path.resolve("node_modules/.cache/calendar-tools/node_modules");
const { build } = await import(pathToFileURL(path.join(toolsRoot, "esbuild/lib/main.js")).href);
const { chromium } = await import(pathToFileURL(path.join(toolsRoot, "playwright-core/index.mjs")).href);
const fixtureActions = `
import {parseCalendarEntry} from "@/lib/calendar-domain";
const read=()=>JSON.parse(localStorage.getItem("calendar-fixtures")||"[]");
const write=entries=>{localStorage.setItem("calendar-fixtures",JSON.stringify(entries));window.dispatchEvent(new Event("calendar-refresh"));};
export async function saveCalendarEntry(_,form){
 const parsed=parseCalendarEntry(form,new Date("2026-11-17T18:00:00Z"));if(parsed.error)return parsed;
 const entries=read(),previous=entries.find(e=>e.id===parsed.entry.id),entry={...parsed.entry,user_id:"fixture-owner",updated_at:new Date().toISOString()};
 entry.session_rating=form.get("rating_changed")==="on"?(Number(form.get("rating"))||null):previous?.session_rating??null;
 entry.episodes=JSON.parse(form.get("episodes")||"[]");
 if(entry.media_type){entry.media_image="/cover.svg?title="+encodeURIComponent(entry.media_title);}
 if(form.get("library_add")==="on"){
  const added=JSON.parse(localStorage.getItem("calendar-library-additions")||"[]");
  if(!added.some(item=>item.key===form.get("media")))added.push({key:form.get("media"),title:entry.media_title,media_type:entry.media_type,provider_id:entry.provider_id,image_url:entry.media_image,in_library:true,status:entry.kind==="actual"?(entry.media_type==="movie"?"watched":entry.media_type==="tv"?"watching":"playing"):(entry.media_type==="movie"?"watchlist":entry.media_type==="tv"?"planned":"backlog")});
  localStorage.setItem("calendar-library-additions",JSON.stringify(added));
 }
 const at=entries.findIndex(value=>value.id===entry.id);if(at<0)entries.push(entry);else entries[at]=entry;
 if(entry.plan_id){const plan=entries.find(value=>value.id===entry.plan_id);if(plan)plan.status="completed";}
 write(entries);return {id:entry.id,updated_at:entry.updated_at,message:"Activity saved."};
}
export async function loadCalendarEntry(id){return {entry:read().find(e=>e.id===id)||null,error:null};}
export async function deleteCalendarEntry(_,form){const id=form.get("id");write(read().filter(entry=>entry.id!==id).map(entry=>entry.plan_id===id?{...entry,plan_id:null}:entry));return {id,message:"Activity deleted."};}
const baseItems=[{key:"book:15358691",title:"The Way of Kings",media_type:"book",provider_id:15358691},{key:"game:550",title:"Cyberpunk 2077",media_type:"game",provider_id:550},{key:"game:551",title:"Fortnite",media_type:"game",provider_id:551},{key:"movie:550",title:"The Matrix",media_type:"movie",provider_id:550},{key:"tv:550",title:"Loki",media_type:"tv",provider_id:550}].map(item=>({...item,image_url:"/cover.svg?title="+encodeURIComponent(item.title),in_library:true}));
export async function loadCalendarLibrary(category,page=1){
 if(!["movies","tv","games","books","all"].includes(category))throw Error("Search must stay inside the chosen library");
 (window.__libraryCalls??=[]).push(category);
 const type=category==="all"?null:category==="movies"?"movie":category==="tv"?"tv":category==="books"?"book":"game";
 const added=JSON.parse(localStorage.getItem("calendar-library-additions")||"[]");
 return {items:page===1?[...baseItems,...added].filter(item=>!type||item.media_type===type):(!type||type==="game")?[{key:"game:552",title:"Stardew Valley",media_type:"game",provider_id:552,image_url:"/cover.svg?title=Stardew",in_library:true}]:[],hasMore:page===1&&(!type||type==="game")};
}
export async function searchCalendarCatalog(query,type){return {items:query.toLowerCase().includes("hunger")&&type==="movie"?[{key:"movie:701",title:"The Hunger Games",media_type:"movie",provider_id:701,image_url:"/cover.svg?title=The%20Hunger%20Games",year:"2012",in_library:false}]:[],hasMore:false};}


`;
const entry = `
import React,{useState,useEffect} from "react";import {createRoot} from "react-dom/client";
import {CalendarClient} from "@/components/calendar/calendar-client";
import {MediaActivityPanel} from "@/components/calendar/media-activity-panel";
import {NavigationTabs} from "@/components/layout/navigation-tabs";
import {calendarUrl} from "@/components/calendar/calendar-client";
const query=new URLSearchParams(location.search),date=query.get("date")||"2026-11-17",view=query.get("view")||"month";
function App(){const [entries,setEntries]=useState(()=>JSON.parse(localStorage.getItem("calendar-fixtures")||"[]"));
 useEffect(()=>{const refresh=()=>setEntries(JSON.parse(localStorage.getItem("calendar-fixtures")||"[]"));window.addEventListener("calendar-refresh",refresh);return()=>window.removeEventListener("calendar-refresh",refresh);},[]);
 const type=location.pathname.includes("/tv/")?"tv":location.pathname.includes("/game/")?"game":"movie";
 if(location.pathname.startsWith("/media/"))return <main className="main-content page-content" style={{margin:"0 auto"}}><MediaActivityPanel type={type} id={550} title={type==="movie"?"The Matrix":type==="tv"?"Loki":"Cyberpunk 2077"} image="/cover.svg?title=Media" entries={entries.filter(e=>e.media_type===type&&e.provider_id===550)} today="2026-11-17"/></main>;
 return <main className="main-content page-content calendar-page" style={{margin:"0 auto"}}><header className="welcome-row"><div><p className="eyebrow">TIME WELL SPENT</p><h1>Calendar & memories<span>.</span></h1><p className="welcome-copy">Make a plan. Keep a memory.</p></div></header>
 <NavigationTabs label="Calendar views" tabs={["month","week","day","agenda"].map(value=>({href:calendarUrl(value,date,"America/Denver"),label:value==="agenda"?"Agenda / Journal":value[0].toUpperCase()+value.slice(1)}))}/>
 <CalendarClient entries={entries} date={date} today="2026-11-17" view={view} timeZone="America/Denver"/></main>;
}createRoot(document.getElementById("root")).render(<App/>);
`;
const bundle = await build({ stdin: { contents: entry, loader: "tsx", resolveDir: process.cwd() }, bundle: true, write: false, format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, alias: { "@": path.resolve("src") }, plugins: [{ name: "calendar-fixtures", setup(plugin) {
  plugin.onResolve({ filter: /^@\/app\/calendar\/activity-actions$/ }, () => ({ path: "activity-actions", namespace: "fixtures" }));
  plugin.onResolve({ filter: /^@\/app\/calendar\/actions$/ }, () => ({ path: "actions", namespace: "fixtures" }));
  plugin.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "fixtures" }));
  plugin.onResolve({ filter: /^next\/image$/ }, () => ({ path: "image", namespace: "fixtures" }));
  plugin.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixtures" }));
  plugin.onLoad({ filter: /.*/, namespace: "fixtures" }, args => ({ loader: "tsx", resolveDir: process.cwd(), contents: args.path === "activity-actions" ? `export async function loadActivitySeasons(){return {seasons:[{season_number:0,name:"Specials",episode_count:2},{season_number:1,name:"Season 1",episode_count:6},{season_number:2,name:"Season 2",episode_count:6}]};}export async function loadActivityContext(){return {rating:4,review:"Existing review",spoilers:false};}export async function loadActivitySeason(showId,season){return {episodes:[{season_number:season,episode_number:season===0?1:3,tmdb_episode_id:883003,name:"Episode Three",current_rating:4},{season_number:season,episode_number:season===0?2:4,tmdb_episode_id:883004,name:"Episode Four",current_rating:4.5}]};}` : args.path === "actions" ? fixtureActions : args.path === "navigation" ? `export const useRouter=()=>({refresh(){window.dispatchEvent(new Event("calendar-refresh"));},replace(url){history.replaceState(null,"",url);}});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);` : args.path === "image" ? `import React from "react";export default function Image(props){return <img {...props}/>;}` : `import React from "react";export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>;}` }));
} }] });
const cssFiles = (await readdir(".next/static", { recursive: true })).filter(file => file.endsWith(".css"));
assert.ok(cssFiles.length, "Run npm run build before browser verification.");
const css = (await Promise.all(cssFiles.map(file => readFile(path.join(".next/static", file), "utf8")))).join("\n");
const server = createServer((req, res) => {
  if (req.url.startsWith("/cover.svg")) {const title=new URL(req.url,"http://localhost").searchParams.get("title")||"Hobby";res.setHeader("Content-Type","image/svg+xml");res.end('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#35422d"/><circle cx="100" cy="105" r="54" fill="#c79c6f"/><path d="M25 260 L100 140 L175 260" fill="#182413"/><text x="100" y="283" font-family="Georgia" font-size="17" fill="#eee1c6" text-anchor="middle">'+title.replace(/[<>&]/g,"")+'</text></svg>');}
  else if (req.url === "/calendar.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].text); }
  else if (req.url === "/calendar.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
  else { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/calendar.css"></head><body><div id="root"></div><script src="/calendar.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CALENDAR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  const photoFiles = new Map();let failPhotoOnce=false;
  await page.route("**/api/activity-photos**",async route=>{
    const request=route.request(),url=new URL(request.url()),id=url.pathname.split("/")[3];
    if(request.method()==="POST"){
      if(failPhotoOnce){failPhotoOnce=false;return route.fulfill({status:503,json:{error:"Temporary upload failure"}});}
      const form=await new Response(request.postDataBuffer(),{headers:{"Content-Type":request.headers()["content-type"]}}).formData();
      const photo={id:form.get("id"),entry_id:form.get("entry_id"),created_at:new Date().toISOString(),state:"ready",caption:String(form.get("caption")||"")};
      photoFiles.set(photo.id,{photo,bytes:Buffer.from(await form.get("photo").arrayBuffer())});
      return route.fulfill({json:{photo}});
    }
    if(request.method()==="PATCH"){const value=photoFiles.get(id);if(!value)return route.fulfill({status:404,json:{error:"Unavailable"}});value.photo.caption=request.postDataJSON().caption;return route.fulfill({json:{photo:value.photo}});}
    if(request.method()==="DELETE"){photoFiles.delete(id);return route.fulfill({status:204});}
    if(id){const value=photoFiles.get(id);return value?route.fulfill({contentType:"image/jpeg",body:value.bytes}):route.fulfill({status:404});}
    return route.fulfill({json:{photos:[...photoFiles.values()].map(value=>value.photo).filter(photo=>photo.entry_id===url.searchParams.get("entry"))}});
  });

  await mkdir(".next/calendar-verification", { recursive: true });
  async function checkCategoryWidths() {
    const geometry = await page.getByRole("group", { name: "Hobby type" }).evaluate(group => {
      const bar = group.previousElementSibling.getBoundingClientRect(), bounds = group.getBoundingClientRect();
      const buttons = [...group.querySelectorAll("button")].map(button => button.getBoundingClientRect());
      return { width: bounds.width, barWidth: bar.width, left: bounds.left, barLeft: bar.left, space: bounds.top - bar.bottom, widths: buttons.map(button => button.width), overflow: group.scrollWidth > group.clientWidth };
    });
    assert.ok(Math.abs(geometry.width - geometry.barWidth) < 1);
    assert.ok(Math.abs(geometry.left - geometry.barLeft) < 1);
    assert.ok(geometry.space >= 20);
    assert.ok(Math.max(...geometry.widths) - Math.min(...geometry.widths) < 1);
    assert.equal(geometry.overflow, false);
  }
  async function checkRatingUnderTitle() {
    await page.locator(".hobby-selected-rating .calendar-header-rating").waitFor();
    const bounds = await page.locator(".hobby-selected-content").evaluate(card => {
      const title=card.querySelector("h3").getBoundingClientRect(),rating=card.querySelector(".hobby-selected-rating").getBoundingClientRect();
      return {titleBottom:title.bottom,titleLeft:title.left,ratingTop:rating.top,ratingLeft:rating.left};
    });
    assert.ok(bounds.ratingTop>=bounds.titleBottom);
    assert.ok(Math.abs(bounds.ratingLeft-bounds.titleLeft)<1);
    const stars = await page.locator(".hobby-selected-rating .rating-star-glyph").evaluateAll(glyphs => glyphs.map(glyph => ({svgs:glyph.querySelectorAll("svg").length,paths:glyph.querySelectorAll("path").length,width:glyph.getBoundingClientRect().width,height:glyph.getBoundingClientRect().height})));
    assert.ok(stars.every(star=>star.svgs===1&&star.paths===1&&star.width===star.height),"Each star uses one aligned shape for both fill and outline");

  }
  async function pickLibrary(title, query=title, type="") {
    if(await page.getByRole("button",{name:"Change hobby",exact:true}).count())await page.getByRole("button",{name:"Change hobby",exact:true}).click();
    else await page.getByRole("button",{name:/^Link hobby/}).click();
    assert.equal(await page.getByRole("combobox",{name:"Search library"}).count(),1);
    await page.getByRole("combobox",{name:"Search library"}).fill(query);
    await page.getByRole("option",{name:new RegExp(title)}).waitFor();
    await page.getByRole("button",{name:type==="TV show"?"TV shows":type==="Movie"||title==="The Matrix"?"Movies":"Games",exact:true}).click();
    await page.getByRole("option",{name:new RegExp(title)}).waitFor();
    const expectedType=type==="TV show"?"tv":type==="Movie"||title==="The Matrix"?"movies":"games";
    assert.ok((await page.evaluate(()=>window.__libraryCalls||[])).includes(expectedType));
    if(expectedType==="games")assert.equal(await page.getByRole("option",{name:/The Matrix/}).count(),0);
    assert.equal(await page.getByRole("combobox",{name:"Search library"}).inputValue(),query);
    if(page.viewportSize().width<550){await checkCategoryWidths();await page.screenshot({path:".next/calendar-verification/category-bubbles-mobile.png",fullPage:true});}
    await page.getByRole("option",{name:new RegExp(title+(type?".*"+type:""))}).click();
  }
  await page.goto(`${origin}/calendar?view=month&date=2026-11-17`);
  await page.getByRole("button",{name:"Plan activity",exact:true}).click();
  assert.equal(await page.getByLabel("Title",{exact:true}).count(),0);
  await page.screenshot({path:".next/calendar-verification/hobby-start-desktop.png",fullPage:true});
  await pickLibrary("Cyberpunk 2077");
  await page.getByRole("img",{name:"Your Hobbyist rating: 4 out of 5 stars"}).waitFor();
  await checkRatingUnderTitle();
  assert.equal(await page.getByLabel("Category",{exact:true}).inputValue(),"Games");
  assert.ok(await page.getByRole("img",{name:"Cyberpunk 2077 cover"}).isVisible());
  await page.getByLabel("Title",{exact:true}).fill("Cyberpunk Saturday");
  await page.getByLabel("Date",{exact:true}).fill("2026-11-21");
  await page.locator("summary").filter({hasText:"Timing"}).click();
  await page.getByLabel("Start time",{exact:true}).fill("19:00");
  await page.getByLabel("Duration (minutes)").fill("60");
  await page.getByRole("button",{name:"Save activity",exact:true}).click();
  await page.getByRole("dialog").waitFor({state:"detached"});
  await page.getByRole("status").filter({hasText:"Activity saved."}).waitFor();
  await page.getByRole("status").filter({hasText:"Activity saved."}).waitFor({state:"detached",timeout:6000});
  const eventButton = page.getByRole("button",{name:/Cyberpunk Saturday/});
  await eventButton.hover();
  const preview = page.getByRole("tooltip");
  await preview.waitFor();
  assert.ok(await preview.getByRole("img",{name:"Cyberpunk 2077 cover"}).isVisible());
  assert.ok((await preview.innerText()).includes("7:00 PM"));
  assert.ok((await preview.innerText()).includes("1h"));
  await page.screenshot({path:".next/calendar-verification/event-preview-desktop.png",fullPage:false});
  await page.mouse.move(0,0);
  await preview.waitFor({state:"detached"});
  await eventButton.focus();
  await preview.waitFor();
  await page.keyboard.press("Escape");
  await preview.waitFor({state:"detached"});
  await page.reload();
  await page.getByRole("button",{name:/Cyberpunk Saturday/}).click();
  assert.equal(await page.locator('input[name="media"]').inputValue(),"game:550");
  await page.getByLabel("Title",{exact:true}).fill("Cyberpunk night");
  await page.getByRole("button",{name:"Save activity",exact:true}).click();
  await page.getByRole("dialog").waitFor({state:"detached"});
  await page.getByRole("button",{name:/Cyberpunk night/}).click();
  await page.getByRole("button",{name:"Log what actually happened"}).click();
  await page.getByLabel("Title",{exact:true}).fill("Fortnite with friends");
  await pickLibrary("Fortnite");
  assert.equal(await page.getByLabel("Title",{exact:true}).inputValue(),"Fortnite with friends");
  await page.getByLabel("Date",{exact:true}).fill("2026-11-16");
  await page.getByLabel("Notes & memories").fill("Finally got a win with Sam.");
  await page.locator("summary").filter({hasText:"People & details"}).click();
  await page.getByLabel("Who was there?").fill("Sam");
  await page.locator("summary").filter({hasText:"Timing"}).click();
  await page.getByLabel("Duration (minutes)").fill("120");
  await page.getByLabel("Approximate duration").check();
  await page.getByRole("button",{name:"Save activity",exact:true}).click();
  await page.getByRole("dialog").waitFor({state:"detached"});
  await page.reload();
  let entries=await page.evaluate(()=>JSON.parse(localStorage.getItem("calendar-fixtures")));
  assert.equal(entries.length,2);assert.equal(entries[1].provider_id,551);assert.equal(entries[1].start_time,null);assert.equal(entries[1].plan_id,entries[0].id);
  for(const [label,value] of [["Week","week"],["Day","day"],["Agenda / Journal","agenda"],["Month","month"]]){
    await page.getByRole("link",{name:label,exact:true}).click();await page.locator(".calendar-action-row").waitFor();
    assert.equal(new URL(page.url()).searchParams.get("date"),"2026-11-17");
    if(value==="week"){
      await page.getByRole("button",{name:"Plan activity on November 17 at 9:00 AM",exact:true}).click();
      await page.getByRole("button",{name:"Other activity",exact:true}).click();
      assert.equal(await page.getByLabel("Start time",{exact:true}).inputValue(),"09:00");
      await page.getByRole("button",{name:"Close activity"}).click();
    }
    if(value==="agenda")assert.ok(await page.getByText("Finally got a win with Sam.").isVisible());
    await page.screenshot({path:`.next/calendar-verification/${value}-desktop.png`,fullPage:true});
  }
  // A new catalog title is not added to the library until the activity is saved.
  await page.getByRole("button",{name:"Plan activity",exact:true}).click();
  await page.getByRole("button",{name:/Add a new hobby/}).click();
  const initialCardBounds=await page.getByRole("dialog").boundingBox();
  await page.getByRole("combobox",{name:"Search catalog"}).fill("hunger games");
  await page.getByRole("option",{name:/The Hunger Games/}).waitFor();
  await page.getByRole("button",{name:"Movies",exact:true}).click();
  assert.equal(await page.getByRole("combobox",{name:"Search catalog"}).inputValue(),"hunger games");
  const searchBounds=await page.locator(".hobby-search-input").boundingBox(), categoryBounds=await page.getByRole("group",{name:"Hobby type"}).boundingBox();
  assert.ok(searchBounds.y+searchBounds.height<=categoryBounds.y);
  assert.ok(await page.locator(".hobby-type-label").evaluateAll(labels=>labels.every(label=>{const icon=label.querySelector("svg").getBoundingClientRect(), text=label.querySelector("span").getBoundingClientRect();return text.left>=icon.right&&Math.abs(icon.y+icon.height/2-text.y-text.height/2)<1;})));
  assert.equal(await page.getByRole("button",{name:"Movies",exact:true}).getAttribute("aria-pressed"),"true");
  await checkCategoryWidths();
  // Exercise future category counts without adding unfinished product categories.
  for (const name of ["LEGO", "Pokémon cards"]) await page.getByRole("group", { name: "Hobby type" }).evaluate((group, title) => {
    const button = group.querySelector("button").cloneNode(true);
    button.dataset.layoutFixture = "true"; button.setAttribute("aria-label", title);
    button.querySelector(".hobby-type-label > span").textContent = title;
    group.appendChild(button);
  }, name);
  await checkCategoryWidths();
  await page.screenshot({path:".next/calendar-verification/category-layout-six-items.png",fullPage:true});
  await page.locator('[data-layout-fixture="true"]').evaluateAll(buttons => buttons.forEach(button => button.remove()));
  await page.screenshot({path:".next/calendar-verification/category-bubbles-desktop.png",fullPage:true});
  await page.getByRole("combobox",{name:"Search catalog"}).fill("hunger games");
  await page.getByRole("option",{name:/The Hunger Games/}).waitFor();
  await page.screenshot({path:".next/calendar-verification/hobby-search-desktop.png",fullPage:true});
  await page.getByRole("option",{name:/The Hunger Games/}).click();
  const selectedCardBounds=await page.getByRole("dialog").boundingBox();
  assert.ok(Math.abs(initialCardBounds.x-selectedCardBounds.x)<1);
  assert.ok(Math.abs(initialCardBounds.y-selectedCardBounds.y)<1);
  assert.equal(initialCardBounds.width,selectedCardBounds.width);
  assert.equal(await page.getByLabel("Title",{exact:true}).inputValue(),"The Hunger Games");
  assert.equal(await page.getByLabel("Category",{exact:true}).inputValue(),"Movies");
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("calendar-library-additions")||"[]").length),0);
  await page.getByLabel("Date",{exact:true}).fill("2026-11-19");
  await page.waitForFunction(()=>getComputedStyle(document.querySelector(".hobby-event-details")).opacity==="1");
  await page.screenshot({path:".next/calendar-verification/hobby-selected-desktop.png",fullPage:true});
  await page.getByRole("button",{name:"Save activity",exact:true}).click();
  await page.getByRole("dialog").waitFor({state:"detached"});await page.reload();
  const added=await page.evaluate(()=>JSON.parse(localStorage.getItem("calendar-library-additions")));
  assert.equal(added.length,1);assert.equal(added[0].key,"movie:701");assert.equal(added[0].status,"watchlist");
  await page.getByRole("button",{name:"Log activity",exact:true}).click();
  await page.getByRole("button",{name:/^Link hobby/}).click();
  assert.equal(await page.getByRole("combobox").count(),1);
  await page.getByRole("button",{name:"Books",exact:true}).click();
  await page.getByRole("option",{name:/The Way of Kings/}).waitFor();
  assert.ok(!(await page.getByRole("combobox").isDisabled()));
  assert.ok((await page.evaluate(()=>window.__libraryCalls||[])).includes("books"));
  await page.screenshot({path:".next/calendar-verification/books-library-desktop.png",fullPage:true});
  await page.getByRole("button",{name:"TV shows",exact:true}).click();
  await page.getByRole("option",{name:/Loki/}).waitFor();
  assert.equal(await page.getByRole("option",{name:/The Matrix|Cyberpunk/}).count(),0);
  await page.getByRole("button",{name:"Close activity"}).click();
  await page.setViewportSize({width:390,height:844});await page.reload();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole("button",{name:"Log activity",exact:true}).click();
  await page.screenshot({path:".next/calendar-verification/hobby-start-mobile.png",fullPage:true});
  await pickLibrary("The Hunger Games","hunger","Movie");
  assert.ok(await page.getByRole("img",{name:"The Hunger Games cover"}).isVisible());
  await checkRatingUnderTitle();
  const bounds=await page.getByRole("dialog").boundingBox();assert.ok(bounds.x>=0&&bounds.width<=390);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector(".hobby-event-details")).opacity==="1");
  await page.screenshot({path:".next/calendar-verification/editor-mobile.png",fullPage:true});
  await page.keyboard.press("Escape");assert.equal(await page.getByRole("dialog").count(),0);
  await page.getByRole("link",{name:"Agenda / Journal",exact:true}).click();
  await page.getByRole("button",{name:"Fortnite with friends",exact:true}).click();
  await page.getByRole("button",{name:"Delete activity",exact:true}).click();
  await page.getByRole("button",{name:"Delete permanently",exact:true}).click();
  await page.getByRole("dialog").waitFor({state:"detached"});
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("calendar-fixtures")).filter(entry=>entry.title==="Fortnite with friends").length),0);
  // A complete movie log keeps the session opinion, public review and private memory distinct.
  await page.setViewportSize({width:1920,height:1080});
  await page.getByRole("button",{name:"Log activity",exact:true}).click();
  await pickLibrary("The Matrix");
  await page.waitForFunction(()=>document.querySelector('output[aria-label="Selected rating"]')?.textContent==="4 / 5");
  await checkRatingUnderTitle();
  const movieStars=page.getByRole("group",{name:"Your Hobbyist rating",exact:true});
  await movieStars.getByRole("button",{name:/^4 stars/}).focus();
  await page.keyboard.press("End");await page.keyboard.press("ArrowLeft");
  await checkRatingUnderTitle();
  await page.getByLabel("Notes & memories").fill("Private movie-night memory");
  await page.locator("summary").filter({hasText:/^Review/}).click();
  assert.equal(await page.getByLabel("Review",{exact:true}).inputValue(),"Existing review");
  await page.getByLabel("Review",{exact:true}).fill("A separate review");
  await page.getByLabel("Contains spoilers",{exact:true}).check();
  await page.locator(".hobby-selected h3").evaluate(title=>{title.textContent="Spider-Man: Brand New Day";});
  await checkRatingUnderTitle();
  await page.screenshot({path:".next/calendar-verification/movie-rating-wide.png",fullPage:true});
  await page.getByRole("button",{name:"Save activity",exact:true}).click();
  await page.getByRole("dialog").waitFor({state:"detached"});await page.reload();
  const movieLog=await page.evaluate(()=>JSON.parse(localStorage.getItem("calendar-fixtures")).find(e=>e.media_type==="movie"&&e.provider_id===550&&e.kind==="actual"));
  assert.equal(movieLog.session_rating,4.5);assert.equal(movieLog.notes,"Private movie-night memory");
  await page.getByRole("button",{name:"The Matrix",exact:true}).click();
  assert.ok((await page.getByRole("status",{name:"Selected viewing rating"}).innerText()).includes("4.5"));
  await page.getByRole("group",{name:"Viewing rating",exact:true}).getByRole("button",{name:/^4 stars/}).focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.getByLabel("Update current library rating",{exact:true}).isChecked(),false);
  await page.getByRole("button",{name:"Close activity"}).click();
  await page.getByRole("button",{name:"Log activity",exact:true}).click();
  await pickLibrary("Loki","Loki","TV show");
  await page.getByRole("button",{name:"Choose episodes",exact:true}).click();
  await page.getByRole("checkbox",{name:/S1 E3/}).check();
  await page.getByRole("checkbox",{name:/S1 E4/}).check();
  await page.getByRole("group",{name:"S1 E3 session rating",exact:true}).getByRole("button",{name:/^4 stars/}).focus();
  await page.keyboard.press("End");await page.keyboard.press("ArrowLeft");await page.keyboard.press("ArrowLeft");
  await page.getByRole("group",{name:"S1 E4 session rating",exact:true}).getByRole("button",{name:/^4 stars/}).focus();
  await page.keyboard.press("End");await page.keyboard.press("ArrowLeft");
  await page.screenshot({path:".next/calendar-verification/tv-episode-ratings.png",fullPage:true});
  await page.getByRole("button",{name:"Save activity",exact:true}).click();
  await page.getByRole("dialog").waitFor({state:"detached"});await page.reload();
  const tvLog=await page.evaluate(()=>JSON.parse(localStorage.getItem("calendar-fixtures")).find(e=>e.media_type==="tv"&&e.kind==="actual"));
  assert.equal(tvLog.episodes.length,2);assert.equal(tvLog.episodes[0].rating,4);assert.equal(tvLog.episodes[1].rating,4.5);assert.equal(tvLog.session_rating,null);
  // Older sessions must become visible when Full history expands past the preview limit.
  await page.evaluate(()=>{const entries=JSON.parse(localStorage.getItem("calendar-fixtures"));const original=entries.find(e=>e.media_type==="movie"&&e.provider_id===550&&e.kind==="actual");for(let i=0;i<7;i++)entries.push({...original,id:crypto.randomUUID(),title:`Older movie session ${i}`,event_date:`2017-01-${String(i+1).padStart(2,"0")}`});localStorage.setItem("calendar-fixtures",JSON.stringify(entries));});
  // Exercise actual media-page click handlers, not just their rendered link URLs.
  for(const [type,planLabel,logLabel] of [["movie","Plan to watch","Log a viewing"],["tv","Plan to watch","Log a viewing"],["game","Plan gaming session","Log gaming session"]]){
    await page.goto(`${origin}/media/${type}/550`);
    await page.getByRole("button",{name:planLabel,exact:true}).click();
    await page.getByRole("dialog").waitFor();
    assert.equal(await page.locator('input[name="media"]').inputValue(),`${type}:550`);
    assert.equal(await page.getByRole("button",{name:"Choose photos",exact:true}).count(),0);
    if(type==="tv"){
      await page.locator("summary").filter({hasText:"Season & episode"}).click();
      await page.getByRole("combobox",{name:"Season",exact:true}).getByRole("option",{name:/Season 1/}).waitFor({state:"attached"});
      assert.equal(await page.locator('input[type="number"][name="season_number"],input[type="number"][name="episode_number"]').count(),0);
      await page.getByRole("combobox",{name:"Season",exact:true}).selectOption("1");
      await page.getByRole("combobox",{name:"Episode",exact:true}).getByRole("option",{name:/Episode 3/}).waitFor({state:"attached"});
      await page.getByRole("combobox",{name:"Episode",exact:true}).selectOption("3");
      assert.equal(await page.getByRole("combobox",{name:"Episode",exact:true}).inputValue(),"3");
      await page.getByRole("combobox",{name:"Season",exact:true}).selectOption("2");
      assert.equal(await page.getByRole("combobox",{name:"Episode",exact:true}).inputValue(),"");
      await page.getByRole("combobox",{name:"Season",exact:true}).selectOption("0");
      await page.getByRole("combobox",{name:"Episode",exact:true}).getByRole("option",{name:/Episode 1/}).waitFor({state:"attached"});
      await page.getByRole("combobox",{name:"Episode",exact:true}).selectOption("1");
      await page.screenshot({path:".next/calendar-verification/tv-catalog-episode-picker.png",fullPage:true});
      await page.getByLabel("Title",{exact:true}).fill("Loki catalog plan");
      await page.getByRole("button",{name:"Save activity",exact:true}).click();
      await page.getByRole("dialog").waitFor({state:"detached"});
      await page.getByRole("button",{name:"Loki catalog plan",exact:true}).click();
      assert.equal(await page.getByRole("combobox",{name:"Season",exact:true}).inputValue(),"0");
      assert.equal(await page.getByRole("combobox",{name:"Episode",exact:true}).inputValue(),"1");
    }

    await page.getByRole("button",{name:"Close activity"}).click();
    await page.getByRole("button",{name:logLabel,exact:true}).click();
    await page.getByRole("button",{name:"Choose photos",exact:true}).waitFor();
    assert.equal(await page.getByLabel("Take activity photo").getAttribute("capture"),"environment");
    if(type==="movie"){
      const png=await page.evaluate(async()=>{const canvas=document.createElement("canvas");canvas.width=40;canvas.height=30;const context=canvas.getContext("2d");context.fillStyle="#c9865f";context.fillRect(0,0,40,30);return canvas.toDataURL("image/png").split(",")[1];});
      await page.getByLabel("Choose activity photos").setInputFiles([{name:"memory.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")},{name:"memory-2.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")}]);
      await page.getByRole("img",{name:"Selected activity photo",exact:true}).nth(1).waitFor();
      await page.getByLabel("Caption for selected photo 1",{exact:true}).fill("Movie night with Sam");
      await page.getByLabel("Title",{exact:true}).fill("Photo movie memory");
      failPhotoOnce=true;
      const before=await page.evaluate(()=>JSON.parse(localStorage.getItem("calendar-fixtures")).length);
      await page.getByRole("button",{name:"Save activity",exact:true}).click();
      await page.getByText(/Activity saved.*Temporary upload failure/).waitFor();
      await page.getByRole("button",{name:"Save activity",exact:true}).click();
      await page.getByRole("dialog").waitFor({state:"detached"});
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("calendar-fixtures")).length),before+1);
      await page.reload();
      assert.equal(await page.getByRole("button",{name:"Older movie session 0",exact:true}).count(),0);
      await page.getByRole("button",{name:"View full history",exact:true}).click();
      await page.getByRole("button",{name:"Older movie session 0",exact:true}).waitFor();
      assert.equal(await page.getByRole("button",{name:"Show recent activity",exact:true}).getAttribute("aria-expanded"),"true");
      await page.getByRole("button",{name:"Photo movie memory",exact:true}).click();
      await page.getByRole("dialog").getByRole("img",{name:"Activity memory photo",exact:true}).nth(1).waitFor();
      assert.equal(await page.getByLabel("Caption for photo 1",{exact:true}).inputValue(),"Movie night with Sam");
      await page.getByLabel("Caption for photo 1",{exact:true}).fill("Our favorite theater memory");
      await page.getByRole("button",{name:"Save activity",exact:true}).click();
      await page.getByRole("dialog").waitFor({state:"detached"});
      await page.getByText("Our favorite theater memory",{exact:true}).waitFor();
      await page.reload();
      await page.getByRole("button",{name:"View full history",exact:true}).click();
      await page.getByRole("button",{name:"Photo movie memory",exact:true}).click();
      assert.equal(await page.getByLabel("Caption for photo 1",{exact:true}).inputValue(),"Our favorite theater memory");

      await page.getByRole("dialog").locator(".activity-photos").scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>getComputedStyle(document.querySelector(".hobby-event-details")).opacity==="1");
      await page.screenshot({path:".next/calendar-verification/activity-photos-desktop.png",fullPage:true});
      await page.setViewportSize({width:390,height:844});
      await page.getByRole("dialog").locator(".activity-photos").scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:".next/calendar-verification/activity-photos-mobile.png",fullPage:true});
      await page.getByRole("button",{name:"Remove activity photo",exact:true}).first().click();
      await page.waitForFunction(()=>document.querySelectorAll("dialog .activity-photo-tile img").length===1);
      await page.getByRole("button",{name:"Remove activity photo",exact:true}).click();
      await page.getByRole("dialog").getByRole("img",{name:"Activity memory photo",exact:true}).waitFor({state:"detached"});
    }
    await page.getByRole("button",{name:"Close activity"}).click();
    await page.setViewportSize({width:1920,height:1080});
  }
  assert.deepEqual(errors, []);
  console.log("Calendar visual-flow browser tests passed: two entry choices, thumbnail search, selected cover, staged details, catalog-to-watchlist save, refresh, edit, actual outcomes, all views, slot selection, privacy, mobile dialog, working movie/TV/game actions, expanded history, photo upload/retry/reload/removal. Screenshots: .next/calendar-verification/");
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
