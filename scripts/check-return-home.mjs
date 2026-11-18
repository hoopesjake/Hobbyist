// Visual check that the "Return Home" back-link renders correctly above a Discover page's
// search bar, both desktop and mobile, with no overflow.
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
<body><main class="main-content"><div class="page-content">
  <a class="back-link discovery-return-home" href="/"><span class="back-link-arrow">&larr;</span><span>Return Home</span></a>
  <form class="catalog-search" role="search"><input placeholder="Search movies..."/><button class="account-button">Search</button></form>
</div></main></body></html>`;

let browser;
try {
  await mkdir(".next/return-home-verification", { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CALENDAR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 400 } });
  await page.setContent(html);
  assert.ok((await page.locator(".discovery-return-home").innerText()).includes("Return Home"));
  await page.screenshot({ path: ".next/return-home-verification/desktop.png" });
  await page.setViewportSize({ width: 375, height: 400 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: ".next/return-home-verification/mobile.png" });
  console.log("Return Home link renders correctly, no overflow at 375px.");
} finally {
  if (browser) await browser.close();
}
