// Real-browser regression checks. Start the local Vite server first.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright CHROME_BIN=/usr/bin/google-chrome \
//   node web/test/browser.smoke.mjs
// Optional TRUFFLE_TEST_URL defaults to http://localhost:5191. Never targets a public backend.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.TRUFFLE_TEST_URL || "http://localhost:5191";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname), "Browser tests require a local app URL");
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}) });
const results = [];
const contexts = [];
const check = async (name, run) => {
  try { await run(); results.push({ name, status: "PASS" }); }
  catch (e) { results.push({ name, status: "FAIL", error: String(e.message || e).slice(0, 1200) }); }
};
const context = async (options = {}) => {
  const c = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: "en-US", ...options });
  contexts.push(c);
  c.setDefaultTimeout(7000);
  // A misconfigured test must never send a synthetic credential or mutation to a public service.
  await c.route("**/*", route => {
    const u = new URL(route.request().url());
    return [new URL(base).origin, "http://localhost:8787"].includes(u.origin) ? route.continue() : route.abort();
  });
  return c;
};
const open = async (c, path = "/demo?mock=1") => {
  const p = await c.newPage();
  await p.goto(base + path);
  await p.waitForFunction(() => !!window.truffle?.summary());
  return p;
};
const summary = p => p.evaluate(() => window.truffle.summary());
const settle = p => p.waitForTimeout(650);
const reset = async p => { await p.locator("#resetBtn").click(); await p.waitForFunction(() => window.truffle.summary().state.steps_today === 0); };
const queuedAction = (p, action, steps) => p.evaluate(({ action, steps }) => {
  const slider = document.querySelector("#steps");
  slider.value = String(steps);
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  document.querySelector(action).click();
}, { action, steps });

