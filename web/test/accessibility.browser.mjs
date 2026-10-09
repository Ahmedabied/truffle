// Local-only keyboard, RTL and text-reflow regression checks.
// CHROME_BIN=/usr/bin/google-chrome node web/test/accessibility.browser.mjs
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.TRUFFLE_TEST_URL || "http://localhost:5191";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome" });
const context = await browser.newContext({ viewport: { width: 320, height: 700 }, locale: "en-US", reducedMotion: "reduce" });
context.setDefaultTimeout(7000);
await context.route("**/*", route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
const page = await context.newPage();
const results = [];
const check = async (name, run) => {
  try { await run(); results.push({ name, status: "PASS" }); }
  catch (error) { results.push({ name, status: "FAIL", error: String(error.message || error) }); }
};
const pocket = () => page.locator("#pocketDialog");
const openPocket = async () => { if (!await pocket().evaluate(e => e.open)) await page.locator("#pocketBtn").click(); };
const closePocket = async () => { if (await pocket().evaluate(e => e.open)) await page.locator("#pocketClose").click(); };
const focusId = () => page.locator(":focus").getAttribute("id");
const assertFit = async () => {
  const measurements = await page.evaluate(() => {
    const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden";
    const outside = [...document.querySelectorAll("#app button, #app input, #app select, #world, #pocketDialog button, #pocketDialog input, #pocketDialog summary, .gift-card")]
      .filter(visible).map(e => ({ id: e.id || e.tagName, left: e.getBoundingClientRect().left, right: e.getBoundingClientRect().right }))
      .filter(e => e.left < -1 || e.right > innerWidth + 1);
    return { outside, documentWidth: document.documentElement.scrollWidth, viewport: innerWidth, pocketWidth: document.querySelector("#pocketDialog").scrollWidth };
  });
  assert.deepEqual(measurements.outside, [], JSON.stringify(measurements));
  assert.ok(measurements.documentWidth <= measurements.viewport);
  assert.ok(measurements.pocketWidth <= measurements.viewport);
};

try {
  await page.goto(base + "/demo?mock=1");
  await page.waitForFunction(() => !!window.truffle?.summary());
  await check("keyboard opens Pocket, shows focus and restores its opener on Escape", async () => {
    await page.keyboard.press("Tab");
    assert.equal(await focusId(), "pocketBtn");
    assert.equal(await page.locator(":focus").evaluate(e => getComputedStyle(e).outlineStyle), "solid");
    await page.keyboard.press("Enter");
    assert.equal(await pocket().evaluate(e => e.open), true);
    assert.equal(await focusId(), "pocketClose");
    await page.keyboard.press("Escape");
    assert.equal(await pocket().evaluate(e => e.open), false);
    assert.equal(await focusId(), "pocketBtn");
    await page.keyboard.press("Tab");
    assert.equal(await focusId(), "hud");
    await page.keyboard.press("Space");
    assert.equal(await pocket().evaluate(e => e.open), true);
    assert.equal(await page.locator("#momentBox").isVisible(), true);
    await page.keyboard.press("Escape");
    assert.equal(await focusId(), "hud");
  });

  await check("keepsakes and Settings disclose using the keyboard with named controls", async () => {
    await openPocket();
    await page.locator("#keepsakes > summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#keepsakes").evaluate(e => e.open), true);
    await page.locator("#previewGift").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#giftCard").isVisible(), true);
    assert.ok((await page.locator("#giftName").innerText()).length > 0);
    assert.equal(await page.locator("#giftArt").getAttribute("aria-hidden"), "true");
    assert.equal(await page.locator("#giftList button").first().getAttribute("aria-pressed"), "true");
    assert.ok((await page.locator("#giftList button").first().getAttribute("aria-label")).length > 0);
    await page.locator("#settings > summary").focus();
    await page.keyboard.press("Space");
    assert.equal(await page.locator("#settings").evaluate(e => e.open), true);
    assert.equal(await page.locator("#motion").isDisabled(), true);
    assert.equal(await page.locator("#motionNote").isVisible(), true);
    await page.locator("#settings .connection > summary").click();
  });

  for (const lang of ["en", "ar"]) {
    for (const scale of [1, 1.5, 2]) {
      await check(`320px ${lang} world, chat and expanded Pocket fit at ${scale * 100}% text`, async () => {
        await openPocket();
        if (await page.locator("html").getAttribute("lang") !== lang) await page.locator("#langBtn").click();
        // 150% is the supported app maximum; 200% additionally stresses browser text enlargement.
        await page.evaluate(value => document.documentElement.style.setProperty("--ui-scale", String(value)), scale);
        await assertFit();
        assert.equal(await pocket().getAttribute("dir"), lang === "ar" ? "rtl" : "ltr");
        assert.equal(await page.locator("#giftArt").evaluate(e => getComputedStyle(e).direction), "ltr");
        await closePocket();
        await assertFit();
        assert.equal(await page.locator("#world").evaluate(e => getComputedStyle(e).direction), "ltr");
        assert.equal(await page.locator("#app").getAttribute("dir"), lang === "ar" ? "rtl" : "ltr");
      });
    }
  }

  await check("Pocket keeps page controls modal and focused controls clear of its sticky heading", async () => {
    await openPocket();
    await page.locator("#giftCard").scrollIntoViewIfNeeded();
    await closePocket();
    await openPocket();
    for (let i = 0; i < 65; i++) {
      await page.keyboard.press(i < 35 ? "Tab" : "Shift+Tab");
      const focus = await page.evaluate(() => {
        const element = document.activeElement;
        const bounds = element.getBoundingClientRect();
        const heading = document.querySelector(".pocket-top").getBoundingClientRect();
        return { id: element.id || element.tagName, inside: !!element.closest("#pocketDialog"), content: !!element.closest(".pocket-content"), top: bounds.top, bottom: bounds.bottom, headingBottom: heading.bottom };
      });
      // A native modal may hand focus to browser chrome (activeElement becomes BODY),
      // but no interactive element in the underlying app may receive document focus.
      assert.ok(focus.inside || focus.id === "BODY", JSON.stringify(focus));
      if (focus.content) {
        assert.ok(focus.bottom > focus.headingBottom, JSON.stringify(focus));
        assert.ok(focus.top < 700, JSON.stringify(focus));
      }
    }
  });

  for (const lang of ["en", "ar"]) {
    await check(`${lang} sample chat exposes completed accessible reply and simulated cost`, async () => {
      await openPocket();
      if (await page.locator("html").getAttribute("lang") !== lang) await page.locator("#langBtn").click();
      await page.locator("#walkBtn").click();
      await page.waitForFunction(() => window.truffle.summary().state.steps_today >= 4000);
      await closePocket();
      await page.locator("#msg").fill(lang === "ar" ? "مرحبا" : "hello");
      assert.equal(await page.locator("#msg").evaluate(e => getComputedStyle(e).direction), lang === "ar" ? "rtl" : "ltr");
      await page.locator("#msg").press("Enter");
      await page.waitForFunction(() => !document.querySelector("#chatForm button").disabled && !!document.querySelector("#replySr").textContent);
      assert.equal(await page.locator("#reply").getAttribute("aria-hidden"), "true");
      assert.equal(await page.locator("#replySr").getAttribute("role"), "status");
      assert.equal(await page.locator("#replySr").getAttribute("aria-atomic"), "true");
      assert.equal(await page.locator("#replySr").textContent(), await page.locator("#reply").textContent());
      const details = await page.locator("#chatDetails").textContent();
      assert.match(details, lang === "ar" ? /تكلفة الطعام في المحاكاة/ : /Simulated cost:/);
      assert.doesNotMatch(details, /Actual cost|التكلفة الفعلية/);
    });
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
if (results.some(result => result.status === "FAIL")) process.exitCode = 1;
