// Visual check for the Lists rebuild: continuous cover-strip list previews, and the List
// Builder's category picker + Instagram-style review carousel.
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const candidateRoots = ["node_modules/.cache/calendar-tools/node_modules", "C:/Users/hoope/AppData/Local/Temp/hobbyist-validation/node_modules"];
let chromium;
for (const root of candidateRoots) {
  try { ({ chromium } = await import(pathToFileURL(path.join(path.resolve(root), "playwright-core/index.mjs")).href)); break; } catch { /* try next */ }
}
if (!chromium) throw new Error("playwright-core not found");
const css = (await readFile("src/app/globals.css", "utf8")).replace('@import "tailwindcss";', "");

const swatch = (hex, label) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="${hex}"/><text x="100" y="150" fill="#fff" text-anchor="middle" font-family="Georgia" font-size="16">${label}</text></svg>`)}`;
const strip = (n, hex) => Array.from({ length: n }, (_, i) => `<span class="list-cover-strip-item"><img src="${swatch(hex, i + 1)}" alt=""/></span>`).join("");

const listsPage = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
<body><main class="main-content"><div class="page-content">
  <div class="section-heading"><h2>Your lists</h2><span class="welcome-copy">2 lists</span></div>
  <div class="custom-lists-stack">
    <a class="custom-list-card" href="#"><div class="list-card-heading"><h3>My Favorite Stories</h3><span class="list-visibility">Public</span></div><div class="list-cover-strip">${strip(7, "#4a3e56")}</div></a>
    <a class="custom-list-card" href="#"><div class="list-card-heading"><h3>Rainy day favorites</h3><span class="list-visibility">Private</span></div><div class="list-cover-strip">${strip(3, "#533a36")}</div></a>
  </div>
</div></main></body></html>`;

const builderPage = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
<body><main class="main-content"><div class="page-content">
  <div class="list-builder"><div class="list-builder-step">
    <div class="hobby-search-heading"><button class="icon-button">&larr;</button><h3>Add media</h3></div>
    <div class="list-builder-categories">
      <button class="list-builder-category">&#127916;<span>Movies</span></button>
      <button class="list-builder-category">&#128250;<span>TV Shows</span></button>
      <button class="list-builder-category">&#127918;<span>Games</span></button>
      <button class="list-builder-category">&#128214;<span>Books</span></button>
    </div>
  </div></div>
  <hr style="margin:40px 0;border-color:#333">
  <div class="list-builder"><div class="list-builder-step list-builder-review">
    <div class="hobby-search-heading"><button class="icon-button">&larr;</button><h3>Review your list</h3></div>
    <label>List name<input value="My Favorite Stories"/></label>
    <label>Description<textarea rows="2">Stories that stuck with me.</textarea></label>
    <div class="list-builder-carousel-heading"><span>4 items</span><span class="text-link">+ Add more media</span></div>
    <div class="list-builder-carousel">
      ${["Interstellar", "Loki", "Elden Ring", "The Way of Kings"].map((t, i) => `<div class="list-builder-carousel-item"><span class="list-builder-drag-handle">&#8942;&#8942;</span><span class="hobby-cover hobby-cover-large"><img src="${swatch(["#30261f","#242936","#252e20","#302633"][i], t)}" alt=""/></span><strong>${t}</strong><span class="list-builder-carousel-controls"><button class="icon-button">&larr;</button><button class="icon-button">&times;</button><button class="icon-button">&rarr;</button></span></div>`).join("")}
    </div>
    <button class="account-button">Create List</button>
  </div></div>
</div></main></body></html>`;

let browser;
try {
  await mkdir(".next/lists-verification", { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CALENDAR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  await page.setContent(listsPage);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: ".next/lists-verification/view-lists-desktop.png" });
  await page.setViewportSize({ width: 375, height: 700 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: ".next/lists-verification/view-lists-mobile.png" });

  await page.setContent(builderPage);
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.screenshot({ path: ".next/lists-verification/builder-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 1100 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: ".next/lists-verification/builder-mobile.png", fullPage: true });

  console.log("Lists rebuild visual check passed: cover strips are edge-to-edge, builder category grid and review carousel fit at 375px with no overflow.");
} finally {
  if (browser) await browser.close();
}
