// Read-only signed-out browser acceptance against a running production build.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
const load=createRequire(import.meta.url);
if(!process.env.HOBBYIST_BROWSER_TEST_MODULE)throw Error("Set HOBBYIST_BROWSER_TEST_MODULE to playwright-core's module path.");
const {chromium}=load(process.env.HOBBYIST_BROWSER_TEST_MODULE);
const base=process.env.HOBBYIST_TEST_URL||"http://localhost:3104";
const browser=await chromium.launch({channel:"msedge",headless:true});
try{
 for(const width of [390,1440,2560]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.setDefaultTimeout(45000);const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(base+"/games");await page.locator(".game-card").first().waitFor();assert.equal(await page.locator(".game-card").count(),5);assert.equal(await page.locator(".catalog-skeleton").count(),0);
  await page.locator("#game-search").fill("Stardew Valley");await page.getByRole("button",{name:"Search",exact:true}).click();await page.getByRole("heading",{name:"Stardew Valley",exact:true}).first().waitFor();
  assert.ok(await page.locator("#game-genre option").count()>10);assert.ok(await page.locator("#game-platform option").count()>100);
  await page.getByRole("heading",{name:"Stardew Valley",exact:true}).first().click();await page.getByRole("heading",{name:"Stardew Valley",exact:true}).waitFor();
  await page.getByRole("link",{name:"Sign in to track this game",exact:true}).waitFor();assert.ok(await page.locator(".game-screenshots img").count()>0);assert.ok(await page.locator(".game-detail-facts").textContent());
  assert.ok((await page.locator(".catalog-score").first().textContent()).includes("IGDB player score"));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const arrow=await page.locator(".back-link-arrow").boundingBox(),back=await page.locator(".back-link").first().boundingBox();assert.ok(Math.abs(arrow.y+arrow.height/2-back.y-back.height/2)<1);
  await page.screenshot({path:join(tmpdir(),`hobbyist-games-${width}.png`),fullPage:false});
  await page.goto(base+"/games/library?filter=wishlist");await page.waitForURL("**/auth/sign-in");
  assert.deepEqual(errors,[]);console.log(`PASS ${width}px: live Games dashboard/search/detail/artwork metadata, facets, protected library, centered Back arrow, no overflow/browser errors`);await context.close();
 }
}finally{await browser.close();}
