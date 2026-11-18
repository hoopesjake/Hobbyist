import test from "node:test";
import assert from "node:assert/strict";
import {parseBookTracking,parseReadingPages} from "../src/lib/book-validation.ts";
import {createOpenLibraryTransport,openLibraryWorkId,bookCover} from "../src/lib/open-library-transport.ts";
import {rankBookTitles,bookSearchQuery,isBookSearchResult,bookGenres,isBookGenre} from "../src/lib/book-search.ts";
test('search matches literal titles/authors and filters noisy derivatives without removing series books',()=>{
 assert.match(bookSearchQuery('Pierce Brown'),/title:.*OR author:/);
 assert.ok(!bookSearchQuery('red OR *:*').includes('*:* OR'));
 assert.equal(isBookSearchResult({title:'Red Rising (Red Rising Saga, Book 1)',author_name:['Pierce Brown']},'red rising'),true);
 assert.equal(isBookSearchResult({title:'Study Guide: Red Rising',author_name:['Study Guides']},'red rising'),false);
 assert.equal(isBookSearchResult({title:'Study Guide: Red Rising',author_name:['Study Guides']},'study guide red rising'),true);
 assert.equal(isBookSearchResult({title:'x'.repeat(181),author_name:['Author']},'book'),false);
 const books=[{title:'Biography of Pierce Brown',author_name:['Someone Else'],readinglog_count:1000},{title:'Red Rising',author_name:['Pierce Brown'],readinglog_count:10}];
 assert.equal(rankBookTitles(books,'Pierce Brown')[0].title,'Red Rising');
});
test('genre filtering only ever appends our own fixed subject slugs, never arbitrary text',()=>{
 assert.match(bookSearchQuery('dune','science_fiction'),/subject_key:"science_fiction"/);
 assert.ok(!bookSearchQuery('dune').includes('subject_key'));
 assert.ok(!bookSearchQuery('dune','"); DROP TABLE').includes('DROP TABLE'));
 assert.ok(isBookGenre('fantasy'));
 assert.ok(!isBookGenre('made_up_genre'));
 assert.equal(bookGenres.length,9);
});
test('transport shares duplicate requests, caches successes and retries transient network failures',async()=>{
 let calls=0,time=1000;
 const transport=createOpenLibraryTransport(()=>"reader@example.test",async()=>{calls++;if(calls===1)throw new DOMException('Timed out','TimeoutError');return Response.json({docs:[{title:'Red Rising'}]});},{now:()=>time,wait:async ms=>{time+=ms;}});
 const [a,b]=await Promise.all([transport.request('/search.json?q=red'),transport.request('/search.json?q=red')]);
 assert.deepEqual(a,b);assert.equal(calls,2);await transport.request('/search.json?q=red');assert.equal(calls,2);
});
test('slow responses do not block unrelated catalog requests and starts remain paced',async()=>{
 let releaseFirst,announceSecond,active=0,maxActive=0;
 const starts=[];const secondStarted=new Promise(resolve=>{announceSecond=resolve;});
 const transport=createOpenLibraryTransport(()=>"reader@example.test",async url=>{
  starts.push(Date.now());active++;maxActive=Math.max(maxActive,active);
  if(url.endsWith('/first'))await new Promise(resolve=>{releaseFirst=resolve;});
  if(url.endsWith('/second'))announceSecond();
  active--;return Response.json({ok:true});
 });
 const first=transport.request('/first'),second=transport.request('/second'),third=transport.request('/third');
 await secondStarted;releaseFirst();await Promise.all([first,second,third]);
 assert.equal(starts.length,3);assert.ok(starts[1]-starts[0]>=350);assert.ok(starts[2]-starts[1]>=350);assert.equal(maxActive,2);
});
test('transport serves recent stale metadata on failure and respects long Retry-After without retry storms',async()=>{
 let time=1000,calls=0,fail=false;
 const transport=createOpenLibraryTransport(()=>"reader@example.test",async()=>{calls++;return fail?new Response('Busy',{status:429,headers:{'Retry-After':'120'}}):Response.json({title:'Saved catalog result'});},{now:()=>time,wait:async ms=>{time+=ms;}});
 await transport.request('/works/OL1W.json');time+=300001;fail=true;
 assert.equal((await transport.request('/works/OL1W.json')).title,'Saved catalog result');assert.equal(calls,2);
 await assert.rejects(()=>transport.request('/works/OL2W.json'),/busy/);assert.equal(calls,2);
});
import {bookReturnTo} from "../src/lib/book-navigation.ts";
import {bookStatistics,bookGenreRanking} from "../src/lib/book-statistics.ts";
const tracked=(id,values={})=>({ol_work_id:id,title:`Book ${id}`,authors:['Author'],edition_id:'OL1M',effective_status:'reading',current_page:0,total_pages:200,manual_current_page:0,effective_finished_on:null,rating:null,...values});
const session=(id,values={})=>({id,kind:'actual',event_date:'2026-11-01',provider_id:1,reading_edition_id:'OL1M',reading_start_page:null,reading_end_page:null,duration_minutes:30,...values});
test('reading statistics merge overlapping pages, manual progress and finished books without double counting',()=>{
 const books=[tracked(1,{manual_current_page:50}),tracked(2,{effective_status:'finished',effective_finished_on:'2026-11-02',rating:4.5})];
 const sessions=[session('a',{reading_start_page:40,reading_end_page:80}),session('b',{reading_start_page:70,reading_end_page:100}),session('b',{reading_start_page:70,reading_end_page:100}),session('c',{reading_edition_id:'OL2M',reading_start_page:1,reading_end_page:10,duration_minutes:null}),session('plan',{kind:'plan',duration_minutes:999}),session('future',{event_date:'2026-12-01',duration_minutes:999})];
 const stats=bookStatistics(books,sessions,'2026-11-17');
 assert.equal(stats.pages,310);assert.equal(stats.loggedPages,71);assert.equal(stats.minutes,60);assert.equal(stats.sessions,3);assert.equal(stats.timedSessions,2);assert.equal(stats.average,4.5);
 assert.equal(stats.finishedYear,1);assert.equal(stats.finishedMonth,1);assert.equal(stats.months.at(-1).count,1);
});
test('completion periods require real finish dates and personal ratings stay separate from session ratings',()=>{
 const books=[tracked(1,{effective_status:'finished',effective_finished_on:'2026-01-01'}),tracked(2,{effective_status:'finished',effective_finished_on:'2025-12-31'}),tracked(3,{effective_status:'finished'}),tracked(4,{effective_status:'want_to_read',rating:3}),tracked(5,{effective_status:'finished',effective_finished_on:'2026-12-01'})];
 const stats=bookStatistics(books,[],'2026-11-17');assert.equal(stats.finishedYear,1);assert.equal(stats.finishedMonth,0);assert.equal(stats.undated,1);assert.deepEqual(stats.years,[['2026',1],['2025',1]]);assert.equal(stats.average,3);assert.equal(stats.months.length,12);
 assert.equal(bookStatistics([],[],'2026-01-01').minutes,0);assert.equal(bookStatistics([],[],'2026-01-01').average,null);
});
test('genre rankings use real subject labels and count each genre once per book',()=>{
 const ranking=bookGenreRanking([{id:1,subjects:['Fantasy fiction','Epic fantasy','Magic']},{id:2,subjects:['Science fiction','Fantasy']},{id:2,subjects:['Science fiction','Fantasy']},{id:3,subjects:['Unknown metadata']}]);
 assert.deepEqual(ranking,[{name:'Fantasy',count:2},{name:'Science fiction',count:1}]);
});
test("book back links retain search and pagination but reject external destinations",()=>{
 assert.equal(bookReturnTo('/books?q=red+rising&page=2'),'/books?q=red+rising&page=2');
 assert.equal(bookReturnTo('/books/library?status=finished&page=3'),'/books/library?status=finished&page=3');
 for(const value of ['https://evil.test/books?q=red','//evil.test/books','/movies',null])assert.equal(bookReturnTo(value),'/books');
});
test("exact titles outrank popular unrelated books and study guides",()=>{
 const books=[{title:"Bible",readinglog_count:100000},{title:"Study Guide: Red Rising",readinglog_count:1000},{title:"Red Rising",readinglog_count:10},{title:"Red Rising: Deluxe edition",readinglog_count:500}];
 assert.deepEqual(rankBookTitles(books,"red rising").map(book=>book.title),["Red Rising","Red Rising: Deluxe edition","Study Guide: Red Rising","Bible"]);
 assert.equal(books[0].title,"Bible");
 assert.equal(rankBookTitles([{title:"Dune",readinglog_count:1},{title:"Dune",readinglog_count:100}],"DUNE")[0].readinglog_count,100);
});
const form=values=>{const f=new FormData();for(const [key,value] of Object.entries(values))f.set(key,value);return f;};
test("Open Library identifiers and covers cannot become arbitrary URLs",()=>{
 assert.equal(openLibraryWorkId("/works/OL15358691W"),15358691);assert.equal(openLibraryWorkId("OL15358691W"),15358691);
 for(const value of ["OL1M","../OL1W","OL0W","OL2147483648W","https://evil.test/OL1W"])assert.equal(openLibraryWorkId(value),null);
 assert.equal(bookCover(-1),null);assert.ok(bookCover(1).startsWith("https://covers.openlibrary.org/"));
});
test("public requests identify Hobbyist using actual configured contact, with no API key",async()=>{
 let request;const transport=createOpenLibraryTransport(()=>"reader@example.test",async(url,options)=>{request={url,options};return Response.json({docs:[]});});
 await transport.request("/search.json?q=books");assert.equal(request.options.headers["User-Agent"],"Hobbyist/1.0 (reader@example.test)");assert.equal(request.options.headers.email,"reader@example.test");assert.equal(request.options.headers.Authorization,undefined);assert.ok(request.options.signal);
 await assert.rejects(()=>createOpenLibraryTransport(()=>undefined).request("/search.json"),/CONTACT_EMAIL/);
});
test("tracking validates statuses, half-stars, edition identity and manual page positions",()=>{
 assert.equal(parseBookTracking(form({status:"reading",current_page:"50",total_pages:"100",rating:"4.5"})).fields.rating,4.5);
 for(const values of [{status:"bad"},{status:"reading",rating:"4.3"},{status:"reading",current_page:"101",total_pages:"100"},{status:"reading",edition_id:"OL1W"}])assert.ok(parseBookTracking(form(values)).error);
});
test("reading ranges are inclusive, optional and never inferred from duration",()=>{
 assert.deepEqual(parseReadingPages(form({duration_minutes:"60"}),true,true),{reading_start_page:null,reading_end_page:null});
 assert.equal(parseReadingPages(form({reading_start_page:"1",reading_end_page:"50"}),true,true).reading_end_page,50);
 assert.ok(parseReadingPages(form({reading_start_page:"50",reading_end_page:"1"}),true,true).error);
 assert.ok(parseReadingPages(form({reading_start_page:"1",reading_end_page:"50"}),false,true).error);
});

test("reading dates drive status and reject impossible/reversed dates",()=>{
 assert.equal(parseBookTracking(form({status:"want_to_read",started_on:"2020-01-01"})).fields.status,"reading");
 assert.equal(parseBookTracking(form({status:"reading",started_on:"2020-01-01",finished_on:"2020-02-01"})).fields.status,"finished");
 for(const values of [{status:"reading",started_on:"2020-02-30"},{status:"reading",started_on:"2020-02-01",finished_on:"2020-01-01"}])assert.ok(parseBookTracking(form(values)).error);
});
