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
const openPocket = async p => { if (!await p.locator("#pocketDialog").evaluate(e => e.open)) await p.locator("#pocketBtn").click(); };
const closePocket = async p => { if (await p.locator("#pocketDialog").evaluate(e => e.open)) await p.locator("#pocketClose").click(); };
const pocketAction = async (p, selector, method = "click", value) => {
  await openPocket(p);
  if (["#api", "#apiSave", "#forgetBtn"].includes(selector)) await p.locator("#settings, #settings .connection").evaluateAll(es => es.forEach(e => { e.open = true; }));
  return p.locator(selector)[method](...(value === undefined ? [] : [value]));
};
const homeAction = async (p, selector, method = "click", value) => { await closePocket(p); return p.locator(selector)[method](...(value === undefined ? [] : [value])); };
const summary = p => p.evaluate(() => window.truffle.summary());
const settle = p => p.waitForTimeout(650);
const reset = async p => { await pocketAction(p, "#resetBtn", "click"); await p.waitForFunction(() => window.truffle.summary().state.steps_today === 0); };
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
    await homeAction(p, "#msg", "fill", "hello");
    await homeAction(p, "#chatForm button", "click");
    await p.waitForTimeout(150);
    await reset(p);
    await p.waitForTimeout(1000);
    assert.equal(await p.locator("#reply").innerText(), "");
    assert.equal(await p.locator("#status").innerText(), "");
    assert.equal((await summary(p)).state.energy, 0);
    assert.equal(await p.locator("#chatForm button").isEnabled(), true);
  });
  await check("chat canceled after first token stays cleared", async () => {
    await pocketAction(p, "#steps", "fill", "12000"); await settle(p);
    await homeAction(p, "#msg", "fill", "hello"); await homeAction(p, "#chatForm button", "click");
    await p.waitForFunction(() => document.querySelector("#reply").textContent.length > 0);
    await reset(p); await p.waitForTimeout(1000);
    assert.equal(await p.locator("#reply").innerText(), "");
    assert.equal((await summary(p)).state.energy, 0);
  });
  await check("heat, steps, and progress persist through reload", async () => {
    await pocketAction(p, "#heatBtn", "click"); await pocketAction(p, "#steps", "fill", "5400"); await settle(p);
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
    await homeAction(p, "#hud", "click");
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
    await pocketAction(p, "#settings > summary", "click");
    for (let i = 0; i < 6; i++) await pocketAction(p, "#fontUp", "click");
    const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    assert.equal(await fits(), true);
    await pocketAction(p, "#langBtn", "click");
    assert.equal(await fits(), true);
    assert.equal(await p.locator("#app").getAttribute("dir"), "rtl");
    await pocketAction(p, "#motion", "check");
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
    await pocketAction(p, "#langBtn", "click");
    const download = p.waitForEvent("download");
    await pocketAction(p, "#shareBtn", "click");
    const d = await download;
    assert.match(d.suggestedFilename(), /^truffle-\d{4}-\d\d-\d\d\.png$/);
    assert.equal(await d.failure(), null);
    const labels = await p.evaluate(() => window.testCanvasLabels);
    assert.ok(labels.includes("simulated steps · demo Truffle"));
  });
  await check("system reduced motion disables the conflicting app toggle", async () => {
    const reducedContext = await context({ reducedMotion: "reduce" });
    const q = await open(reducedContext);
    await pocketAction(q, "#settings > summary", "click");
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
    await homeAction(rp, "#msg", "fill", message);
    await homeAction(rp, "#chatForm button", "click");
    await rp.waitForTimeout(150);
  };
  await check("Reset clears a canceled chat cooldown", async () => {
    await send("hello");
    assert.equal(await rp.locator("#chatForm button").isDisabled(), true);
    await pocketAction(rp, "#resetBtn", "click");
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
    await pocketAction(rp, "#api", "fill", "https://user:fake@example.invalid/private");
    await pocketAction(rp, "#apiSave", "click");
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
    await homeAction(rp, "#retryBtn");
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
    await homeAction(rp, "#retryBtn");
    await rp.locator("#recovery").waitFor({ state: "hidden" });
  });
  await check("an offline return preserves its keepsake through heartbeat and recovery", async () => {
    await rp.clock.install();
    await rp.reload();
    await rp.waitForFunction(() => !!window.truffle?.summary());
    stateStatus = 503;
    const leftAt = await rp.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.startsWith("truffle.keepsakes@") && !k.endsWith("/read"));
      const seen = Date.now() - 11 * 60_000;
      localStorage.setItem(key, JSON.stringify({ version: 1, seen, gifts: [] }));
      document.dispatchEvent(new Event("visibilitychange"));
      return seen;
    });
    await rp.locator("#recovery").waitFor({ state: "visible" });
    await rp.clock.runFor(61_000);
    const stored = await rp.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith("truffle.keepsakes@") && !k.endsWith("/read")))));
    assert.equal(stored.seen, leftAt);
    assert.equal(stored.gifts.length, 0);
    stateStatus = 200;
    await homeAction(rp, "#retryBtn");
    await rp.locator("#recovery").waitFor({ state: "hidden" });
    assert.equal(await rp.locator("#giftCount").innerText(), "1");
    assert.equal((await summary(rp)).state.energy, fixture.state.energy);
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
  const importHarness = async ({ saved = false, native = true } = {}) => {
    const ic = await context({ ...(native ? { userAgent: "Android TruffleApp/0.3" } : {}) });
    const oldPet = { phrase: "synthetic-retained-pet", secret: "fake-retained-secret" };
    const nextPet = { phrase: "synthetic-import-pet", secret: "fake-import-secret" };
    if (saved) await ic.addInitScript(old => {
      if (!sessionStorage.getItem("test-seeded")) {
        localStorage.setItem("truffle.creds", JSON.stringify(old));
        sessionStorage.setItem("test-seeded", "1");
      }
    }, oldPet);
    const transport = { status: 200, health: true, paired: 0, oldReads: 0, importedReads: 0 };
    await ic.route("http://localhost:8787/**", route => {
      const req = route.request(), url = new URL(req.url());
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (url.pathname === "/health") return route.fulfill({ json: { ok: transport.health }, headers });
      if (url.pathname === "/pair") {
        transport.paired++;
        return route.fulfill({ json: { ...fixture, demo: false, ...oldPet }, headers });
      }
      if (url.pathname === "/state") {
        const importing = url.searchParams.get("phrase") === nextPet.phrase;
        if (importing) transport.importedReads++; else transport.oldReads++;
        return route.fulfill({ status: importing ? transport.status : 200, json: importing && transport.status !== 200 ? { error: "synthetic import failure" } : { ...fixture, demo: false, state: { ...fixture.state, steps_today: importing ? 81 : 0 } }, headers });
      }
      return route.fulfill({ status: 404, headers });
    });
    const page = await ic.newPage();
    const target = `${base}/#creds=${nextPet.phrase}.${nextPet.secret}`;
    const settled = () => page.waitForFunction(() => !!window.truffle?.summary() || !document.querySelector("#recovery").hidden);
    const savedIs = expected => page.evaluate(value => localStorage.getItem("truffle.creds") === JSON.stringify(value), expected);
    return { page, target, settled, savedIs, oldPet, nextPet, transport };
  };
  await check("declined fresh import stays unpaired through reload", async () => {
    const h = await importHarness({ native: false });
    h.page.on("dialog", dialog => dialog.dismiss());
    await h.page.goto(h.target); await h.settled();
    assert.equal(h.transport.paired, 0);
    assert.equal(await summary(h.page), null);
    assert.equal(new URL(h.page.url()).hash, "");
    await h.page.reload(); await h.settled();
    assert.equal(h.transport.paired, 0);
    assert.equal(await summary(h.page), null);
    assert.equal(await h.page.locator("#chatForm button").isDisabled(), true);
    assert.match(await h.page.locator("#syncNote").textContent(), /reopen|open.*again/i);
  });
  await check("native declined import never displays the other saved pet", async () => {
    const h = await importHarness({ saved: true });
    h.page.on("dialog", dialog => dialog.dismiss());
    await h.page.goto(h.target); await h.settled();
    assert.equal(await h.savedIs(h.oldPet), true);
    assert.equal(h.transport.oldReads, 0);
    assert.equal(await summary(h.page), null);
    await h.page.reload(); await h.settled();
    assert.equal(h.transport.oldReads, 0);
    assert.equal(h.transport.paired, 0);
    assert.equal(await summary(h.page), null);
  });
  await check("failed import preserves saved identity and Retry retains the stripped candidate", async () => {
    const h = await importHarness({ saved: true });
    h.transport.status = 503;
    h.page.on("dialog", dialog => dialog.accept());
    await h.page.goto(h.target); await h.settled();
    assert.equal(await h.savedIs(h.oldPet), true);
    assert.equal(h.transport.oldReads, 0);
    assert.equal(await summary(h.page), null);
    h.transport.status = 200;
    await homeAction(h.page, "#retryBtn");
    await h.page.waitForFunction(() => !!window.truffle?.summary());
    assert.equal((await summary(h.page)).state.steps_today, 81);
    assert.equal(await h.savedIs(h.nextPet), true);
    assert.equal(h.transport.paired, 0);
    assert.equal(h.transport.importedReads, 2);
    assert.equal(new URL(h.page.url()).hash, "");
  });
  await check("accepted verified import survives reload without another pairing", async () => {
    const h = await importHarness();
    h.page.on("dialog", dialog => dialog.accept());
    await h.page.goto(h.target); await h.settled();
    assert.equal((await summary(h.page)).state.steps_today, 81);
    assert.equal(await h.savedIs(h.nextPet), true);
    await h.page.reload(); await h.settled();
    assert.equal((await summary(h.page)).state.steps_today, 81);
    assert.equal(h.transport.paired, 0);
    assert.equal(h.transport.oldReads, 0);
  });
  await check("malformed import cannot create a replacement pet", async () => {
    const h = await importHarness();
    await h.page.goto(base + "/#creds=invalid"); await h.settled();
    assert.equal(h.transport.paired, 0);
    assert.equal(await summary(h.page), null);
    assert.equal(new URL(h.page.url()).hash, "");
    await h.page.reload(); await h.settled();
    assert.equal(h.transport.paired, 0);
    assert.equal(await summary(h.page), null);
  });
  await check("offline import cannot substitute a sample and Retry reconnects", async () => {
    const h = await importHarness({ saved: true });
    h.transport.health = false;
    h.page.on("dialog", dialog => dialog.accept());
    await h.page.goto(h.target); await h.settled();
    assert.equal(await summary(h.page), null);
    assert.equal(await h.savedIs(h.oldPet), true);
    h.transport.health = true;
    await homeAction(h.page, "#retryBtn");
    await h.page.waitForFunction(() => !!window.truffle?.summary());
    assert.equal((await summary(h.page)).state.steps_today, 81);
    assert.equal(h.transport.paired, 0);
  });
  await check("native World without an owner directs setup to Feed without pairing", async () => {
    const h = await importHarness();
    await h.page.goto(base + "/"); await h.settled();
    assert.equal(h.transport.paired, 0);
    assert.equal(await summary(h.page), null);
    assert.match(await h.page.locator("#syncNote").textContent(), /Feed/);
    await h.page.reload(); await h.settled();
    assert.equal(h.transport.paired, 0);
    assert.equal(await summary(h.page), null);
  });
  await check("native Retry after a later outage keeps the real backend", async () => {
    const h = await importHarness();
    h.page.on("dialog", dialog => dialog.accept());
    await h.page.goto(h.target); await h.settled();
    h.transport.status = 503; h.transport.health = false;
    await h.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await h.page.locator("#recovery").waitFor({ state: "visible" });
    await homeAction(h.page, "#retryBtn");
    await h.page.waitForTimeout(150);
    assert.equal(await h.page.evaluate(() => window.truffle.mock()), false);
    assert.equal((await summary(h.page)).state.steps_today, 81);
    h.transport.status = 200;
    await homeAction(h.page, "#retryBtn");
    await h.page.locator("#recovery").waitFor({ state: "hidden" });
    assert.equal(h.transport.paired, 0);
  });
  await check("explicit Forget clears an unfinished browser import", async () => {
    const h = await importHarness({ native: false });
    let accept = false;
    h.page.on("dialog", dialog => accept ? dialog.accept() : dialog.dismiss());
    await h.page.goto(h.target); await h.settled();
    assert.equal(h.transport.paired, 0);
    accept = true;
    await pocketAction(h.page, "#forgetBtn");
    await h.page.waitForFunction(() => !!window.truffle?.summary());
    assert.equal(h.transport.paired, 1);
    assert.equal(await h.page.evaluate(() => Object.keys(localStorage).some(key => key.endsWith(".pending-import"))), false);
  });
  await check("Arabic world description follows the UI language", async () => {
    await pocketAction(p, "#langBtn", "click");
    assert.equal(await p.locator("html").getAttribute("lang"), "ar");
    assert.match(await p.locator("#world").getAttribute("aria-label"), /الطاقة/);
    assert.match(await p.locator("#why").innerText(), /[\u0600-\u06ff]/);
  });
  await check("pause ritual freezes the world and returns without sending a message", async () => {
    const pc = await context();
    const pp = await open(pc, "/?mock=1&scene=content");
    let chats = 0;
    pp.on("request", r => { if (new URL(r.url()).pathname === "/chat") chats++; });
    await pocketAction(pp, "#pauseBtn", "click");
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
    await pocketAction(hp, "#pauseBtn", "click");
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
  await check("return gifts persist without changing energy, and Reset clears them", async () => {
    const gp = await open(await context());
    const before = (await summary(gp)).state.energy;
    await pocketAction(gp, "#keepsakes summary", "click");
    await pocketAction(gp, "#previewGift", "click");
    assert.equal(await gp.locator("#giftCount").innerText(), "1");
    assert.equal(await gp.locator("#giftCard").isVisible(), true);
    assert.equal((await summary(gp)).state.energy, before);
    const name = await gp.locator("#giftName").innerText();
    await gp.reload(); await gp.waitForFunction(() => !!window.truffle?.summary());
    await pocketAction(gp, "#keepsakes summary", "click");
    assert.equal(await gp.locator("#giftName").innerText(), name);
    assert.equal(await gp.locator("#previewGift").isDisabled(), true);
    await reset(gp);
    assert.equal(await gp.locator("#giftCount").innerText(), "0");
    assert.equal(await gp.locator("#giftCard").isHidden(), true);
  });
  await check("an elapsed absence creates one local gift on a rest day", async () => {
    const rp = await open(await context());
    await rp.context().addInitScript(() => {
      const realNow = Date.now;
      Date.now = () => realNow() + 11 * 60_000;
    });
    await rp.reload(); await rp.waitForFunction(() => !!window.truffle?.summary());
    assert.equal(await rp.locator("#giftCount").innerText(), "1");
    assert.equal((await summary(rp)).state.steps_today, 0);
    assert.equal((await summary(rp)).state.energy, 0);
    await rp.reload(); await rp.waitForFunction(() => !!window.truffle?.summary());
    assert.equal(await rp.locator("#giftCount").innerText(), "1");
  });
  await check("heading out is a warm local interaction, and heat keeps the invitation indoors", async () => {
    const op = await open(await context(), "/demo?mock=1&scene=content");
    const before = (await summary(op)).state.energy;
    await pocketAction(op, "#outingBtn", "click");
    await pocketAction(op, "#outingErrand", "click");
    assert.match(await op.locator("#pauseText").innerText(), /groceries/);
    await op.locator("#backBtn").click();
    assert.equal((await summary(op)).state.energy, before);
    assert.equal(await op.locator("#reply").innerText(), "");
    await pocketAction(op, "#heatBtn", "click");
    await pocketAction(op, "#outingBtn", "click");
    await pocketAction(op, "#outingWalk", "click");
    assert.match(await op.locator("#pauseText").innerText(), /indoors/);
    await op.keyboard.press("Escape");
  });
  await check("mobile world fills the width and chat follows it with secondary controls in Pocket", async () => {
    const hp = await open(await context({ viewport: { width: 412, height: 915 } }));
    const box = await hp.locator("#scene").boundingBox();
    const chat = await hp.locator(".chat").boundingBox();
    assert.equal(box.x, 0); assert.equal(box.width, 412);
    assert.ok(box.height >= 915 * 0.55 && box.height <= 915 * 0.65);
    assert.ok(chat.y >= box.y + box.height && chat.y < box.y + box.height + 100);
    assert.equal(await hp.locator("#walkBtn").isVisible(), false);
    assert.equal(await hp.locator("#outingBtn").isVisible(), false);
    await openPocket(hp);
    assert.equal(await hp.locator("#outingBtn").isVisible(), true);
    await closePocket(hp);
    assert.equal(await hp.locator("#msg").isVisible(), true);
  });
  await check("outing survives reload, welcomes once and never charges or sends", async () => {
    const op = await open(await context());
    const before = (await summary(op)).state.energy;
    await pocketAction(op, "#outingBtn"); await pocketAction(op, "#outingWalk");
    assert.equal(await op.locator("#pauseDialog").evaluate(e => e.open), true);
    await op.reload(); await op.waitForFunction(() => !!window.truffle?.summary());
    assert.match(await op.locator("#why").innerText(), /Welcome back/);
    assert.equal(await op.locator("#reply").innerText(), "");
    assert.equal((await summary(op)).state.energy, before);
    await op.reload(); await op.waitForFunction(() => !!window.truffle?.summary());
    assert.doesNotMatch(await op.locator("#why").innerText(), /Welcome back/);
  });
  await check("world gift and its keyboard alternative open the same keepsake in chat", async () => {
    const gp = await open(await context({ reducedMotion: "reduce", viewport: { width: 412, height: 915 } }));
    await pocketAction(gp, "#keepsakes summary"); await pocketAction(gp, "#previewGift");
    const name = await gp.locator("#giftName").innerText();
    const before = (await summary(gp)).state.energy;
    await closePocket(gp);
    const canvas = await gp.locator("#world canvas").boundingBox();
    await gp.mouse.click(canvas.x + canvas.width * .24, canvas.y + canvas.height * .84);
    assert.equal(await gp.locator("#chatGift").isVisible(), true);
    assert.match(await gp.locator("#chatGift").innerText(), new RegExp(name));
    assert.equal(await gp.evaluate(() => document.activeElement.id), "chatGift");
    await openPocket(gp); await gp.locator(".gift-choice").focus(); await gp.keyboard.press("Enter");
    assert.equal(await gp.locator("#pocketDialog").evaluate(e => e.open), false);
    assert.equal(await gp.evaluate(() => document.activeElement.id), "chatGift");
    assert.equal((await summary(gp)).state.energy, before);
  });
  await check("normal chat uses plain energy feedback while Pocket keeps exact reply details", async () => {
    const cp = await open(await context({ reducedMotion: "reduce" }));
    await pocketAction(cp, "#walkBtn");
    await homeAction(cp, "#msg", "fill", "I noticed a bird in the shade.");
    await homeAction(cp, "#chatForm button");
    await cp.waitForFunction(() => document.querySelector("#why").textContent.includes("conversation"));
    assert.doesNotMatch(await cp.locator("#why").innerText(), /Thinking|Cost|effort/);
    assert.match(await cp.locator("#chatDetails").textContent(), /Cost 200/);
    await pocketAction(cp, "#langBtn");
    assert.doesNotMatch(await cp.locator("#why").textContent(), /التكلفة|الجهد/);
  });

} finally {
  for (const c of contexts) await c.close();
  await browser.close();
}
console.log(JSON.stringify({ tests: results.length, passed: results.filter(r => r.status === "PASS").length, results }, null, 2));
if (results.some(r => r.status === "FAIL")) process.exitCode = 1;