try {
  const c = await context();
  const p = await open(c);
  await check("pending slider cannot undo Reset", async () => {
    await reset(p);
    await queuedAction(p, "#resetBtn", 10000);
    await settle(p);
    const s = await summary(p);
    assert.equal(s.state.steps_today, 0);
    assert.equal(s.state.energy, 0);
    assert.equal(s.state.stage, "Spore");
    assert.equal(await p.locator("#steps").inputValue(), "0");
  });
  await check("pending slider cannot feed the next day", async () => {
    await reset(p);
    await queuedAction(p, "#midBtn", 8000);
    await settle(p);
    const s = await summary(p);
    assert.equal(s.state.steps_today, 0);
    assert.equal(s.state.lifetime_steps, 0);
    assert.equal(s.state.age_days, 1);
  });
  await check("rapid slider changes commit only the last value", async () => {
    await reset(p);
    await p.evaluate(() => {
      const s = document.querySelector("#steps");
      for (const n of [1000, 12000, 300, 15000, 8700]) {
        s.value = String(n); s.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    assert.equal(await p.locator("#chatForm button").isDisabled(), true);
    await settle(p);
    assert.equal((await summary(p)).state.steps_today, 8700);
    assert.equal((await summary(p)).state.lifetime_steps, 8700);
    assert.equal(await p.locator("#chatForm button").isEnabled(), true);
  });
  await check("chat canceled before first token stays cleared", async () => {
    await p.locator("#msg").fill("hello");
    await p.locator("#chatForm button").click();
    await p.waitForTimeout(150);
    await reset(p);
    await p.waitForTimeout(1000);
    assert.equal(await p.locator("#reply").innerText(), "");
    assert.equal(await p.locator("#status").innerText(), "");
    assert.equal((await summary(p)).state.energy, 0);
    assert.equal(await p.locator("#chatForm button").isEnabled(), true);
  });
  await check("chat canceled after first token stays cleared", async () => {
    await p.locator("#steps").fill("12000"); await settle(p);
    await p.locator("#msg").fill("hello"); await p.locator("#chatForm button").click();
    await p.waitForFunction(() => document.querySelector("#reply").textContent.length > 0);
    await reset(p); await p.waitForTimeout(1000);
    assert.equal(await p.locator("#reply").innerText(), "");
    assert.equal((await summary(p)).state.energy, 0);
  });
  await check("heat, steps, and progress persist through reload", async () => {
    await p.locator("#heatBtn").click(); await p.locator("#steps").fill("5400"); await settle(p);
    const before = (await summary(p)).state;
    await p.reload(); await p.waitForFunction(() => !!window.truffle?.summary());
    const after = (await summary(p)).state;
    assert.equal(after.steps_today, before.steps_today);
    assert.equal(after.energy, before.energy);
    assert.equal(after.burrowed, true);
  });
  await check("seen moments do not replay on reload", async () => {
    await p.reload(); await p.waitForFunction(() => !!window.truffle?.summary());
    assert.equal(await p.locator("#moment").isHidden(), true);
    await p.locator("#hud").click();
    assert.ok(await p.locator("#momentList li").count() > 0);
  });
  await check("demo and main simulation retain separate pet progress", async () => {
    const demoSteps = (await summary(p)).state.steps_today;
    const main = await open(c, "/?mock=1");
    assert.notEqual((await summary(main)).state.steps_today, demoSteps);
    assert.equal(await main.locator("#judge").isHidden(), true);
    assert.equal(await main.locator("#offline").isVisible(), true);
    await main.close();
  });
  await check("320px English/Arabic layout and maximum text size do not overflow", async () => {
    await p.setViewportSize({ width: 320, height: 700 });
    await p.locator("#settings summary").click();
    for (let i = 0; i < 6; i++) await p.locator("#fontUp").click();
    const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    assert.equal(await fits(), true);
    await p.locator("#langBtn").click();
    assert.equal(await fits(), true);
    assert.equal(await p.locator("#app").getAttribute("dir"), "rtl");
    await p.locator("#motion").check();
    await p.reload(); await p.waitForFunction(() => !!window.truffle?.summary());
    assert.equal(await p.locator("html").getAttribute("lang"), "ar");
    assert.equal(await p.locator("#motion").isChecked(), true);
    assert.equal(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")), "1.5");
    assert.equal(await fits(), true);
  });
  await check("reduced motion freezes actual canvas pixels", async () => {
    await p.waitForTimeout(1000);
    const before = await p.locator("#world").screenshot();
    await p.waitForTimeout(500);
    const after = await p.locator("#world").screenshot();
    assert.ok(before.equals(after), "Reduced-motion scene changed between screenshots");
  });
  await check("demo share card includes provenance and downloads a PNG", async () => {
    await p.evaluate(() => {
      window.testCanvasLabels = [];
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
        window.testCanvasLabels.push(text); return original.call(this, text, ...args);
      };
    });
    await p.locator("#langBtn").click();
    const download = p.waitForEvent("download");
    await p.locator("#shareBtn").click();
    const d = await download;
    assert.match(d.suggestedFilename(), /^truffle-\d{4}-\d\d-\d\d\.png$/);
    assert.equal(await d.failure(), null);
    const labels = await p.evaluate(() => window.testCanvasLabels);
    assert.ok(labels.includes("simulated steps · demo Truffle"));
  });
  await check("system reduced motion disables the conflicting app toggle", async () => {
    const reducedContext = await context({ reducedMotion: "reduce" });
    const q = await open(reducedContext);
    await q.locator("#settings summary").click();
    assert.equal(await q.locator("#motion").isDisabled(), true);
    assert.equal(await q.locator("#motionNote").isHidden(), false);
  });

  // Real transport behavior with fake credentials and intercepted loopback-only API routes.
  const fixture = await summary(p);
  fixture.demo = true;
  fixture.lang = "en";
  const rc = await context({ reducedMotion: "reduce" });
  let chatMode = "429";
  let stateStatus = 200;
  const calls = [];
  const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, OPTIONS" };
  await rc.route("http://localhost:8787/**", async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    calls.push({ path, method: req.method() });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/health") return route.fulfill({ json: { ok: true }, headers });
    if (path === "/demo/spawn") return route.fulfill({ json: { ...fixture, phrase: "synthetic-test-pet", secret: "fake-test-secret" }, headers });
    if (path === "/state") return route.fulfill({ status: stateStatus, json: stateStatus === 200 ? fixture : { error: "synthetic temporary failure" }, headers });
    if (path === "/demo/reset") return route.fulfill({ json: fixture, headers });
    if (path === "/chat") {
      if (chatMode === "429") return route.fulfill({ status: 429, json: { error: "Truffle needs a break", retry_after_s: 60 }, headers });
      if (chatMode === "500") return route.fulfill({ status: 500, json: { error: "synthetic temporary failure" }, headers });
      if (chatMode === "401") return route.fulfill({ status: 401, json: { error: "synthetic rejected credential" }, headers });
      return route.fulfill({ contentType: "text/event-stream", headers, body: 'event: token\ndata: {"text":"Recovered synthetic reply."}\n\nevent: done\ndata: {"tier":"low","spent":0,"brain":"test"}\n\n' });
    }
    return route.fulfill({ status: 404, headers });
  });
  const rp = await open(rc, "/demo");
  const send = async message => {
    await rp.locator("#msg").fill(message);
    await rp.locator("#chatForm button").click();
    await rp.waitForTimeout(150);
  };
  await check("Reset clears a canceled chat cooldown", async () => {
    await send("hello");
    assert.equal(await rp.locator("#chatForm button").isDisabled(), true);
    await rp.locator("#resetBtn").click();
    await rp.waitForTimeout(150);
    assert.equal(await rp.locator("#chatForm button").isEnabled(), true);
    assert.equal(await rp.locator("#status").innerText(), "");
  });
  await check("chat recovers after a temporary server error", async () => {
    chatMode = "500"; await send("fail once");
    assert.match(await rp.locator("#reply").innerText(), /could not finish/);
    assert.equal(await rp.locator("#chatForm button").isEnabled(), true);
    chatMode = "ok"; await send("retry");
    assert.equal(await rp.locator("#reply").innerText(), "Recovered synthetic reply.");
    assert.equal(await rp.locator("#chatForm button").isEnabled(), true);
  });
  await check("401 chat opens settings without replacing the saved pet", async () => {
    chatMode = "401"; await send("auth failure");
    assert.equal(await rp.locator("#settings").evaluate(e => e.open), true);
    assert.match(await rp.locator("#reply").innerText(), /not recognised/);
    assert.equal(calls.filter(x => x.path === "/demo/spawn" && x.method === "POST").length, 1);
  });
  await check("invalid API address is rejected without navigating", async () => {
    const url = rp.url();
    await rp.locator("#api").fill("https://user:fake@example.invalid/private");
    await rp.locator("#apiSave").click();
    assert.equal(rp.url(), url);
    assert.equal(await rp.evaluate(() => localStorage.getItem("truffle.api")), null);
    assert.match(await rp.locator("#why").innerText(), /https|HTTPS|address|origin/);
  });
  await check("temporary boot failure exposes a working Retry action", async () => {
    stateStatus = 503;
    await rp.reload();
    await rp.locator("#retryBtn").waitFor({ state: "visible" });
    assert.equal(await rp.locator("#chatForm button").isDisabled(), true);
    stateStatus = 200;
    await rp.locator("#retryBtn").click();
    await rp.waitForFunction(() => !!window.truffle?.summary());
    assert.equal(await rp.locator("#chatForm button").isEnabled(), true);
  });
  await check("background refresh failure marks stale state and Retry recovers", async () => {
    stateStatus = 503;
    await rp.bringToFront();
    await rp.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await rp.locator("#recovery").waitFor({ state: "visible" });
    assert.ok((await rp.locator("#syncNote").innerText()).length > 0);
    stateStatus = 200;
    await rp.locator("#retryBtn").click();
    await rp.locator("#recovery").waitFor({ state: "hidden" });
  });
  await check("404 on real-pet startup preserves saved identity and does not pair", async () => {
    const realContext = await context();
    await realContext.addInitScript(() => {
      localStorage.setItem("truffle.creds", JSON.stringify({ phrase: "synthetic-retained-pet", secret: "fake-retained-secret" }));
    });
    let paired = false;
    await realContext.route("http://localhost:8787/**", route => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (path === "/health") return route.fulfill({ json: { ok: true }, headers });
      if (path === "/pair") paired = true;
      return route.fulfill({ status: 404, json: { error: "synthetic unavailable pet" }, headers });
    });
    const real = await realContext.newPage();
    await real.goto(base + "/");
    await real.locator("#retryBtn").waitFor({ state: "visible" });
    assert.equal(paired, false);
    assert.equal(await real.evaluate(() => !!JSON.parse(localStorage.getItem("truffle.creds") || "null")?.secret), true);
    assert.equal(await real.locator("#chatForm button").isDisabled(), true);
  });
  await check("Arabic world description follows the UI language", async () => {
    await p.locator("#langBtn").click();
    assert.equal(await p.locator("html").getAttribute("lang"), "ar");
    assert.match(await p.locator("#world").getAttribute("aria-label"), /الطاقة/);
    assert.match(await p.locator("#why").innerText(), /[\u0600-\u06ff]/);
  });
  await check("pause ritual freezes the world and returns without sending a message", async () => {
    const pc = await context();
    const pp = await open(pc, "/?mock=1&scene=content");
    let chats = 0;
    pp.on("request", r => { if (new URL(r.url()).pathname === "/chat") chats++; });
    await pp.locator("#pauseBtn").click();
    assert.equal(await pp.locator("#pauseDialog").evaluate(e => e.open), true);
    const before = await pp.locator("#world canvas").evaluate(e => e.toDataURL());
    await pp.waitForTimeout(800);
    assert.equal(await pp.locator("#world canvas").evaluate(e => e.toDataURL()), before);
    await pp.locator("#backBtn").click();
    assert.equal(await pp.locator("#pauseDialog").evaluate(e => e.open), false);
    assert.equal(await pp.locator("#msg").inputValue(), "");
    assert.equal(chats, 0);
    await pp.waitForFunction(() => document.getElementById("why").textContent.includes("notice"));
  });
  await check("heat pause invites comfort indoors without asking for a walk", async () => {
    const hp = await open(await context(), "/?mock=1&scene=burrowed&temp=44");
    await hp.locator("#pauseBtn").click();
    assert.match(await hp.locator("#pauseText").innerText(), /indoors/);
    await hp.keyboard.press("Escape");
    assert.equal(await hp.locator("#pauseDialog").evaluate(e => e.open), false);
  });
  await check("invalid saved language and scale do not prevent startup", async () => {
    const ic = await context();
    await ic.addInitScript(() => {
      localStorage.setItem("truffle.lang", JSON.stringify("fr"));
      localStorage.setItem("truffle.font", JSON.stringify("broken"));
    });
    const ip = await open(ic);
    assert.equal(await ip.locator("html").getAttribute("lang"), "en");
    assert.equal(await ip.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
} finally {
  for (const c of contexts) await c.close();
  await browser.close();
}
console.log(JSON.stringify({ tests: results.length, passed: results.filter(r => r.status === "PASS").length, results }, null, 2));
if (results.some(r => r.status === "FAIL")) process.exitCode = 1;
