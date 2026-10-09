// V2 application integration in real desktop Chrome. All API traffic is synthetic.
// CHROME_BIN=/usr/bin/google-chrome node web/test/companion-v2.browser.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.TRUFFLE_TEST_URL || "http://localhost:5191";
const api = "http://localhost:8787";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome" });
const contexts = [], results = [];
const owner = { phrase: "synthetic-v2-owner", secret: "synthetic-v2-secret" };
const other = { phrase: "synthetic-other-owner", secret: "synthetic-other-secret" };
const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, OPTIONS" };
const clone = value => structuredClone(value);
const context = async () => {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", locale: "en-US" });
  contexts.push(c);
  c.setDefaultTimeout(7000);
  await c.route("**/*", route => [new URL(base).origin, api].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  return c;
};
const check = async (name, run) => {
  try { await run(); results.push({ name, status: "PASS" }); }
  catch (e) { results.push({ name, status: "FAIL", error: String(e.stack || e).slice(0, 1600) }); }
};
const until = async predicate => {
  for (let n = 0; n < 140; n++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
  assert.ok(predicate(), "Synthetic transport condition did not settle");
};
const summary = p => p.evaluate(() => window.truffle.summary());
const openPocket = async p => { if (!await p.locator("#pocketDialog").evaluate(e => e.open)) await p.locator("#pocketBtn").click(); };
const closePocket = async p => { if (await p.locator("#pocketDialog").evaluate(e => e.open)) await p.locator("#pocketClose").click(); };
const gift = (id, generation, name) => ({ id, generation, day: "2026-10-09", created_ms: 1791532800000,
  art: "  .-.\n ( * )\n  '-'", text: { en: { name, note: "An authored synthetic fixture note." }, ar: { name: "هدية تجريبية", note: "رسالة تجريبية مكتوبة مسبقًا." } },
  provenance: { art: "procedural", note: "authored", version: 1 } });
let template;
const harness = async ({ gifts = [], legacy = false, holdAway = false, holdChat = false, failAway = false, giftedToday = false } = {}) => {
  const c = await context();
  await c.addInitScript(({ owner, legacy }) => {
    if (sessionStorage.getItem("v2-seeded")) return;
    localStorage.setItem("truffle.creds", JSON.stringify(owner));
    localStorage.setItem("truffle.lang", JSON.stringify("en"));
    if (legacy) localStorage.setItem(`truffle.keepsakes@http://localhost:8787/real/${owner.phrase}`, JSON.stringify({ version: 1,
      seen: Date.now() - 660_000, gifts: [{ kind: "fern", day: "2026-10-08", at: Date.now() - 86_400_000 }] }));
    sessionStorage.setItem("v2-seeded", "1");
  }, { owner, legacy });
  const initial = () => ({ ...clone(template), demo: false, generation: 7, mood: "content", tier: "high", energy_max: 12_000,
    energy_pct: 50, state: { ...clone(template.state), energy_version: 2, energy: 6000, dead: false, burrowed: false },
    companion: { pending: null, gifts: clone(gifts) } });
  const states = { [owner.phrase]: initial(), [other.phrase]: initial() };
  states[other.phrase].companion.gifts = [gift("other-gift", 7, "Other owner's gift")];
  const calls = [], errors = [];
  let releaseAway, releaseChat;
  const awayGate = holdAway ? new Promise(resolve => { releaseAway = resolve; }) : Promise.resolve();
  const chatGate = holdChat ? new Promise(resolve => { releaseChat = resolve; }) : Promise.resolve();
  await c.route(`${api}/**`, async route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const body = req.postData() ? req.postDataJSON() : null;
    calls.push({ path: url.pathname, method: req.method(), body, secret: req.headers()["x-truffle-secret"] });
    if (url.pathname === "/health") return route.fulfill({ json: { ok: true }, headers });
    const phrase = body?.phrase || url.searchParams.get("phrase"), state = states[phrase];
    if (!state) return route.fulfill({ status: 404, json: { error: "unknown synthetic owner" }, headers });
    if (url.pathname === "/state") return route.fulfill({ json: clone(state), headers });
    if (url.pathname === "/companion") {
      if (body.action === "away") {
        await awayGate;
        if (failAway) return route.fulfill({ status: 503, json: { error: "synthetic schedule unavailable" }, headers });
        state.companion.pending = giftedToday ? null : { id: `job-${calls.length}`, intent: body.intent, due_ms: Date.now() + 600_000 };
      } else state.companion.pending = null;
      return route.fulfill({ json: clone(state), headers });
    }
    if (url.pathname === "/chat") {
      await chatGate;
      const tier = body.requested_tier || "medium", spent = { low: 20, medium: 60, high: 200 }[tier];
      state.state.energy -= spent; state.energy_pct = state.state.energy / state.energy_max * 100;
      const done = { tier, spent, brain: "synthetic-v2", summary: clone(state), partial: false, half_awake: false };
      return route.fulfill({ headers, contentType: "text/event-stream", body: `event: token\ndata: ${JSON.stringify({ text: "One synthetic reply." })}\n\nevent: done\ndata: ${JSON.stringify(done)}\n\n` });
    }
    return route.fulfill({ status: 404, json: { error: "unsupported synthetic route" }, headers });
  });
  const p = await c.newPage();
  p.on("pageerror", error => errors.push(error.message));
  p.on("dialog", dialog => dialog.accept());
  await p.goto(base + "/");
  await p.waitForFunction(() => !!window.truffle?.summary());
  await until(() => calls.filter(x => x.path === "/state").length >= 2);
  const send = async message => {
    await closePocket(p);
    await p.locator("#msg").fill(message);
    await p.locator("#chatForm button").click();
    await p.waitForFunction(() => document.querySelector("#reply").textContent === "One synthetic reply." && !document.querySelector("#chatForm button").disabled);
  };
  const refresh = async () => {
    const before = calls.filter(x => x.path === "/state").length;
    await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await until(() => calls.filter(x => x.path === "/state").length > before);
  };
  return { p, c, states, calls, errors, send, refresh, releaseAway, releaseChat };
};

try {
  const seed = await context(), p = await seed.newPage();
  await p.goto(base + "/demo?mock=1&scene=content");
  await p.waitForFunction(() => !!window.truffle?.summary());
  template = await summary(p);
  await seed.close();

  await check("server gifts use authenticated owner and current generation; device gifts remain labelled archive", async () => {
    const h = await harness({ legacy: true, gifts: [gift("current", 7, "Current life gift"), gift("stale", 6, "Stale life gift")] });
    await openPocket(h.p); await h.p.locator("#keepsakes summary").click();
    assert.equal(await h.p.locator("#giftCount").innerText(), "2");
    assert.equal(await h.p.locator(".gift-choice").count(), 2);
    assert.doesNotMatch(await h.p.locator("#giftList").innerText(), /Stale/);
    assert.equal(await h.p.locator("#previewGift").isHidden(), true);
    await h.p.locator('[data-gift="server:7:current"]').click();
    assert.match(await h.p.locator("#chatGift").innerText(), /Current life gift.*procedural drawing.*No AI model or food cost/s);
    await openPocket(h.p); await h.p.locator('[data-gift^="legacy:"]').click();
    assert.match(await h.p.locator("#chatGift").innerText(), /archive.*saved on this device/s);
    assert.equal((await summary(h.p)).state.energy, 6000);
    assert.equal(h.calls.filter(x => x.path === "/chat").length, 0);
    assert.ok(h.calls.filter(x => ["/state", "/companion"].includes(x.path)).every(x => x.secret === owner.secret));
    assert.deepEqual(h.errors, []);
  });

  await check("a fresh life clears open server gifts and never promotes an old life response", async () => {
    const h = await harness({ legacy: true, gifts: [gift("old", 7, "Previous life gift")] });
    await openPocket(h.p); await h.p.locator("#keepsakes summary").click();
    await h.p.locator('[data-gift="server:7:old"]').click();
    h.states[owner.phrase].generation = 8;
    h.states[owner.phrase].companion.gifts = [gift("old", 7, "Previous life gift"), gift("new", 8, "New life gift")];
    await h.refresh();
    await h.p.waitForFunction(() => window.truffle.summary().generation === 8);
    assert.equal(await h.p.locator("#chatGift").isHidden(), true);
    assert.equal(await h.p.locator('[data-gift="server:7:old"]').count(), 0);
    assert.equal(await h.p.locator('[data-gift="server:8:new"]').count(), 1);
    assert.equal(await h.p.locator('[data-gift^="legacy:"]').count(), 1);
    h.states[owner.phrase].generation = 7;
    await h.refresh();
    assert.equal((await summary(h.p)).generation, 8);
    assert.equal(await h.p.locator('[data-gift="server:8:new"]').count(), 1);
  });

  await check("verified owner change scopes server gifts and device archives to the new pet", async () => {
    const h = await harness({ legacy: true, gifts: [gift("first", 7, "First owner's gift")] });
    // A handoff opens a new document; changing only the hash does not rerun boot.
    await h.p.goto(`${base}/?synthetic-import=other#creds=${other.phrase}.${other.secret}`);
    await h.p.waitForFunction(() => !!window.truffle?.summary() && document.querySelector("#phrase").textContent === "synthetic-other-owner");
    await openPocket(h.p); await h.p.locator("#keepsakes summary").click();
    assert.equal(await h.p.locator("#giftCount").innerText(), "1");
    assert.match(await h.p.locator("#giftList").innerText(), /Other owner's gift/);
    assert.doesNotMatch(await h.p.locator("#giftList").innerText(), /First owner|paper fern/i);
    const imported = h.calls.filter(x => x.secret === other.secret);
    assert.ok(imported.some(x => x.path === "/state"));
    assert.equal(h.calls.some(x => ["/pair", "/demo/spawn"].includes(x.path)), false);
  });

  await check("natural chat sends exactly once and schedules one owned job only after its server receipt", async () => {
    const h = await harness({ holdAway: true, holdChat: true });
    await h.p.locator("#msg").fill("I'm heading to the grocery store");
    await h.p.evaluate(() => { document.querySelector("#chatForm").requestSubmit(); document.querySelector("#chatForm").requestSubmit(); });
    await until(() => h.calls.some(x => x.path === "/chat") && h.calls.some(x => x.body?.action === "away"));
    assert.equal(h.calls.filter(x => x.path === "/chat").length, 1);
    const away = h.calls.filter(x => x.body?.action === "away");
    assert.equal(away.length, 1); assert.equal(away[0].body.intent, "errand");
    assert.equal(away[0].body.generation, 7); assert.equal(away[0].body.phrase, owner.phrase);
    assert.equal(away[0].secret, owner.secret); assert.match(away[0].body.client_request_id, /^[a-f0-9-]{36}$/);
    assert.equal(await h.p.locator("#companionNote").isHidden(), true, "Normal chat is the only verbal reply");
    assert.equal(await h.p.locator("#giftPending").evaluate(e => e.hidden), true, "No optimistic server promise");
    h.releaseAway();
    await h.p.waitForFunction(() => !document.querySelector("#giftPending").hidden);
    h.releaseChat();
    await h.p.waitForFunction(() => document.querySelector("#reply").textContent === "One synthetic reply." && !document.querySelector("#chatForm button").disabled);
    assert.equal((await summary(h.p)).state.energy, 5940);
    await h.send("I'm back from the grocery store");
    const returns = h.calls.filter(x => x.body?.action === "return" && x.body?.job_id);
    assert.equal(returns.length, 1); assert.match(returns[0].body.job_id, /^job-/);
    assert.equal(returns[0].body.generation, 7);
    assert.equal(h.calls.filter(x => x.path === "/chat").length, 2);
    assert.equal(h.calls.filter(x => x.body?.action === "away").length, 1);
    assert.equal(await h.p.locator("#companionNote").isHidden(), true);
    assert.equal((await summary(h.p)).state.energy, 5880);
  });

  await check("uncertain speech never schedules work; quiet preference cancels and persists across reload", async () => {
    const h = await harness();
    await h.send("Maybe I'm going for a walk");
    assert.equal(h.calls.filter(x => x.body?.action === "away").length, 0);
    await h.send("أنا رايح للبقالة");
    await until(() => h.calls.some(x => x.body?.action === "away"));
    assert.equal(h.calls.find(x => x.body?.action === "away").body.intent, "errand");
    await h.send("Could you stop reminding me?");
    await until(() => h.calls.some(x => x.body?.action === "cancel"));
    assert.match(await h.p.locator("#companionNote").innerText(), /notes quiet/);
    await h.p.reload(); await h.p.waitForFunction(() => !!window.truffle?.summary());
    await h.send("I'm going for a walk");
    assert.equal(h.calls.filter(x => x.body?.action === "away").length, 1);
    assert.equal(h.calls.filter(x => x.path === "/chat").length, 4, "Quiet notes do not block normal conversation");
  });

  await check("failed gift scheduling makes no pending or earned-gift claim and preserves normal chat", async () => {
    const h = await harness({ failAway: true });
    await h.send("I'm going for a walk");
    await h.p.waitForFunction(() => !document.querySelector("#giftPending").hidden);
    assert.equal((await summary(h.p)).companion.pending, null);
    assert.equal(await h.p.locator("#giftCount").innerText(), "0");
    assert.match(await h.p.locator("#giftPending").textContent(), /couldn't|could not|unavailable|later/i);
    assert.equal(await h.p.locator("#reply").innerText(), "One synthetic reply.");
    assert.equal(await h.p.locator("#chatForm button").isEnabled(), true);
  });

  await check("an already-gifted day acknowledges another away quietly without a new job or gift", async () => {
    const h = await harness({ giftedToday: true, gifts: [gift("daily-gift", 7, "Today's only gift")] });
    await h.send("I'm going for a walk");
    await until(() => h.calls.some(x => x.body?.action === "away"));
    assert.equal((await summary(h.p)).companion.pending, null);
    assert.equal(await h.p.locator("#giftCount").innerText(), "1");
    assert.equal(await h.p.locator("#giftPending").evaluate(e => e.hidden), true);
    assert.equal(await h.p.locator("#companionNote").isHidden(), true);
    assert.equal(await h.p.locator("#reply").innerText(), "One synthetic reply.");
    assert.deepEqual((await summary(h.p)).companion.gifts.map(g => g.id), ["daily-gift"]);
  });

  await check("food reserve, reply ceiling, greeting price and explicit deep effort are distinct", async () => {
    const h = await harness();
    assert.match(await h.p.locator("#energyTrack").getAttribute("aria-valuetext"), /6,000 of 12,000 food points/);
    assert.equal(await h.p.locator("#foodReserve").textContent(), "About 6 days of quiet use.");
    assert.match(await h.p.locator('[data-c="foodReserveNote"]').textContent(), /rough reserve.*before chats.*Heat shelter pauses/i);
    assert.match(await h.p.locator("#effortPrice").innerText(), /up to 60 points per reply/);
    assert.equal(await h.p.locator("#ask").inputValue(), "");
    await h.send("hello");
    assert.equal(h.calls.filter(x => x.path === "/chat").at(-1).body.requested_tier, "low");
    assert.match(await h.p.locator("#chatDetails").textContent(), /Actual cost 20 food/);
    await h.send("Tell me about that little cloud");
    assert.equal(h.calls.filter(x => x.path === "/chat").at(-1).body.requested_tier, "medium");
    assert.match(await h.p.locator("#chatDetails").textContent(), /Actual cost 60 food/);
    await h.p.locator("#ask").selectOption("high");
    assert.match(await h.p.locator("#effortPrice").innerText(), /up to 200 points per reply/);
    await h.send("Help me think through a difficult decision");
    assert.equal(h.calls.filter(x => x.path === "/chat").at(-1).body.requested_tier, "high");
    assert.match(await h.p.locator("#chatDetails").textContent(), /Actual cost 200 food/);
    assert.equal((await summary(h.p)).state.energy, 5720);
    await openPocket(h.p); await h.p.locator("#langBtn").click(); await closePocket(h.p);
    assert.match(await h.p.locator("#effortPrice").innerText(), /٢٠٠/);
    assert.match(await h.p.locator("#world").getAttribute("aria-label"), /طعام/);
    assert.equal(await h.p.locator("#app").getAttribute("dir"), "rtl");
    assert.deepEqual(h.errors, []);
  });
} finally {
  for (const c of contexts) await c.close();
  await browser.close();
}
console.log(JSON.stringify({ tests: results.length, passed: results.filter(r => r.status === "PASS").length, results }, null, 2));
if (results.some(r => r.status === "FAIL")) process.exitCode = 1;
