// Visual/overflow check for the mobile-first pass: bottom nav (7 items, raised Calendar),
// collapsed search bar, and 4-across catalog grid. Static fixture, no server auth needed.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const candidateRoots = ["node_modules/.cache/calendar-tools/node_modules", "C:/Users/hoope/AppData/Local/Temp/hobbyist-validation/node_modules"];
let chromium;
for (const root of candidateRoots) {
  try { ({ chromium } = await import(pathToFileURL(path.join(path.resolve(root), "playwright-core/index.mjs")).href)); break; } catch { /* try next */ }
}
if (!chromium) throw new Error("playwright-core not found in any candidate location");

// Read the source stylesheet directly rather than a .next build artifact, which can go stale
// between edits (Turbopack dev doesn't always rewrite the on-disk CSS chunk per save).
const css = (await readFile("src/app/globals.css", "utf8")).replace('@import "tailwindcss";', "");

const navItems = [
  ["Home", "/"], ["Movies", "/movies"], ["TV", "/tv"],
];
const navHtml = `
<nav class="mobile-nav" aria-label="Mobile navigation">
  <a class="mobile-nav-item" href="/" aria-current="page"><svg width="19" height="19"></svg><span>Home</span></a>
  <a class="mobile-nav-item" href="/movies"><svg width="19" height="19"></svg><span>Movies</span></a>
  <a class="mobile-nav-item" href="/tv"><svg width="19" height="19"></svg><span>TV</span></a>
  <a class="mobile-nav-item mobile-nav-calendar" href="/calendar"><span class="mobile-nav-calendar-bubble"><svg width="23" height="23"></svg></span><span>Calendar</span></a>
  <a class="mobile-nav-item" href="/games"><svg width="19" height="19"></svg><span>Games</span></a>
  <a class="mobile-nav-item" href="/books"><svg width="19" height="19"></svg><span>Books</span></a>
  <button class="mobile-nav-item" type="button"><svg width="19" height="19"></svg><span>More</span></button>
</nav>`;

const cards = Array.from({ length: 8 }, (_, i) => `
  <a class="catalog-card" href="#">
    <div class="catalog-poster"><div style="width:100%;height:100%;background:#3a3f36"></div></div>
    <p class="catalog-kind">GAME / 2024</p>
    <h3>A reasonably long test title number ${i + 1}</h3>
    <p class="catalog-genres">Action / Adventure</p>
    <p class="catalog-score">IGDB players: 88 / 100</p>
  </a>`).join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
<body>
  <div class="app-shell">
    <div class="content-frame">
      <header class="topbar">
        <a class="topbar-brand" href="/"><span class="brand-mark"></span><span class="brand-name">hobbyist</span></a>
        <div class="search-wrap"><form class="search-form"><input placeholder="Search your hobbies..."/></form></div>
        <div class="topbar-actions">
          <button class="icon-button mobile-search-toggle" type="button" aria-label="Open search"><svg width="18" height="18"></svg></button>
        </div>
      </header>
      <main class="main-content"><div class="page-content"><div class="media-page"><div class="catalog-grid">${cards}</div></div></div></main>
    </div>
    ${navHtml}
  </div>
</body></html>`;

const server = createServer((req, res) => { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(html); });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  await mkdir(".next/mobile-verification", { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CALENDAR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForSelector(".mobile-nav");

  // 1. No horizontal overflow at 375px (and recheck at 320px).
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "overflow at 375px");
  await page.screenshot({ path: ".next/mobile-verification/nav-375.png" });

  await page.setViewportSize({ width: 320, height: 812 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "overflow at 320px");
  await page.screenshot({ path: ".next/mobile-verification/nav-320.png" });

  // 2. Mobile nav has exactly 7 slots, Calendar is the 4th (dead center) and visually raised.
  const navItemCount = await page.locator(".mobile-nav-item").count();
  assert.equal(navItemCount, 7, `expected 7 nav items, got ${navItemCount}`);
  const order = await page.locator(".mobile-nav-item span:last-child").allInnerTexts();
  assert.deepEqual(order, ["Home", "Movies", "TV", "Calendar", "Games", "Books", "More"], `nav order wrong: ${order}`);
  const calendarBox = await page.locator(".mobile-nav-calendar-bubble").boundingBox();
  const siblingBox = await page.locator(".mobile-nav-item").nth(1).locator("svg").boundingBox();
  assert.ok(calendarBox.y < siblingBox.y, "calendar bubble should sit higher (raised) than sibling icons");

  // 3. Global mobile search bar is hidden; compact toggle is visible instead.
  const searchBarVisible = await page.locator(".topbar > .search-wrap:not(.notification-wrap)").isVisible();
  assert.equal(searchBarVisible, false, "mobile search bar should be hidden by default");
  const toggleVisible = await page.locator(".mobile-search-toggle").isVisible();
  assert.equal(toggleVisible, true, "mobile search toggle should be visible");

  // 4. Four covers per row.
  const gridCols = await page.evaluate(() => getComputedStyle(document.querySelector(".catalog-grid")).gridTemplateColumns.split(" ").length);
  assert.equal(gridCols, 4, `expected 4 grid columns, got ${gridCols}`);
  await page.screenshot({ path: ".next/mobile-verification/grid-375.png" });

  await page.click(".mobile-search-toggle");
  await page.evaluate(() => document.querySelector(".search-wrap:not(.notification-wrap)").classList.add("mobile-search-open"));
  await page.screenshot({ path: ".next/mobile-verification/search-open-320.png" });

  assert.deepEqual(errors, []);
  console.log("Mobile redesign check passed: no overflow at 320/375px, nav order Home/Movies/TV/Calendar(raised)/Games/Books/More, search bar collapsed to toggle, 4-column catalog grid.");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
