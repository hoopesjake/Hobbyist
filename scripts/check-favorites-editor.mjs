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
const tile = (hex, label) => `<div class="favorites-editor-tile"><span class="hobby-cover"><img src="${swatch(hex, label)}"/></span><button class="icon-button">&times;</button><div class="favorites-editor-order"><button class="icon-button">&larr;</button><button class="icon-button">&rarr;</button></div></div>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
<body><main class="main-content"><div class="page-content"><div class="account-page"><div class="favorites-editor">
  <div class="hobby-search-heading"><button class="icon-button">&larr;</button><h3>Top 4 movies</h3></div>
  <div class="favorites-editor-selected">${tile("#30261f","1")}${tile("#30261f","2")}${tile("#30261f","3")}${tile("#30261f","4")}</div>
  <div class="hobby-search-input">&#128269;<input placeholder="Search movies..."/></div>
  <div class="list-builder-actions"><button class="account-button">Save favorites</button><button class="calendar-secondary">Cancel</button></div>
</div></div></div></main></body></html>`;
let browser;
try {
  await mkdir(".next/favorites-editor-verification", { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CALENDAR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 320, height: 500 } });
  await page.setContent(html);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: ".next/favorites-editor-verification/320.png" });
  console.log("Favorites editor fits at 320px with no overflow.");
} finally { if (browser) await browser.close(); }
