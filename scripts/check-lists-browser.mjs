// Signed-out UI checks. List database writes/visibility are covered by action and SQL tests.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
const load = createRequire(import.meta.url);
if (!process.env.HOBBYIST_BROWSER_TEST_MODULE) throw new Error("Set HOBBYIST_BROWSER_TEST_MODULE to playwright-core's module path.");
const { chromium } = load(process.env.HOBBYIST_BROWSER_TEST_MODULE);
const base = process.env.HOBBYIST_TEST_URL || "http://localhost:3104";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const width of [390, 1440, 2560]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}/movies`);
    await page.locator(".catalog-card").first().waitFor();
    assert.equal(await page.locator(".catalog-card").count(), 5);
    assert.equal(await page.locator(".catalog-skeleton").count(), 0);
    await page.getByRole("button", { name: "My Lists", exact: true }).click();
    const menu = page.getByRole("navigation", { name: "My lists", exact: true });
    await menu.waitFor();
    assert.equal(await menu.getByRole("link", { name: "View lists", exact: true }).count(), 1);
    assert.equal(await menu.getByRole("link", { name: "Create new list", exact: true }).count(), 1);
    const bounds = await menu.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    await page.screenshot({ path: join(tmpdir(), `hobbyist-lists-menu-${width}.png`), fullPage: false });
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("button", { name: "My Lists", exact: true }).getAttribute("aria-expanded"), "false");
    await page.goto(`${base}/actors/287`);
    await page.locator(".catalog-card").first().waitFor();
    const scores = await page.locator(".catalog-card .catalog-score").allTextContents();
    let previous = Infinity;
    let unrated = false;
    for (const text of scores) {
      const score = text.match(/TMDB (\d+(?:\.\d+)?) \/ 10/);
      if (!score) { unrated = true; continue; }
      assert.equal(unrated, false, "Rated work appeared below unrated work");
      assert.ok(Number(score[1]) <= previous, `Portfolio is not descending: ${text}`);
      previous = Number(score[1]);
    }
    const arrow = await page.locator(".back-link-arrow").boundingBox();
    const back = await page.locator(".back-link").first().boundingBox();
    assert.ok(Math.abs(arrow.y + arrow.height / 2 - (back.y + back.height / 2)) < 1);
    assert.equal(await page.locator('[aria-label="Actors navigation"] a[aria-current="page"]').textContent(), "Discover");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.goto(`${base}/tv`);
    await page.locator(".catalog-card").first().waitFor();
    assert.equal(await page.locator(".catalog-card").count(), 5);
    await page.getByRole("button", { name: "My Lists", exact: true }).click();
    await page.getByRole("link", { name: "Create new list", exact: true }).click();
    await page.waitForURL("**/auth/sign-in");
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: My Lists menu, protected creation, ranked portfolios, active tabs, centered Back arrow, five-card previews, no overflow/errors`);
    await context.close();
  }
} finally { await browser.close(); }
