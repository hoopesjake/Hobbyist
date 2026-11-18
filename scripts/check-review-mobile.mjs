// Reproduce the actual title-detail + review area markup at mobile width to see exactly
// how it's laid out before trying to fix the "scrunched to one side" complaint.
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
const candidateRoots = ["node_modules/.cache/calendar-tools/node_modules", "C:/Users/hoope/AppData/Local/Temp/hobbyist-validation/node_modules"];
let chromium;
for (const root of candidateRoots) {
  try { ({ chromium } = await import(pathToFileURL(path.join(path.resolve(root), "playwright-core/index.mjs")).href)); break; } catch { /* try next */ }
}
if (!chromium) throw new Error("playwright-core not found");
const css = (await readFile("src/app/globals.css", "utf8")).replace('@import "tailwindcss";', "");
const swatch = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#30261f"/><text x="100" y="150" fill="#fff" text-anchor="middle" font-family="Georgia" font-size="18">Poster</text></svg>`)}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
<body><main class="main-content"><div class="page-content">
<div class="title-detail">
  <div class="detail-poster-column">
    <div class="detail-poster"><img src="${swatch}" style="width:100%;height:100%;object-fit:cover"/></div>
    <div class="show-tracking-panel show-tracking-collapsed">
      <button class="account-button review-trigger">Review</button>
      <p class="poster-saved-status">Currently Watching</p>
      <div class="personal-rating-stars centered"><span class="personal-rating-star"></span></div>
    </div>
    <button class="account-button add-to-list-trigger">Add to list</button>
  </div>
  <div>
    <p class="eyebrow">TV SHOW</p>
    <h2 class="detail-title">Loki</h2>
    <p class="title-meta">Action / Adventure / Sci-Fi</p>
  </div>
</div>
</div></main></body></html>`;
let browser;
try {
  await mkdir(".next/review-mobile-verification", { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CALENDAR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 700 } });
  await page.setContent(html);
  await page.screenshot({ path: ".next/review-mobile-verification/before.png" });
  const col = await page.locator(".detail-poster-column").boundingBox();
  const poster = await page.locator(".detail-poster").boundingBox();
  console.log("detail-poster-column box:", col);
  console.log("detail-poster box:", poster);
  console.log("viewport width: 375");
} finally { if (browser) await browser.close(); }
