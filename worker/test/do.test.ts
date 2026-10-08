// Durable Object regressions for the S11 red-team findings (packet B09).
// Test IDs follow fleet/outbox/S11/proposed_tests.md. Real TruffleDO and
// askBrain code; fake SQLite host, clock, Workers AI and Open-Meteo.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import muscat from "./fixtures/open-meteo-muscat.json";
import { hasVisibleText } from "../src/brain";
import { parseForecast } from "../src/weather";
import {
  advance,
  clock,
  Deferred,
  FakeAI,
  FakeFetch,
  readEvents,
  settle,
  startChat,
  until,
  truffle,
  useClock,
  type Fixture,
  type SseEvent,
  type Step
} from "./helpers/do-harness";

let net: FakeFetch;

beforeEach(() => {
  useClock("2026-10-08T08:00:00Z"); // 12:00 in Muscat
  net = new FakeFetch();
  net.install();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const names = (evs: SseEvent[]) => evs.map((e) => e.event);
const last = (evs: SseEvent[]) => evs[evs.length - 1];
const LIVE_HIGH = { energy: 3600, lifetime_steps: 3600 }; // Spore, 60% of 6000: high allowed

async function finishHeld(held: { push(t: string): void; end(): void }, text = "Hello from the sand.") {
  held.push(text);
  held.end();
}

// ---------- D01 ----------

describe("D01 pending chat admission and deadline (S11-01)", () => {
  it("an unread response reaches its deadline and returns its unused demo slot", async () => {
    const f = await truffle({ state: LIVE_HIGH, meta: { demo: true } });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const held = f.ai.hold();
    const result = await f.obj.chat(f.secret, "Hello Truffle.", "low", "en");
    if (!result.ok) throw new Error(result.error);
    await settle();
    expect(f.meta().demo_replies?.count).toBe(1);
    await vi.advanceTimersByTimeAsync(60_001);
    let drained = false;
    const done = f.drain().then(() => { drained = true; });
    await settle();
    const releasedOnTime = f.meta().chat === undefined;
    const refundedOnTime = f.meta().demo_replies?.count;
    const drainedOnTime = drained;
    // Clean up the fixture even when the old implementation is stuck writing.
    await result.value.cancel();
    await done;
    expect(held.aborted).toBe(true);
    expect(drainedOnTime).toBe(true);
    expect(releasedOnTime).toBe(true);
    expect(refundedOnTime).toBe(0);
    expect(f.state().energy).toBe(3600);
    expect(f.turns()).toEqual([]);
  });

  it("a paused downstream cannot stall partial charging or deadline cleanup", async () => {
    const f = await truffle({ state: LIVE_HIGH, meta: { demo: true } });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const held = f.ai.hold();
    const result = await f.obj.chat(f.secret, "Hello Truffle.", "low", "en");
    if (!result.ok) throw new Error(result.error);
    const reader = result.value.getReader();
    await reader.read(); // brain event
    held.push("First words.");
    await reader.read(); // first token reaches the browser
    held.push(" More words.");
    await settle(); // the browser now stops reading without disconnecting
    await vi.advanceTimersByTimeAsync(60_001);
    let drained = false;
    const done = f.drain().then(() => { drained = true; });
    await settle();
    const drainedOnTime = drained;
    const releasedOnTime = f.meta().chat === undefined;
    const energyOnTime = f.state().energy;
    await reader.cancel();
    await done;
    expect(held.aborted).toBe(true);
    expect(drainedOnTime).toBe(true);
    expect(releasedOnTime).toBe(true);
    expect(energyOnTime).toBe(3580);
    expect(f.meta().demo_replies?.count).toBe(1);
    expect(f.turns()).toEqual([
      { role: "user", content: "Hello Truffle." },
      { role: "assistant", content: "First words. More words." }
    ]);
    expect(f.logs("chat")).toHaveLength(1);
    expect(f.logs("chat")[0]).toMatchObject({ spent: 20, partial: true });
  });

  it("a second chat gets 429 while the first is in flight", async () => {
    const f = await truffle({ state: LIVE_HIGH });
    const held = f.ai.hold();
    const a = await startChat(f, "high");
    expect(a.status).toBe(200);
    await settle();
    const b = await startChat(f, "low");
    expect(b.status).toBe(429);
    await finishHeld(held);
    expect(last(await a.events!).event).toBe("done");
    await f.drain();
    expect(f.state().energy).toBe(3400);
    expect(f.meta().chat).toBeUndefined();
  });

  it("past the deadline the old call is aborted and fenced before the new one starts", async () => {
    const f = await truffle({ state: LIVE_HIGH });
    const first = f.ai.hold();
    const a = await startChat(f, "high");
    await settle();
    expect(f.ai.calls[0].options?.signal).toBeInstanceOf(AbortSignal);
    advance(61_000);
    const second = f.ai.hold();
    const c = await startChat(f, "high");
    expect(c.status).toBe(200);
    await settle();
    expect(first.aborted).toBe(true);
    const owner = f.meta().chat?.id;
    expect(owner).toBeTruthy();
    // The old finalizer has run by now. It must not have released the new slot.
    first.push("late words");
    first.end();
    const evA = await a.events!;
    expect(names(evA)).not.toContain("done");
    expect(last(evA).event).toBe("error");
    expect(f.meta().chat?.id).toBe(owner);
    await finishHeld(second);
    expect(last(await c.events!).event).toBe("done");
    await f.drain();
    expect(f.state().energy).toBe(3400); // one charge: the second chat only
    expect(f.turns()).toHaveLength(2);
    expect(f.meta().chat).toBeUndefined();
  });

  it("one event then a stall: the whole-reply deadline still applies", async () => {
    const f = await truffle({ state: LIVE_HIGH });
    const first = f.ai.hold();
    const a = await startChat(f, "high");
    first.push("Hel");
    await settle();
    advance(61_000);
    const c = await startChat(f, "high");
    expect(c.status).toBe(200);
    const evA = await a.events!;
    expect(evA.filter((e) => e.event === "token").map((e) => e.data.t)).toEqual(["Hel"]);
    expect(last(evA).event).toBe("error");
    expect(last(await c.events!).event).toBe("done");
    await f.drain();
    expect(f.state().energy).toBe(3400);
    expect(f.logs("chat")).toHaveLength(1);
  });

  it("sequential chats: high costs 200, then medium costs 60", async () => {
    const f = await truffle({ state: LIVE_HIGH });
    const a = await startChat(f);
    expect(last(await a.events!).data.tier).toBe("high");
    await f.drain();
    const b = await startChat(f);
    expect(last(await b.events!).data.tier).toBe("medium");
    await f.drain();
    expect(f.state().energy).toBe(3340);
  });

  it("a feed that lands during inference is kept", async () => {
    const f = await truffle({ state: LIVE_HIGH });
    const held = f.ai.hold();
    const a = await startChat(f, "high");
    await settle();
    const fed = await f.obj.feed({ day: "2026-10-08", day_tz: "Asia/Muscat", total: 500 });
    expect(fed.ok).toBe(true);
    await finishHeld(held);
    await a.events;
    await f.drain();
    expect(f.state().energy).toBe(3600 + 500 - 200);
  });
});

// ---------- D02 ----------

describe("D02 demo quota reservation and finalization (S11-01)", () => {
  const demo = (count: number, energy = 3600) =>
    truffle({ state: { energy, lifetime_steps: energy }, meta: { demo: true, demo_replies: { start_ms: clock.now, count } } });

  it("the 30th reply is reserved at admission; no second reply can be pending against it", async () => {
    const f = await demo(29);
    const held = f.ai.hold();
    const a = await startChat(f, "low");
    expect(a.status).toBe(200);
    expect(f.meta().demo_replies!.count).toBe(30);
    advance(61_000);
    // The deadline cancels the held call, but its slot is still reserved
    // while it winds down, so this request is refused.
    const b = await startChat(f, "low");
    expect(b.status).toBe(429);
    expect(f.meta().demo_replies!.count).toBeLessThanOrEqual(30);
    expect(last(await a.events!).event).toBe("error");
    await f.drain();
    expect(held.aborted).toBe(true);
    // It produced no text, so its reservation came back.
    expect(f.meta().demo_replies!.count).toBe(29);
    const c = await startChat(f, "low");
    expect(c.status).toBe(200);
    expect(f.meta().demo_replies!.count).toBe(30);
    expect(last(await c.events!).event).toBe("done");
    await f.drain();
    expect(f.meta().demo_replies!.count).toBe(30);
    const d = await startChat(f, "low");
    expect(d.status).toBe(429);
    expect(f.logs("chat")).toHaveLength(1); // 29 seeded + 1 = 30 completed
  });

  it("a held 30th reply blocks a 31st even after the lock deadline", async () => {
    const f = await demo(29);
    const held = f.ai.hold();
    const a = await startChat(f, "low");
    held.push("still talking");
    await settle();
    advance(61_000);
    const b = await startChat(f, "low");
    // The held call is aborted and fenced. It showed text, so its reservation
    // stays used and the next request is over quota.
    expect(b.status).toBe(429);
    expect(b.error).toMatch(/30 replies/);
    await a.events;
    await f.drain();
    expect(f.meta().demo_replies!.count).toBe(30);
    expect(f.state().energy).toBe(3600); // the fenced reply was not charged
  });

  it("an empty failure releases its reservation", async () => {
    const f = await demo(29);
    f.ai.script.push({ kind: "text", parts: [] }, { kind: "text", parts: [] });
    const a = await startChat(f, "low");
    expect(last(await a.events!).event).toBe("error");
    await f.drain();
    expect(f.meta().demo_replies!.count).toBe(29);
    expect(f.meta().chat).toBeUndefined();
  });

  it("a refused request never counts as a reply", async () => {
    const f = await demo(30);
    const a = await startChat(f, "low");
    expect(a.status).toBe(429);
    expect(f.meta().demo_replies!.count).toBe(30);
    expect(f.ai.calls).toHaveLength(0);
  });

  it("canned asleep lines use no reply slot", async () => {
    const f = await demo(5, 0);
    const a = await startChat(f);
    expect(last(await a.events!).data.brain).toBe("none");
    await f.drain();
    expect(f.meta().demo_replies!.count).toBe(5);
  });

  it("reset, slider, heat and midnight keep the paid-work counters", async () => {
    const f = await demo(12);
    await f.obj.setSteps(f.secret, 4000);
    await f.obj.setHeat(f.secret, true);
    await f.obj.forceMidnight(f.secret);
    await f.obj.reset(f.secret);
    expect(f.meta().demo_replies!.count).toBe(12);
  });
});

// ---------- D03 ----------

describe("D03 generation fencing covers the whole completion (S11-02)", () => {
  it("demo: a reply released after reset changes nothing in the new life", async () => {
    const f = await truffle({ state: LIVE_HIGH, meta: { demo: true } });
    f.ai.facts = ["Has a cat named Miso"];
    const held = f.ai.hold();
    const a = await startChat(f, "high");
    await settle();
    expect((await f.obj.reset(f.secret)).ok).toBe(true);
    expect((await f.obj.setSteps(f.secret, 3000)).ok).toBe(true);
    await finishHeld(held, "Old life words.");
    const evA = await a.events!;
    expect(names(evA)).not.toContain("done");
    await f.drain();
    expect(f.state().energy).toBe(3000);
    expect(f.turns()).toHaveLength(0);
    expect(f.facts()).toHaveLength(0);
    expect(f.ai.extractions).toBe(0);
    expect(f.meta().chat).toBeUndefined();
    expect(f.logs("chat_stale")).toHaveLength(1);
  });

  it("real: death at midnight, a new spore, a feed, then the old reply", async () => {
    useClock("2026-10-08T19:55:00Z"); // 23:55 in Muscat
    const f = await truffle({ state: { energy: 1000, lifetime_steps: 1000, zero_days: 3 } });
    f.ai.facts = ["Walks at night"];
    const held = f.ai.hold();
    const a = await startChat(f, "low");
    await settle();
    useClock("2026-10-08T20:30:00Z"); // 00:30 on Oct 9
    await f.obj.alarm();
    expect(f.state().dead).toBe(true);
    expect((await f.obj.spore(f.secret)).ok).toBe(true);
    expect((await f.obj.feed({ day: "2026-10-09", day_tz: "Asia/Muscat", total: 3000 })).ok).toBe(true);
    await finishHeld(held, "Old life words.");
    const evA = await a.events!;
    expect(names(evA)).not.toContain("done");
    await f.drain();
    expect(f.state().energy).toBe(3000);
    expect(f.state().dead).toBe(false);
    expect(f.turns()).toHaveLength(0);
    expect(f.facts()).toHaveLength(0);
    expect(f.meta().chat).toBeUndefined();
  });

  it("death without a new spore: no charge, no turns", async () => {
    useClock("2026-10-08T19:55:00Z");
    const f = await truffle({ state: { energy: 1000, lifetime_steps: 1000, zero_days: 3 } });
    const held = f.ai.hold();
    const a = await startChat(f, "low");
    await settle();
    useClock("2026-10-08T20:30:00Z");
    await f.obj.alarm();
    const dead = f.state();
    await finishHeld(held);
    await a.events;
    await f.drain();
    expect(f.state()).toEqual(dead);
    expect(f.turns()).toHaveLength(0);
  });

  it("demo expiry while a reply is pending: storage stays deleted", async () => {
    const f = await truffle({
      state: LIVE_HIGH,
      meta: { demo: true, created_ms: clock.now - 24 * 3_600_000 + 30_000 }
    });
    const held = f.ai.hold();
    const a = await startChat(f, "low");
    await settle();
    advance(60_000);
    await f.obj.alarm();
    await finishHeld(held);
    await a.events;
    await f.drain();
    const tables = f.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
    expect(tables).toEqual([]);
  });
});

// ---------- D07 ----------

describe("D07 empty retry accounting matrix (S11-06)", () => {
  const text = (...parts: string[]): Step => ({ kind: "text", parts });
  const broken = (...parts: string[]): Step => ({ kind: "text", parts, errorAfter: true });
  const rows: { name: string; script: Step[]; calls: number; charged: boolean; end: string; partial?: boolean }[] = [
    { name: "visible", script: [text("Hi there.")], calls: 1, charged: true, end: "done" },
    { name: "empty then visible", script: [text(), text("Hi there.")], calls: 2, charged: true, end: "done" },
    { name: "whitespace then visible", script: [text("  "), text("Hi there.")], calls: 2, charged: true, end: "done" },
    { name: "empty then empty", script: [text(), text()], calls: 2, charged: false, end: "error" },
    { name: "whitespace then whitespace", script: [text(" ", "\n"), text("  ")], calls: 2, charged: false, end: "error" },
    { name: "whitespace then a throw", script: [text("  "), { kind: "throw" }], calls: 2, charged: false, end: "error" },
    { name: "whitespace then a stream error", script: [text("  "), broken(" ")], calls: 2, charged: false, end: "error" },
    { name: "zero-width only, twice", script: [text("​"), text("​⁠")], calls: 2, charged: false, end: "error" },
    { name: "visible then a stream error", script: [broken("Hel")], calls: 1, charged: true, end: "done", partial: true }
  ];

  for (const row of rows) {
    it(row.name, async () => {
      const f = await truffle({
        state: LIVE_HIGH,
        meta: { demo: true, demo_replies: { start_ms: clock.now, count: 3 } }
      });
      f.ai.script.push(...row.script);
      const a = await startChat(f, "medium");
      const evs = await a.events!;
      await f.drain();
      expect(f.ai.calls).toHaveLength(row.calls);
      expect(last(evs).event).toBe(row.end);
      if (row.partial) expect(last(evs).data.partial).toBe(true);
      expect(f.state().energy).toBe(row.charged ? 3540 : 3600);
      expect(f.meta().demo_replies!.count).toBe(row.charged ? 4 : 3);
      expect(f.logs("chat")).toHaveLength(row.charged ? 1 : 0);
      expect(f.turns()).toHaveLength(row.charged ? 2 : 0);
      expect(f.meta().chat).toBeUndefined();
    });
  }

  it("high retry: thinking off, the same explicit token budget", async () => {
    const f = await truffle({ state: LIVE_HIGH });
    f.ai.script.push(text(), text("Hi there."));
    const a = await startChat(f, "high");
    await a.events;
    await f.drain();
    expect(f.ai.calls.map((c) => c.input.chat_template_kwargs.enable_thinking)).toEqual([true, false]);
    expect(f.ai.calls.map((c) => c.input.max_tokens)).toEqual([2224, 2224]);
  });

  it("one shared visible-text predicate", () => {
    for (const s of ["", " ", "\n\t", "​", "⁠﻿", " "]) expect(hasVisibleText(s), JSON.stringify(s)).toBe(false);
    for (const s of ["a", " hi ", "مرحبا", "😀", "."]) expect(hasVisibleText(s), s).toBe(true);
  });
});

// ---------- M03 ----------

describe("M03 rolling memory retention (S11-08)", () => {
  async function full(day = "2026-10-01"): Promise<Fixture> {
    const f = await truffle({ state: LIVE_HIGH });
    for (let i = 1; i <= 60; i++) f.db.prepare("INSERT INTO facts (text, day_written, affection) VALUES (?, ?, 0)").run(`old fact ${i}`, day);
    return f;
  }

  it("a 61st distinct fact evicts the oldest", async () => {
    const f = await full();
    expect(f.priv.addFacts(["Likes the corniche at dusk"], "2026-10-08", 0)).toBe(1);
    const texts = f.facts().map((x) => x.text);
    expect(texts).toHaveLength(60);
    expect(texts).not.toContain("old fact 1");
    expect(texts[0]).toBe("old fact 2");
    expect(texts.at(-1)).toBe("Likes the corniche at dusk");
  });

  it("a duplicate does not evict", async () => {
    const f = await full();
    expect(f.priv.addFacts(["OLD FACT 30"], "2026-10-08", 0)).toBe(0);
    expect(f.facts()).toHaveLength(60);
    expect(f.facts()[0].text).toBe("old fact 1");
  });

  it("three new facts keep the bound at 60", async () => {
    const f = await full();
    f.priv.addFacts(["Fact a", "Fact b", "Fact c"], "2026-10-08", 0);
    expect(f.facts()).toHaveLength(60);
    expect(f.facts()[0].text).toBe("old fact 4");
  });

  it("a full old store learns a fact that low and medium see today", async () => {
    const f = await full();
    f.ai.facts = ["Likes the corniche at dusk"];
    const a = await startChat(f, "medium");
    await a.events;
    await f.drain();
    expect(f.facts()).toHaveLength(60);
    for (const tier of ["low", "medium"] as const) {
      const b = await startChat(f, tier);
      await b.events;
      await f.drain();
      expect(f.ai.calls.at(-1)!.input.messages[0].content).toContain("Likes the corniche at dusk");
    }
  });
});

// ---------- P01 ----------

describe("P01 one admitted tier across prompt and inference (S11-09, decision 0013)", () => {
  const facts: [string, string][] = [
    ["Walked the corniche today", "2026-10-08"],
    ["Has a sister in Sohar", "2026-10-05"],
    ["Grew up in Nizwa", "2026-09-20"]
  ];
  const cases = [
    { requested: "low", block: "tier=low", thinking: false, tokens: 120, seen: 1, cost: 20 },
    { requested: "medium", block: "tier=medium", thinking: false, tokens: 400, seen: 2, cost: 60 },
    { requested: "high", block: "tier=high", thinking: true, tokens: 1200 + 1024, seen: 3, cost: 200 }
  ] as const;

  for (const c of cases) {
    it(`requested ${c.requested} at 3600`, async () => {
      const f = await truffle({ state: LIVE_HIGH });
      for (const [t, d] of facts) f.db.prepare("INSERT INTO facts (text, day_written) VALUES (?, ?)").run(t, d);
      const a = await startChat(f, c.requested);
      expect(last(await a.events!).data.tier).toBe(c.requested);
      await f.drain();
      const call = f.ai.calls[0].input;
      const system = call.messages[0].content;
      expect(system).toContain(c.block);
      expect(system.match(/tier=\w+/g)).toEqual([c.block]);
      expect(call.chat_template_kwargs.enable_thinking).toBe(c.thinking);
      expect(call.max_tokens).toBe(c.tokens);
      expect(facts.filter(([t]) => system.includes(t))).toHaveLength(c.seen);
      expect(f.state().energy).toBe(3600 - c.cost);
    });
  }

  it("requested asleep: no model call, no charge", async () => {
    const f = await truffle({ state: LIVE_HIGH });
    const a = await startChat(f, "asleep");
    expect(last(await a.events!).data.brain).toBe("none");
    await f.drain();
    expect(f.ai.calls).toHaveLength(0);
    expect(f.state().energy).toBe(3600);
  });
});

// ---------- D09 ----------

describe("D09 coalesced, revision-aware weather refresh (S11-11)", () => {
  const stale = () => ({ ...parseForecast(muscat, "2026-10-08"), fetched_ms: 0 });

  it("two stale readers share one forecast fetch", async () => {
    const f = await truffle({ meta: { weather_now: stale() } });
    const d = new Deferred<unknown>();
    net.queue.push(d);
    const p1 = f.obj.getState(f.secret);
    const p2 = f.obj.getState(f.secret);
    await until(() => net.count > 0, "a forecast fetch");
    await settle();
    expect(net.count).toBe(1);
    d.resolve(muscat);
    expect((await p1).ok).toBe(true);
    expect((await p2).ok).toBe(true);
    expect(f.meta().weather_now!.fetched_ms).toBe(clock.now);
    await f.obj.getState(f.secret);
    expect(net.count).toBe(1);
  });

  it("failures back off from 5 minutes, doubling to 1 hour, and keep the old data", async () => {
    const f = await truffle({ meta: { weather_now: stale() } });
    net.fallback = 503;
    const min = 60_000;
    const r = await f.obj.getState(f.secret);
    expect(net.count).toBe(1);
    expect(r.ok && r.value.weather).not.toBeNull();
    expect(r.ok && r.value.weather?.fetched_ms).toBe(stale().fetched_ms);
    advance(4 * min);
    await f.obj.getState(f.secret);
    expect(net.count).toBe(1);
    const waits = [1, 10, 20, 40, 60, 60];
    let fetches = 1;
    for (const w of waits) {
      advance(w * min);
      await f.obj.getState(f.secret);
      expect(net.count).toBe(++fetches);
      advance(-1);
      await f.obj.getState(f.secret); // just inside the next window: no fetch
      advance(1);
    }
    expect(net.count).toBe(1 + waits.length);
    expect(f.meta().weather_fail?.backoff_ms).toBe(60 * min);
    net.queue.push(muscat);
    advance(60 * min);
    await f.obj.getState(f.secret);
    expect(f.meta().weather_fail).toBeUndefined();
    expect(f.meta().weather_now!.fetched_ms).toBe(clock.now);
  });

  it("an old point's forecast cannot overwrite the newer point", async () => {
    const f = await truffle({ meta: { weather_now: stale() } });
    const d = new Deferred<unknown>();
    net.queue.push(d);
    const p = f.obj.getState(f.secret);
    await until(() => net.count > 0, "a forecast fetch");
    expect(net.urls[0]).toContain("latitude=23.5900");
    expect((await f.obj.feed({ day: "2026-10-08", day_tz: "Asia/Muscat", total: 0, lat: 24.01, lon: 56.99 })).ok).toBe(true);
    d.resolve(muscat);
    await p;
    expect(f.meta().weather_now!.fetched_ms).toBe(0);
    expect(f.meta().weather_days).toEqual({});
    net.queue.push(muscat);
    await f.obj.getState(f.secret);
    expect(net.count).toBe(2);
    expect(net.urls[1]).toContain("latitude=24.0100");
    expect(f.meta().weather_now!.fetched_ms).toBe(clock.now);
  });

  it("feed never fetches a forecast itself", async () => {
    const f = await truffle({ meta: { weather_now: stale() } });
    await f.obj.feed({ day: "2026-10-08", day_tz: "Asia/Muscat", total: 200, lat: 24.5, lon: 57.5 });
    await f.obj.feed({ day: "2026-10-08", day_tz: "Asia/Muscat", total: 300 });
    expect(net.count).toBe(0);
  });
});
