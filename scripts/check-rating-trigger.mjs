// Static reproduction of RatingStars' exact markup (outline + fill overlay per star) so we
// can verify size/centering without needing a bundler in this sandbox.
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
const swatch = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#30261f"/><text x="100" y="150" fill="#fff" text-anchor="middle" font-family="Georgia" font-size="16">Poster</text></svg>`)}`;
const star = (fillPct) => `<span class="personal-rating-star"><svg class="personal-star-outline" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg><span class="personal-star-fill" style="width:${fillPct}%"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg></span></span>`;
const ratingStars = `<span class="personal-rating-stars centered">${[100,100,100,50,0].map(star).join("")}</span>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
<body><main class="main-content"><div class="page-content"><div class="title-detail">
  <div class="detail-poster-column"><div class="detail-poster"><img src="${swatch}" style="width:100%;height:100%;object-fit:cover"/></div>
    <div class="rating-edit-trigger">${ratingStars}<button class="icon-button rating-edit-pencil">&#9998;</button></div>
  </div>
  <div><h2 class="detail-title">Interstellar</h2></div>
</div></div></main></body></html>`;
let browser;
try {
  await mkdir(".next/rating-trigger-verification", { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CALENDAR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 500 } });
  await page.setContent(html);
  const starBox = await page.locator(".personal-rating-star").first().boundingBox();
  console.log("star size:", starBox.width, starBox.height);
  assert.ok(starBox.width >= 22, "stars should be noticeably bigger");
  const trigger = await page.locator(".rating-edit-trigger").boundingBox();
  const poster = await page.locator(".detail-poster").boundingBox();
  assert.ok(Math.abs((trigger.x + trigger.width / 2) - (poster.x + poster.width / 2)) < 20, "trigger not centered under cover");
  await page.screenshot({ path: ".next/rating-trigger-verification/375.png" });
  console.log("Rating + pencil trigger is bigger and centered under the cover.");
} finally { if (browser) await browser.close(); }
