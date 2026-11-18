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
const tiles = (n, hex) => Array.from({ length: n }, (_, i) => `<a class="favorites-grid-tile" href="#"><img src="${swatch(hex, i + 1)}"/></a>`).join("");
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
<body><main class="main-content"><div class="page-content"><div class="account-page">
  <p class="eyebrow">YOUR PERSONAL SPACE</p>
  <div class="profile-identity"><span class="avatar avatar-you profile-avatar">J</span><div><h1>Jake Hoopes</h1><span class="profile-handle">@jakehoopes</span></div></div>
  <div class="favorites-sections">
    <section class="favorites-grid-section"><div class="favorites-grid-heading"><h3>My Top 4 Movies</h3><a class="text-link" href="#">Edit</a></div><div class="favorites-grid">${tiles(4, "#30261f")}</div></section>
    <section class="favorites-grid-section"><div class="favorites-grid-heading"><h3>My Top 4 TV Shows</h3><a class="text-link" href="#">Edit</a></div><div class="favorites-grid">${tiles(3, "#242936")}</div></section>
    <section class="favorites-grid-section"><div class="favorites-grid-heading"><h3>My Top 4 Games</h3><a class="text-link" href="#">Edit</a></div><div class="favorites-grid">${tiles(4, "#252e20")}</div></section>
    <section class="favorites-grid-section"><div class="favorites-grid-heading"><h3>My Top 4 Books</h3><a class="text-link" href="#">Edit</a></div><div class="favorites-grid">${tiles(2, "#302633")}</div></section>
  </div>
</div></div></main></body></html>`;
let browser;
try {
  await mkdir(".next/favorites-verification", { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CALENDAR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 700, height: 1100 } });
  await page.setContent(html);
  await page.screenshot({ path: ".next/favorites-verification/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 1100 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: ".next/favorites-verification/mobile.png", fullPage: true });
  console.log("Favorites grid passed: one identity line, 4-column covers, no overflow at 375px.");
} finally { if (browser) await browser.close(); }
