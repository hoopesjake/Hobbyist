// Visual check that the 4-category hobby picker (Movies/TV/Games/Books) stays on one row
// at narrow mobile widths instead of wrapping to two rows.
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
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
<body><main class="main-content"><div class="page-content"><form class="calendar-form">
  <fieldset class="hobby-type-picker">
    <button type="button"><span class="hobby-type-label">&#127916;<span>Movies</span></span></button>
    <button type="button"><span class="hobby-type-label">&#128250;<span>TV shows</span></span></button>
    <button type="button"><span class="hobby-type-label">&#127918;<span>Games</span></span></button>
    <button type="button"><span class="hobby-type-label">&#128214;<span>Books</span></span></button>
  </fieldset>
</form></div></main></body></html>`;
let browser;
try {
  await mkdir(".next/hobby-picker-verification", { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CALENDAR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
  await page.setContent(html);
  const tops = await page.locator(".hobby-type-picker button").evaluateAll(buttons => buttons.map(b => b.getBoundingClientRect().top));
  assert.ok(tops.every(top => top === tops[0]), `buttons wrapped to multiple rows: ${tops}`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: ".next/hobby-picker-verification/320.png" });
  console.log("Hobby picker stays on one row at 320px, no overflow.");
} finally {
  if (browser) await browser.close();
}
