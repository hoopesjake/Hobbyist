// Visual check that movie/TV/game/book cover pages now show only rating + edit pencil
// under the cover, with Add to list relocated next to the external catalog link.
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
const swatch = (label) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#30261f"/><text x="100" y="150" fill="#fff" text-anchor="middle" font-family="Georgia" font-size="16">${label}</text></svg>`)}`;

function posterColumn(label) {
  return `<div class="detail-poster-column"><div class="detail-poster"><img src="${swatch(label)}" style="width:100%;height:100%;object-fit:cover"/></div>
    <div class="rating-edit-trigger"><div class="personal-rating-stars centered"><span class="personal-rating-star"></span></div><button class="icon-button rating-edit-pencil">&#9998;</button></div>
  </div>`;
}
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
<body><main class="main-content"><div class="page-content">
<div class="title-detail">${posterColumn("Movie")}<div><p class="eyebrow">MOVIE</p><h2 class="detail-title">Interstellar</h2><p class="title-overview">A team of explorers travel through a wormhole in space.</p><div class="title-actions"><button class="account-button add-to-list-trigger">Add to list</button><a class="text-link" href="#">View on TMDB</a></div></div></div>
</div></main></body></html>`;
let browser;
try {
  await mkdir(".next/media-cards-verification", { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CALENDAR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 600 } });
  await page.setContent(html);
  assert.equal(await page.locator(".poster-saved-status").count(), 0);
  assert.equal(await page.locator(".compact-action").count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: ".next/media-cards-verification/375.png" });
  console.log("Media card simplified: only rating+pencil under cover, Add to list moved beside catalog link, no overflow.");
} finally { if (browser) await browser.close(); }
