// Actual Home shelf and Calendar preview components, isolated visual fixtures.
import { createServer } from "node:http";
import { readFile,readdir,mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root=path.resolve("node_modules/.cache/calendar-tools/node_modules");
const {build}=await import(pathToFileURL(path.join(root,"esbuild/lib/main.js")).href);
const {chromium}=await import(pathToFileURL(path.join(root,"playwright-core/index.mjs")).href);
const aliases={
 "next/link":"import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}",
 "next/image":"import React from 'react';export default function Image({unoptimized,...props}){return <img {...props}/>}",
 "@/lib/books":"export async function getBookLibrary(){return {entries:[],error:null}}",
 "@/components/media/personal-library":"export function PersonalLibrary(){return null}",
 "@/components/games/game-library":"export function GameLibrary(){return null}",
};
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {HomeShelf} from '@/components/dashboard/library-overview';import {CalendarPreviewView} from '@/components/calendar/calendar-preview-view';import {BookCard} from '@/components/books/book-card';
const today='2026-11-17';const plan=(id,date,title)=>({id,kind:'plan',status:'planned',title,category:'movies',event_date:date,start_time:'19:00',end_time:'21:00',media_image:null});
const types=['Books','Movies','TV shows','Games'];function App(){return <main className='dashboard page-content' style={{maxWidth:1250,margin:'0 auto',padding:'28px 20px'}}><header className='welcome-row'><div><p className='eyebrow'>YOUR PERSONAL SPACE</p><h1>Welcome back, Jake.</h1><p className='welcome-copy'>A little time for the things you love.</p></div></header><CalendarPreviewView today={today} todayEntries={[plan('today',today,'Movie night')]} plans={[plan('future','2026-11-19','Reading with friends')]} memories={[]} error={null}/><section className='dashboard-section'><div className='section-heading'><div><p className='eyebrow'>ALL THE THINGS YOU LOVE</p><h2>Your libraries</h2></div></div><div className='home-library-grid'>{types.map((type,index)=><HomeShelf key={type} title={type} href={'/'+type.toLowerCase().split(' ')[0]+'/library'}><div className='catalog-grid'>{Array.from({length:5},(_,i)=><BookCard key={i} book={{id:i+1,work_key:'/works/OL1W',title:['Red Rising','The Way of Kings','A quiet adventure','The next chapter','Something wonderful'][i],authors:['In your library'],cover_url:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="'+['#533a36','#344c49','#384c39','#4a3e56'][index]+'"/><text x="100" y="150" fill="#ead9c5" text-anchor="middle" font-family="Georgia" font-size="22">'+type+'</text></svg>')}} rating={4.5}/>)}</div></HomeShelf>)}</div></section></main>}createRoot(document.getElementById('root')).render(<App/>);`;
const result=await build({stdin:{contents:entry,loader:"tsx",resolveDir:process.cwd()},bundle:true,write:false,format:"iife",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"'},alias:{"@":path.resolve("src")},plugins:[{name:"home-fixture",setup(plugin){plugin.onResolve({filter:/.*/},args=>args.path in aliases?{path:args.path,namespace:"fixture"}:undefined);plugin.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:aliases[args.path],loader:"tsx",resolveDir:process.cwd()}));}}]});
const css=(await Promise.all((await readdir('.next/static',{recursive:true})).filter(f=>f.endsWith('.css')).map(f=>readFile(path.join('.next/static',f),'utf8')))).join('\n');
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(result.outputFiles[0].text);}else if(req.url==='/app.css'){res.setHeader('Content-Type','text/css');res.end(css);}else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
 await mkdir('.next/home-verification',{recursive:true});browser=await chromium.launch({executablePath:process.env.CALENDAR_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 await page.getByRole('heading',{name:'Your libraries',exact:true}).waitFor();assert.equal(await page.locator('.home-library-shelf').count(),4);
 const todayColumn=page.locator('.calendar-preview-grid > section').first(),upcoming=page.locator('.calendar-preview-grid > section').nth(1);
 assert.ok((await todayColumn.innerText()).includes('Movie night'));assert.ok(!(await todayColumn.innerText()).includes('Reading with friends'));assert.ok((await upcoming.innerText()).includes('Reading with friends'));assert.ok((await upcoming.innerText()).includes('Nov 19'));
 assert.ok((await todayColumn.getByRole('link',{name:/Movie night/}).getAttribute('href')).includes('entry=today'));
 assert.equal(await page.locator('.home-library-shelf .catalog-card').count(),20);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.next/home-verification/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.next/home-verification/mobile.png',fullPage:true});assert.deepEqual(errors,[]);console.log('Home desktop/mobile: four compact libraries, distinct Today/Upcoming events, event links and no overflow passed.');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
