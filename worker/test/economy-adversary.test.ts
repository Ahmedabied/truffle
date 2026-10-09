import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENERGY_V2_CUTOVER_MS as C, ENERGY_V2_UNITS_PER_POINT as U } from "../src/config";
import { DEFAULT_STATE, initializeV2 } from "../src/engine";
import {
  advance, clock, Deferred, FakeFetch, readEvents, settle, startChat, truffle, useClock
} from "./helpers/do-harness";

const D = 86_400_000;
const v2 = (energy = 0) => initializeV2({ ...structuredClone(DEFAULT_STATE), energy }, clock.now);
beforeEach(() => { useClock(new Date(C + D).toISOString()); new FakeFetch().install(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("independent economy adversary", () => {
  it("cancellation before any visible provider text returns the reservation and aborts inference", async () => {
    const f = await truffle({ state: v2(100), meta: { demo: true } });
    const held = f.ai.hold();
    const result = await f.obj.chat(f.secret, "Hello.", "low", "en");
    if (!result.ok) throw new Error(result.error);
    await settle();
    expect(f.meta().chat).toMatchObject({ cost: 20, charged: false });
    // The guard holds a possible field name. Aborting must not flush it as a
    // newly charged visible reply after the downstream has already gone away.
    held.push("stage");
    await settle();
    expect(f.meta().chat?.charged).toBe(false);
    await result.value.cancel("owner stopped before any words");
    await settle();
    const abortedAtCancel = held.aborted;
    // Complete the old provider even when the regression ignores cancellation.
    held.push("These words arrived after the response was cancelled.");
    held.end();
    await f.drain();
    expect(f.state().energy).toBe(100);
    expect(f.turns()).toEqual([]);
    expect(f.meta().chat).toBeUndefined();
    expect(f.meta().demo_replies?.count).toBe(0);
    expect(abortedAtCancel).toBe(true);
  });

  it("cancellation after visible words keeps one charge and stops unseen continuation", async () => {
    const f = await truffle({ state: v2(100), meta: { demo: true } });
    const held = f.ai.hold();
    const result = await f.obj.chat(f.secret, "Hello.", "low", "en");
    if (!result.ok) throw new Error(result.error);
    const reader = result.value.getReader();
    await reader.read(); // provider selection, not paid text
    held.push("First words.");
    const token = await reader.read();
    expect(new TextDecoder().decode(token.value)).toContain("First words.");
    expect(f.state().energy).toBe(80);
    expect(f.meta().chat?.charged).toBe(true);
    await reader.cancel("owner stopped after visible words");
    await settle();
    const abortedAtCancel = held.aborted;
    held.push(" This continuation was never delivered.");
    held.end();
    await f.drain();
    expect(f.state().energy).toBe(80);
    expect(f.meta().demo_replies?.count).toBe(1);
    expect(f.meta().chat).toBeUndefined();
    expect(f.turns()).toEqual([
      { role: "user", content: "Hello." }, { role: "assistant", content: "First words." }
    ]);
    expect(abortedAtCancel).toBe(true);
  });

  it("settles through owner authentication before reserving food for a paid chat", async () => {
    const f = await truffle({ state: v2(20) });
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    const expectedDigest = await digest("SHA-256", new TextEncoder().encode("truffle-secret:" + f.secret));
    const gate = new Deferred<ArrayBuffer>();
    vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(() => gate.promise);
    const chat = f.obj.chat(f.secret, "Explain a short idea.", "low", "en");
    // A single millisecond makes the available whole-point balance 19.
    advance(1);
    gate.resolve(expectedDigest);
    const result = await chat;
    if (!result.ok) throw new Error(result.error);
    const events = await readEvents(result.value);
    await f.drain();
    expect(events.find(e => e.event === "done")?.data).toMatchObject({ tier: "asleep", spent: 0 });
    expect(f.ai.calls).toHaveLength(0);
    expect(f.state().energy_units).toBe(20 * U - 1_000);
    expect(f.state().energy_settled_ms).toBe(clock.now);
  });

  it("a clock rollback cannot apply yesterday's cool weather to the current sheltered interval", async () => {
    const now = clock.now;
    const day = new Date(now).toISOString().slice(0, 10);
    const yesterday = new Date(now - D).toISOString().slice(0, 10);
    const f = await truffle({
      state: { ...v2(1000), burrowed: true },
      meta: { tz: "UTC", last_midnight_key: day, weather_days: { [yesterday]: 30, [day]: 45 } }
    });
    const net = new FakeFetch();
    net.queue.push({ timezone: "UTC", current: { apparent_temperature: 45, weather_code: 0 },
      hourly: { time: [yesterday + "T12:00", day + "T12:00"], apparent_temperature: [30, 45] } });
    net.install();
    advance(-D);
    await f.obj.getState(f.secret);
    const afterRollback = f.state();
    advance(2 * D);
    await f.obj.getState(f.secret);
    expect.soft(afterRollback).toMatchObject({ burrowed: true, energy_settled_ms: now, energy: 1000 });
    expect(f.state()).toMatchObject({ energy: 1000, burrowed: true, empty_ms: 0 });
  });

  it("demo next-day advances preserve the heat toggle for both food and empty-time protection", async () => {
    const f = await truffle({ state: { ...v2(1000), burrowed: true }, meta: { demo: true } });
    const origin = clock.now;
    await f.obj.forceMidnight(f.secret);
    await f.obj.forceMidnight(f.secret);
    expect(f.state()).toMatchObject({ energy: 1000, empty_ms: 0, burrowed: true, age_days: 2, energy_settled_ms: origin + 2 * D });
    await f.obj.setHeat(f.secret, false);
    await f.obj.forceMidnight(f.secret);
    expect(f.state()).toMatchObject({ energy: 0, empty_ms: 0, burrowed: false });
    await f.obj.setHeat(f.secret, true);
    await f.obj.forceMidnight(f.secret);
    expect(f.state()).toMatchObject({ energy: 0, empty_ms: 0, burrowed: true, dead: false });
    await f.obj.setHeat(f.secret, false);
    await f.obj.forceMidnight(f.secret);
    expect(f.state()).toMatchObject({ energy: 0, empty_ms: D, burrowed: false, dead: false, age_days: 5, energy_settled_ms: origin + 5 * D });
  });

  for (const elder of [false, true]) {
    it(`conserves captured 15k food through a busy day and rest day at ${elder ? "Elder" : "Sprout"}`, async () => {
      // Keep the first upload comfortably after midnight for the dated-feed limit.
      useClock(new Date(Math.floor(C / D) * D + 2 * D + D / 2).toISOString());
      const day = new Date(clock.now).toISOString().slice(0, 10);
      const f = await truffle({
        state: { ...v2(), ...(elder ? { stage: "Elder" as const, lifetime_steps: 100000 } : {}) },
        meta: { tz: "UTC", last_midnight_key: day }
      });
      const feed = await f.obj.feed({ total: 15000, day, day_tz: "UTC" });
      expect(feed.ok).toBe(true);
      expect(f.state()).toMatchObject({ energy: 15000, stage: elder ? "Elder" : "Sprout" });
      expect(f.logs("feed").at(-1)).toMatchObject({ delta: 15000, discarded_overflow: 0 });

      // Ten useful ordinary replies, one explicit deep answer, one short greeting.
      for (let i = 0; i < 10; i++) {
        const chat = await startChat(f, undefined, "Help me plan tomorrow's errands.");
        expect((await chat.events!)?.find(e => e.event === "done")?.data).toMatchObject({ tier: "medium", spent: 60 });
        await f.drain();
      }
      const deep = await startChat(f, "high", "Think through the tradeoffs in this plan.");
      expect((await deep.events!)?.find(e => e.event === "done")?.data).toMatchObject({ tier: "high", spent: 200 });
      await f.drain();
      const greeting = await startChat(f, undefined, "Hi!");
      expect((await greeting.events!)?.find(e => e.event === "done")?.data).toMatchObject({ tier: "low", spent: 20 });
      await f.drain();
      advance(D);
      await f.obj.getState(f.secret);
      expect(f.state()).toMatchObject({ energy: 13180, energy_units: 13180 * U, history7: [15000], steps_today: 0 });

      // No step credit on the rest day, but five ordinary useful replies work.
      for (let i = 0; i < 5; i++) {
        const chat = await startChat(f, undefined, "Explain one useful idea for my project.");
        expect((await chat.events!)?.find(e => e.event === "done")?.data).toMatchObject({ tier: "medium", spent: 60 });
        await f.drain();
      }
      advance(D);
      await f.obj.getState(f.secret);
      expect(f.state()).toMatchObject({ energy: 11880, energy_units: 11880 * U, empty_ms: 0, dead: false, history7: [15000, 0] });
      expect(f.ai.calls).toHaveLength(17);
    });
  }
});
