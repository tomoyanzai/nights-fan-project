/**
 * Headless smoke test: loads the game, takes screenshots, flies for a few
 * seconds and asserts the player actually moved. Fails on any console error.
 *
 * Usage: node scripts/verify-screenshot.mjs [baseUrl] [outDir]
 * WebGL runs on SwiftShader in headless Chromium — slow but sufficient.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const outDir = process.argv[3] ?? "screenshots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader", "--no-sandbox"],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${outDir}/01-loaded.png` });

// start a run if the title screen is up (Enter is the start control)
await page.keyboard.press("Enter");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/02-idle.png` });

await page.keyboard.down("ArrowRight");
await page.waitForTimeout(4000);
await page.screenshot({ path: `${outDir}/03-flying.png` });
await page.keyboard.up("ArrowRight");

const s = await page.evaluate(() => window.__game?.player.state.s ?? null);
console.log("player s after 4s of flight:", s);
console.log(errors.length ? `console errors (${errors.length}):` : "console errors: none");
for (const e of errors.slice(0, 8)) console.log("  -", e);

await browser.close();

if (s === null) {
  console.error("FAIL: window.__game not exposed (dev build only) — s unavailable");
  process.exit(1);
}
if (typeof s === "number" && s < 5) {
  console.error("FAIL: player barely moved");
  process.exit(1);
}
if (errors.length > 0) {
  console.error("FAIL: console errors present");
  process.exit(1);
}
console.log("PASS");
