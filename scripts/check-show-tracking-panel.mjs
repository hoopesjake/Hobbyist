// Visual check for the redesigned TV show tracking panel: rating/review/spoilers/status/dates
// all visible by default, spoilers on the Review header row, progressive date fields.
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

function panel({ status, started, completed, progress }) {
  return `
  <div class="show-tracking-panel">
    <form class="account-form">
      <div class="review-rating"><div class="review-rating-heading"><span>My rating</span><output>4.5 / 5</output></div><div class="rating-stars" role="group"></div></div>
      <div class="show-tracking-review-row">
        <label for="r">Review</label>
        <label class="check-label show-tracking-spoilers"><input type="checkbox"/><span class="spoilers-full">Contains spoilers</span><span class="spoilers-short">Spoilers?</span></label>
      </div>
      <textarea id="r" rows="3" placeholder="What stayed with you? (optional)"></textarea>
      <label>Watching status<select><option>${status}</option></select></label>
      <div class="calendar-form-row show-tracking-dates">
        ${started ? '<label>Start date<input type="date" value="2026-01-02"/></label>' : ""}
        ${completed ? '<label>Date finished<input type="date" value="2026-02-10"/></label>' : ""}
      </div>
      ${progress ? `<p class="show-tracking-progress">Season 1 &middot; Episode 4 watched &mdash; up next: Episode 5</p>` : ""}
    </form>
  </div>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css} body{padding:24px;max-width:700px}</style></head>
<body>
  <h3>Currently Watching</h3>
  ${panel({ status: "Currently Watching", started: true, completed: false, progress: true })}
  <hr style="margin:40px 0;border-color:#333">
  <h3>Completed</h3>
  ${panel({ status: "Completed", started: true, completed: true, progress: false })}
  <hr style="margin:40px 0;border-color:#333">
  <h3>Want to Watch</h3>
  ${panel({ status: "Want to Watch", started: false, completed: false, progress: false })}
</body></html>`;

let browser;
try {
  await mkdir(".next/show-panel-verification", { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CALENDAR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 650, height: 1100 } });
  await page.setContent(html);
  await page.screenshot({ path: ".next/show-panel-verification/desktop.png", fullPage: true });

  // Spoilers checkbox should sit on the same row as "Review", to its right.
  const reviewBox = await page.locator(".show-tracking-review-row label").first().boundingBox();
  const spoilersBox = await page.locator(".show-tracking-spoilers").first().boundingBox();
  assert.ok(Math.abs(reviewBox.y - spoilersBox.y) < 10, "Review label and spoilers checkbox should be on the same row");
  assert.ok(spoilersBox.x > reviewBox.x, "spoilers checkbox should be to the right of the Review label");
  assert.equal(await page.locator(".show-tracking-spoilers .spoilers-full").first().isVisible(), true);
  assert.equal(await page.locator(".show-tracking-spoilers .spoilers-short").first().isVisible(), false);

  await page.setViewportSize({ width: 375, height: 1100 });
  await page.screenshot({ path: ".next/show-panel-verification/mobile.png", fullPage: true });
  assert.equal(await page.locator(".show-tracking-spoilers .spoilers-full").first().isVisible(), false);
  assert.equal(await page.locator(".show-tracking-spoilers .spoilers-short").first().isVisible(), true);

  console.log("Show tracking panel check passed: review/spoilers share a row, label swaps to \"Spoilers?\" on mobile.");
} finally {
  if (browser) await browser.close();
}
