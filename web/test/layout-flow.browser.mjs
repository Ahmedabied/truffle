// Local-only final UX checks. No public credentials or inference.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.TRUFFLE_TEST_URL || "http://localhost:5191";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const out = "docs/reviews/fleet25-final-layout";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome" });
const results = [];
try {
  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 800 }, { width: 1440, height: 1000 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: "reduce" });
    await context.route("**/*", route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(base + "/demo?mock=1");
    await page.waitForFunction(() => !!window.truffle?.summary());
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    const geometry = await page.evaluate(() => {
      const scene = document.querySelector(".scene").getBoundingClientRect();
      const art = document.querySelector("#world canvas").getBoundingClientRect();
      const walk = document.querySelector("#firstWalk").getBoundingClientRect();
      return { scene: scene.width, art: art.width, walkBottom: walk.bottom, viewport: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(Math.abs(geometry.scene - geometry.art) < 1, "ASCII art must reach both scene edges without stretching");
    assert.equal(geometry.overflow, false);
    if (viewport.width <= 390) assert.ok(geometry.walkBottom <= geometry.viewport, "First demo walk should be in the initial mobile viewport");
    await page.locator("#firstWalk").click();
    await page.waitForFunction(() => window.truffle.summary().state.steps_today === 4000);
    assert.equal(await page.locator("#firstWalk").isHidden(), true);
    assert.equal(await page.locator("#effortNote").evaluate(element => !!element.closest("#pocketDialog")), true);
    const message = "It has been a long day.";
    await page.locator("#msg").fill(message);
    await page.locator("#chatForm button").click();
    await page.waitForFunction(() => document.querySelector("#reply").textContent.length > 0 && !document.querySelector("#chatForm button").disabled);
    assert.equal(await page.locator("#sentMessage").innerText(), message);
    await page.screenshot({ path: `${out}/exchange-${viewport.width}.png`, fullPage: true });
    await page.locator("#pocketBtn").click();
    await page.locator("#resetBtn").click();
    await page.waitForFunction(() => window.truffle.summary().state.steps_today === 0);
    assert.equal(await page.locator("#sentMessage").isHidden(), true);
    assert.equal(await page.locator("#reply").innerText(), "");
    results.push({ viewport, geometry, result: "PASS" });
    await context.close();
  }
  writeFileSync(`${out}/checks.json`, JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
