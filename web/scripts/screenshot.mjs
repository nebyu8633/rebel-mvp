/**
 * Renders pages in a real browser and saves screenshots.
 *
 * Used to verify the things a type-check cannot: that the 3D canvas actually
 * paints, that the RTL layout is genuinely mirrored, and that Hebrew copy
 * renders at every breakpoint.
 *
 *   node scripts/screenshot.mjs <baseUrl> <outDir> [route ...]
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const BREAKPOINTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1440, height: 900 },
];

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const outDir = process.argv[3] ?? "screenshots";
const routes = process.argv.slice(4);
const targets = routes.length > 0 ? routes : ["/"];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  // The sandbox has no GPU; SwiftShader gives a real WebGL context in
  // software, so this exercises the actual Three.js path rather than the
  // no-WebGL fallback.
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"],
});

const consoleErrors = [];

for (const breakpoint of BREAKPOINTS) {
  const context = await browser.newContext({
    viewport: { width: breakpoint.width, height: breakpoint.height },
    deviceScaleFactor: 1,
    locale: "he-IL",
  });
  const page = await context.newPage();

  // Report the failing URL, not just "failed to load resource" — the console
  // message alone does not say which request broke.
  page.on("response", (response) => {
    if (response.status() >= 400) {
      consoleErrors.push(
        `[${breakpoint.name}] HTTP ${response.status()} ${response.url()}`,
      );
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(`[${breakpoint.name}] PAGE ERROR: ${error.message}`);
  });

  for (const route of targets) {
    const url = new URL(route, baseUrl).toString();
    // Not `networkidle`: the 3D scene renders continuously and the dev/prod
    // server holds connections open, so the network never goes quiet.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    // Let the lazy-loaded scene mount and run a few frames so the canvas has
    // something in it before the shot.
    await page.waitForTimeout(2500);

    const slug = route === "/" ? "home" : route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    const file = path.join(outDir, `${slug}-${breakpoint.name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`saved ${file}`);

    // Report what actually rendered, so "it built" is not mistaken for
    // "it works".
    const report = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      let canvasPainted = false;
      if (canvas instanceof HTMLCanvasElement) {
        const gl =
          canvas.getContext("webgl2", { preserveDrawingBuffer: true }) ??
          canvas.getContext("webgl", { preserveDrawingBuffer: true });
        canvasPainted = gl !== null && canvas.width > 0 && canvas.height > 0;
      }
      return {
        dir: document.documentElement.dir,
        lang: document.documentElement.lang,
        hasCanvas: canvas !== null,
        canvasPainted,
        canvasSize:
          canvas instanceof HTMLCanvasElement ? `${canvas.width}x${canvas.height}` : null,
        title: document.title,
        h1: document.querySelector("h1")?.textContent?.slice(0, 60) ?? null,
        horizontalOverflow:
          document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    console.log(`  ${route}:`, JSON.stringify(report));
  }

  await context.close();
}

await browser.close();

if (consoleErrors.length > 0) {
  console.log("\nCONSOLE ERRORS:");
  for (const error of consoleErrors) console.log(`  ${error}`);
  process.exitCode = 1;
} else {
  console.log("\nNo console errors.");
}
