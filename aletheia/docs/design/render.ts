// Renders the designed README images. Run from anywhere: node docs/design/render.ts
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const design = new URL("./", import.meta.url);
const images = new URL("../images/", import.meta.url);

const browser = await chromium.launch();

async function render(
  source: string,
  deviceScaleFactor: number,
  viewport: { width: number; height: number },
) {
  const page = await browser.newPage({ deviceScaleFactor, viewport });
  await page.goto(new URL(`${source}.html`, design).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: fileURLToPath(new URL(`${source}.png`, images)),
    fullPage: true,
    // Rounded corners stay see-through, so the card sits cleanly on any page colour.
    omitBackground: true,
  });
  await page.close();
}

await render("how-it-works", 2, { width: 1200, height: 100 });
await render("social-preview", 1, { width: 1280, height: 640 });

await browser.close();
