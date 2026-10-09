// Identity/document authority and delayed-state regressions. All owners are synthetic.
// Run with local Vite: CHROME_BIN=/usr/bin/google-chrome node web/test/identity.browser.mjs
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.TRUFFLE_TEST_URL || "http://localhost:5191";
const api = "http://localhost:8787";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome" });
const owner = { phrase: "synthetic-retained-pet", secret: "fake-retained-secret" };
const candidate = { phrase: "synthetic-import-pet", secret: "fake-import-secret" };
const nonce = "11223344-5566-4788-99aa-bbccddeeff00";
const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, OPTIONS" };
const results = [];
const contexts = [];
let template;
async function check(name, run) {
  if (process.env.IDENTITY_FILTER && !name.includes(process.env.IDENTITY_FILTER)) return;
  try { await run(); results.push({ name, status: "PASS" }); }
  catch (error) { results.push({ name, status: "FAIL", error: String(error.message || error).slice(0, 1500) }); }
}
async function context(native = true) {
  const c = await browser.newContext({ viewport: { width: 430, height: 950 }, locale: "en-US", reducedMotion: "reduce",
    ...(native ? { userAgent: "Android TruffleApp/0.4" } : {}) });
  contexts.push(c);
  c.setDefaultTimeout(7000);
  await c.route("**/*", route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  await c.addInitScript(() => localStorage.setItem("truffle.lang", JSON.stringify("en")));
  return c;
}
async function harness({ native = true, status = 200, generation = 2, demo = false, saved = true } = {}) {
  const c = await context(native);
  if (saved) await c.addInitScript(value => {
    if (!sessionStorage.getItem("identity-seeded")) {
      localStorage.setItem("truffle.creds", JSON.stringify(value));
      sessionStorage.setItem("identity-seeded", "1");
    }
  }, owner);
  const h = { status, paired: 0, reads: 0, hold: false, release: null, held: null,
    fixture: { ...structuredClone(template), demo, generation, state: { ...template.state, stage: "Truffle", energy: 4000, steps_today: 4000, lifetime_steps: 4000 }, mood: "content", tier: "high", energy_pct: 67 },
    requests: [] };
  // Missing companion capability deliberately exercises the supported older API.
  delete h.fixture.companion;
  await c.route(api + "/**", async route => {
    const req = route.request(); const url = new URL(req.url());
    h.requests.push({ url: req.url(), method: req.method(), headers: req.headers() });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname === "/health") return route.fulfill({ json: { ok: true }, headers });
    if (url.pathname === "/pair") { h.paired++; return route.fulfill({ status: 500, json: { error: "Unexpected synthetic pairing" }, headers }); }
    if (url.pathname === "/state") {
      h.reads++;
      const snapshot = structuredClone(h.fixture);
      if (h.hold) {
        h.hold = false;
        await new Promise(resolve => { h.release = resolve; h.held = true; });
      }
      return route.fulfill({ status: h.status, json: h.status === 200 ? snapshot : { error: "Synthetic verification failure" }, headers });
    }
    if (url.pathname === "/chat") {
      h.fixture.state.energy = 3900;
      return route.fulfill({ contentType: "text/event-stream", headers,
        body: `event: token\ndata: {"text":"Synthetic reply."}\n\nevent: done\ndata: ${JSON.stringify({ tier: "low", spent: 100, brain: "test", summary: h.fixture })}\n\n` });
    }
    return route.fulfill({ status: 404, json: { error: "Synthetic unsupported route" }, headers });
  });
  h.page = await c.newPage();
  h.page.on("dialog", dialog => dialog.accept());
  h.open = async (hash = `#creds=${candidate.phrase}.${candidate.secret}&native_scope=${nonce}`) => {
    await h.page.goto(base + "/" + hash);
    await h.page.waitForFunction(() => !!window.truffle?.summary() || !document.querySelector("#recovery").hidden);
    await h.page.evaluate(() => document.fonts.ready);
  };
  h.saved = () => h.page.evaluate(() => JSON.parse(localStorage.getItem("truffle.creds")));
  return h;
}
const pixels = page => page.locator("#world canvas").evaluate(canvas => canvas.toDataURL());
async function movement(page, scope = nonce, eventId = "native:1") {
  await page.evaluate(({ scope, eventId }) => window.dispatchEvent(new CustomEvent("truffle:native-movement", {
    detail: { version: 1, scope, eventId, delta: 3, intervalMs: 1000, observedAt: Date.now() },
  })), { scope, eventId });
}
const state = page => page.evaluate(() => window.truffle.summary());
async function fresh(h) {
  const count = h.reads;
  await h.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await h.page.waitForFunction(() => !!window.truffle.summary());
  await assertPoll(() => h.reads > count);
  await h.page.waitForTimeout(80);
}
async function assertPoll(fn) {
  const until = Date.now() + 5000;
  while (!fn() && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(fn(), "Expected intercepted request did not arrive");
}
try {
  const c = await context(false);
  const p = await c.newPage();
  await p.goto(base + "/demo?mock=1&scene=content");
  await p.waitForFunction(() => !!window.truffle?.summary());
  template = await state(p);
  await c.close();

  await check("verified native import grants only its nonce and never changes food", async () => {
    const h = await harness(); await h.open(); await fresh(h);
    assert.deepEqual(await h.saved(), candidate);
    assert.equal(new URL(h.page.url()).hash, "");
    assert.equal(h.paired, 0);
    assert.ok(h.requests.every(req => !req.url.includes(candidate.secret) && !Object.values(req.headers).some(value => value.includes("#creds="))));
    const before = await pixels(h.page), health = await state(h.page);
    await movement(h.page, "00112233-4455-4677-8899-aabbccddeeff");
    assert.equal(await pixels(h.page), before);
    await movement(h.page);
    assert.notEqual(await pixels(h.page), before, "A current native event must visibly smile");
    assert.deepEqual(await state(h.page), health, "Movement is presentation only");
    await h.page.reload(); await h.page.waitForFunction(() => !!window.truffle?.summary()); await fresh(h);
    const reloaded = await pixels(h.page);
    await movement(h.page, nonce, "native:after-reload");
    assert.equal(await pixels(h.page), reloaded, "Persisted pet credentials must not restore a document nonce");
  });

  await check("generation changes revoke this document's native authority", async () => {
    const h = await harness(); await h.open(); await fresh(h);
    h.fixture.generation = 3; await fresh(h);
    assert.equal((await state(h.page)).generation, 3);
    const before = await pixels(h.page); await movement(h.page);
    assert.equal(await pixels(h.page), before);
    h.fixture.generation = 2; h.fixture.state.energy = 7777; await fresh(h);
    assert.equal((await state(h.page)).generation, 3);
    assert.equal((await state(h.page)).state.energy, 4000);
  });

  await check("a replacement fragment requires a new document to verify the next native nonce", async () => {
    const h = await harness(); await h.open(); await fresh(h);
    const nextNonce = "00112233-4455-4677-8899-aabbccddeeff";
    const reads = h.reads;
    await h.page.goto(`${base}/#creds=${candidate.phrase}.${candidate.secret}&native_scope=${nextNonce}`);
    assert.equal(h.reads, reads, "A hash-only navigation does not rerun import verification");
    assert.ok(new URL(h.page.url()).hash.includes("native_scope="));
    const before = await pixels(h.page); await movement(h.page, nextNonce);
    assert.equal(await pixels(h.page), before, "The unchanged document must reject a replacement nonce");
    await h.page.reload(); await h.page.waitForFunction(() => !!window.truffle?.summary()); await fresh(h);
    assert.equal(new URL(h.page.url()).hash, "");
    assert.deepEqual(await h.saved(), candidate);
    assert.ok(h.reads > reads);
    const renewed = await pixels(h.page); await movement(h.page, nextNonce, "native:renewed");
    assert.notEqual(await pixels(h.page), renewed);
    assert.equal(h.paired, 0);
  });

  await check("pending verification preserves the chosen pet and grants no early event authority", async () => {
    const h = await harness(); h.hold = true;
    await h.page.goto(`${base}/#creds=${candidate.phrase}.${candidate.secret}&native_scope=${nonce}`);
    await assertPoll(() => h.held);
    assert.deepEqual(await h.saved(), owner);
    assert.equal(await state(h.page), null);
    assert.equal(new URL(h.page.url()).hash, "");
    await movement(h.page);
    h.release();
    await h.page.waitForFunction(() => !!window.truffle.summary()); await fresh(h);
    const before = await pixels(h.page);
    await movement(h.page, nonce, "native:after-verification");
    assert.notEqual(await pixels(h.page), before, "The early event must not be replayed or consume the native reaction");
    assert.deepEqual(await h.saved(), candidate);
    assert.equal(h.paired, 0);
  });

  for (const [label, options] of [["ordinary browser", { native: false }], ["legacy generation", { generation: undefined }]]) {
    await check(`${label} never gains native authority from a fragment`, async () => {
      const h = await harness(options);
      if (label === "legacy generation") delete h.fixture.generation;
      await h.open(); await fresh(h);
      const before = await pixels(h.page); await movement(h.page);
      assert.equal(await pixels(h.page), before);
      assert.deepEqual(await h.saved(), candidate);
    });
  }

  for (const [label, options] of [["401", { status: 401 }], ["temporary failure", { status: 503 }], ["demo response", { demo: true }]]) {
    await check(`${label} cannot adopt an import or replace the chosen pet`, async () => {
      const h = await harness(options); await h.open();
      assert.deepEqual(await h.saved(), owner);
      assert.equal(await state(h.page), null);
      assert.equal(h.paired, 0);
      assert.equal(new URL(h.page.url()).hash, "");
      await movement(h.page);
      await h.page.reload(); await h.page.locator("#recovery").waitFor({ state: "visible" });
      assert.deepEqual(await h.saved(), owner);
      assert.equal(h.paired, 0);
      assert.equal(await state(h.page), null);
    });
  }

  await check("duplicate native scope is stripped and fails closed", async () => {
    const h = await harness();
    await h.open(`#creds=${candidate.phrase}.${candidate.secret}&native_scope=${nonce}&native_scope=${nonce}`);
    assert.deepEqual(await h.saved(), owner);
    assert.equal(await state(h.page), null);
    assert.equal(h.reads, 0);
    assert.equal(h.paired, 0);
    assert.equal(new URL(h.page.url()).hash, "");
  });

  await check("late pre-chat poll cannot restore spent food", async () => {
    const h = await harness({ native: false }); await h.open(""); await fresh(h);
    h.hold = true;
    await h.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await assertPoll(() => h.held);
    await h.page.locator("#msg").fill("hello");
    await h.page.locator("#chatForm button").click();
    await h.page.waitForFunction(() => window.truffle.summary().state.energy === 3900 && !document.querySelector("#chatForm button").disabled);
    h.release();
    await h.page.waitForTimeout(150);
    assert.equal((await state(h.page)).state.energy, 3900, "Delayed poll restored the pre-chat food balance");
    assert.deepEqual(await h.saved(), owner);
    assert.equal(h.paired, 0);
  });

  await check("late older poll cannot replace a newer same-generation snapshot", async () => {
    const h = await harness({ native: false }); await h.open(""); await fresh(h);
    h.hold = true;
    await h.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await assertPoll(() => h.held);
    h.fixture.state.energy = 3800;
    await fresh(h);
    assert.equal((await state(h.page)).state.energy, 3800);
    h.release();
    await h.page.waitForTimeout(150);
    assert.equal((await state(h.page)).state.energy, 3800);
    assert.deepEqual(await h.saved(), owner);
    assert.equal(h.paired, 0);
  });
} finally {
  await Promise.allSettled(contexts.map(c => c.close()));
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
if (results.some(result => result.status === "FAIL")) process.exitCode = 1;
