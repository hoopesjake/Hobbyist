// Signed-out browser acceptance checks against a running production server.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
const load=createRequire(import.meta.url);
if(!process.env.HOBBYIST_BROWSER_TEST_MODULE)throw new Error("Set HOBBYIST_BROWSER_TEST_MODULE to playwright-core's temporary package path.");
const {chromium}=load(process.env.HOBBYIST_BROWSER_TEST_MODULE);
const base=process.env.HOBBYIST_TEST_URL||"http://localhost:3101";
const browser=await chromium.launch({channel:"msedge",headless:true});
try{
  for(const width of [1440,2560,390]){
    const context=await browser.newContext({viewport:{width,height:1000}});
    const page=await context.newPage();page.setDefaultTimeout(15000);
    const errors=[];page.on("pageerror",error=>errors.push(error.message));
    await page.goto(base+"/movies/discover?q=Arrival");
    await page.getByRole("heading",{name:"Arrival",exact:true}).first().waitFor();
    const movieLinks=await page.locator(".catalog-card").evaluateAll(elements=>elements.map(element=>element.getAttribute("href")));
    assert.ok(movieLinks.length&&movieLinks.every(href=>href.startsWith("/movies/")));
    const main=await page.locator(".main-content").boundingBox();
    const frame=await page.locator(".content-frame").boundingBox();
    assert.ok(main.width<=1280.5);assert.ok(Math.abs(main.x+main.width/2-frame.x-frame.width/2)<2);
    await page.getByRole("heading",{name:"Arrival",exact:true}).first().click();
    await page.getByRole("button",{name:"Review",exact:true}).click();
    let dialog=page.getByRole("dialog");await dialog.waitFor();
    let rect=await dialog.boundingBox();assert.ok(Math.abs(rect.x+rect.width/2-width/2)<2);
    await dialog.getByText("Watchlist & watched date",{exact:true}).click();
    assert.equal(await dialog.getByLabel("Show started",{exact:true}).count(),0);
    assert.equal(await dialog.getByRole("combobox").count(),0);
    await dialog.getByLabel("Watched",{exact:true}).check();
    await dialog.getByLabel("Date watched",{exact:true}).fill("2026-11-15");
    await dialog.getByLabel("Review text",{exact:true}).fill("An optional movie review.");
    await dialog.getByLabel("Contains spoilers",{exact:true}).check();
    const stars=dialog.locator(".rating-star").nth(3);await stars.click({position:{x:26,y:17}});await stars.press("ArrowLeft");
    assert.equal(await dialog.locator("[name=rating]").inputValue(),"3.5");
    await page.keyboard.press("Escape");
    assert.equal(await dialog.isVisible(),false);
    await page.goto(base+"/tv/1396?season=1");
    await page.getByRole("heading",{name:"Breaking Bad",exact:true}).waitFor();
    await page.getByRole("navigation",{name:"Select season"}).waitFor();
    await page.locator(".episode-row").first().getByRole("heading",{name:"1. Pilot",exact:true}).waitFor();
    await page.getByRole("button",{name:"Review",exact:true}).click();dialog=page.getByRole("dialog");
    await dialog.getByText("Show status & dates",{exact:true}).click();
    await dialog.getByRole("combobox",{name:"Show status",exact:true}).selectOption("watching");
    await dialog.getByLabel("Show started",{exact:true}).fill("2026-01-05");
    await dialog.getByLabel("Show completed",{exact:true}).fill("2026-02-12");
    await dialog.getByRole("button",{name:"5 stars",exact:true}).click();
    await page.keyboard.press("Escape");
    await page.locator(".episode-row").first().getByRole("button",{name:"Review episode",exact:true}).click();dialog=page.getByRole("dialog");
    await dialog.getByRole("button",{name:"4 stars",exact:true}).click();
    assert.equal(await dialog.locator("[name=rating]").inputValue(),"4");
    await dialog.getByLabel("Review text",{exact:true}).fill("An optional episode review.");
    await dialog.getByLabel("Contains spoilers",{exact:true}).check();
    await dialog.getByText("Watched status & date",{exact:true}).click();
    await dialog.getByLabel("Watched",{exact:true}).check();await dialog.getByLabel("Date watched",{exact:true}).fill("2026-11-15");
    assert.equal(await dialog.getByLabel("Show started",{exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:join(tmpdir(),`hobbyist-separate-${width}.png`)});
    await page.keyboard.press("Escape");
    await page.getByRole("navigation",{name:"Select season"}).getByRole("link",{name:/Specials/}).click();
    await page.waitForURL(url=>url.searchParams.get("season")==="0");
    await page.locator(".season-picker a[aria-current=page]").filter({hasText:"Specials"}).waitFor();
    await page.locator(".episode-row").first().waitFor();
    await page.locator(".episode-row").first().locator("h4").click();
    await page.waitForURL("**/season/0/episode/*");
    await page.getByText("TMDB episode score:",{exact:false}).waitFor();
    await page.getByRole("button",{name:"Notifications",exact:true}).click();
    const panel=await page.locator("#notification-panel").boundingBox();const bell=await page.getByRole("button",{name:"Notifications",exact:true}).boundingBox();
    assert.ok(panel.x>=0&&panel.x+panel.width<=width);assert.ok(Math.abs(panel.x+panel.width-bell.x-bell.width)<2);
    await page.getByRole("button",{name:"Notifications",exact:true}).click();
    await page.getByRole("searchbox",{name:"Search Hobbyist",exact:true}).fill("Arrival");
    await page.getByRole("link",{name:"Search TV Shows Live catalog",exact:true}).waitFor();
    const search=await page.locator("#search-results").boundingBox();assert.ok(search.x>=0&&search.x+search.width<=width);
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px: movie/show/episode controls, half stars, dates/reviews/spoilers, specials, centered content/dialogs, anchored popovers, no overflow/errors`);
    await context.close();
  }
  const page=await browser.newPage();page.setDefaultTimeout(15000);
  for(const filter of ["movie","tv"]){
    await page.goto(`${base}/actors/287?filter=${filter}`);
    await page.getByRole("heading",{name:"Filmography",exact:true}).waitFor();
    const links=await page.locator(".catalog-card").evaluateAll(elements=>elements.map(element=>element.getAttribute("href")));
    assert.ok(links.length&&links.every(href=>href.startsWith(filter==="movie"?"/movies/":"/tv/")));
  }
  for(const [old,next] of [["/movies-tv/movie/550","/movies/550"],["/movies-tv/tv/1396","/tv/1396"],["/movies-tv/actors/287","/actors/287"]]){await page.goto(base+old);await page.waitForURL(base+next);}
  for(const path of ["/movies/library","/tv/library","/movies/statistics","/tv/statistics"]){await page.goto(base+path);await page.waitForURL("**/auth/sign-in");}
  console.log("PASS actor filmography type filters, legacy detail redirects, and private libraries/statistics");
}finally{await browser.close();}
