import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STATE } from "../../worker/src/engine";
import { MockBackend } from "../src/mock";
import type { ChatEvent, Creds, Tier } from "../src/types";

const DAY = 86_400_000;
const START = Date.parse("2026-10-09T08:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const fresh = () => new MockBackend(new URLSearchParams("scene=fresh"), true);
async function reply(b: MockBackend, c: Creds, message: string, requested?: Tier) {
  const events: ChatEvent[] = [];
  const run = (async () => { for await (const event of b.chat(c, message, "en", requested)) events.push(event); })();
  await vi.runAllTimersAsync();
  await run;
  return events;
}

describe("offline v2 food and time", () => {
  it("stores overflow and consumes exactly 1000 points across a manual elapsed day", async () => {
    const b = fresh(); const c = await b.spawn("en");
    const fed = await b.slider(c, 16000);
    expect(fed).toMatchObject({ energy_max: 24000, energy_pct: 67, tier: "high", state: { energy_version: 2, energy: 16000 } });
    const later = await b.midnight(c);
    expect(later).toMatchObject({ local_day: "2026-10-10", state: { energy: 15000, steps_today: 0, age_days: 1, history7: [16000] } });
    expect(later.state.energy_settled_ms).toBe(START + DAY);
    expect((await b.state(c)).state.energy).toBe(15000);
  });

  it("settles natural Muscat midnight without a second manual-day reset or duplicate credit", async () => {
    vi.setSystemTime(Date.parse("2026-10-09T19:59:59Z"));
    const b = fresh(); const c = await b.spawn();
    await b.slider(c, 2000);
    vi.advanceTimersByTime(2000);
    const after = await b.state(c);
    expect(after.local_day).toBe("2026-10-10");
    expect(after.state).toMatchObject({ age_days: 1, steps_today: 0, history7: [2000], energy: 1999 });
    const fed = await b.slider(c, 500);
    expect(fed.state.lifetime_steps).toBe(2500);
    expect((await b.slider(c, 500)).state.energy_units).toBe(fed.state.energy_units);
  });

  it("persists elapsed-time offset and daily feed totals through reload", async () => {
    const b = fresh(); const c = await b.spawn();
    await b.slider(c, 4000); await b.midnight(c); await b.slider(c, 300);
    const reload = new MockBackend(new URLSearchParams(), true);
    const s = await reload.state(c);
    expect(s).toMatchObject({ local_day: "2026-10-10", state: { energy: 3300, steps_today: 300, age_days: 1 } });
    expect((await reload.slider(c, 300)).state.energy).toBe(3300);
    vi.advanceTimersByTime(DAY / 2);
    expect((await reload.state(c)).state.energy).toBe(2800);
  });

  it("keeps partial consumption across frequent reads and does not refund clock rollback", async () => {
    const b = fresh(); const c = await b.spawn(); await b.slider(c, 2000);
    for (let i = 0; i < 10; i++) { vi.advanceTimersByTime(8640); await b.state(c); }
    expect((await b.state(c)).state.energy).toBe(1999);
    vi.setSystemTime(START);
    expect((await b.state(c)).state.energy).toBe(1999);
  });

  it("keeps high capability across growth and the same upkeep at Elder", async () => {
    const b = fresh(); const c = await b.spawn();
    expect((await b.slider(c, 3999)).tier).toBe("high");
    expect(await b.slider(c, 5000)).toMatchObject({ tier: "high", state: { stage: "Sprout" } });
    const elder = new MockBackend(new URLSearchParams("scene=elder"), false);
    const old = await elder.spawn();
    expect(await elder.midnight(old)).toMatchObject({ energy_max: 42000, tier: "high", state: { energy: 20000 } });
  });

  it("feeding clears measured empty time and heat pauses it", async () => {
    const b = fresh(); const c = await b.spawn();
    vi.advanceTimersByTime(2 * DAY); await b.heat(c, true);
    expect((await b.midnight(c)).state.empty_ms).toBe(2 * DAY);
    expect((await b.slider(c, 100)).state).toMatchObject({ empty_ms: 0, zero_days: 0, dead: false });
  });

  it("settles before heat transitions and preserves shelter during manual advance", async () => {
    const b = fresh(); const c = await b.spawn(); await b.slider(c, 4000);
    vi.advanceTimersByTime(DAY / 2); await b.heat(c, true);
    expect((await b.midnight(c)).state).toMatchObject({ energy: 3500, burrowed: true });
    await b.heat(c, false); vi.advanceTimersByTime(DAY / 2);
    expect((await b.state(c)).state.energy).toBe(3000);
  });

  it("counts 96 actual empty hours before death, then fences the life", async () => {
    const b = fresh(); const c = await b.spawn(); const initial = c.generation!;
    vi.advanceTimersByTime(4 * DAY - 1);
    expect((await b.state(c)).state.dead).toBe(false);
    vi.advanceTimersByTime(1);
    const dead = await b.state(c);
    expect(dead.state).toMatchObject({ dead: true, empty_ms: 4 * DAY });
    expect(dead.generation).toBe(initial + 1);
    expect((await b.state(c)).generation).toBe(dead.generation);
    const spore = await b.spore(c);
    expect(spore.generation).toBe(initial + 2);
    expect(spore.state).toMatchObject({ energy_version: 2, dead: false, empty_ms: 0, age_days: 0 });
    expect(spore.state.gravestones).toHaveLength(1);
  });

  it("persists generation after reset, keeps demo scopes separate and ignores living spore requests", async () => {
    const b = fresh(); const c = await b.spawn("en"); await b.slider(c, 5000);
    expect((await b.spore(c)).generation).toBe(c.generation);
    const reset = await b.reset(c);
    expect(reset.generation).toBe(c.generation! + 1);
    expect(reset.state.energy_version).toBe(2);
    const reload = await new MockBackend(new URLSearchParams(), true).spawn();
    expect(reload).toMatchObject({ generation: reset.generation, lang: "en", state: { energy: 0 } });
    const main = await new MockBackend(new URLSearchParams(), false).spawn();
    expect(main.state.lifetime_steps).toBe(42310);
    expect(main.demo).toBe(false);
  });

  it.each([["tired", DAY], ["wilting", 2 * DAY]] as const)("preserves the %s scene's measured empty duration", async (scene, empty) => {
    const b = new MockBackend(new URLSearchParams({ scene }), true);
    const s = await b.spawn();
    expect(s.mood).toBe(scene);
    expect(s.state.empty_ms).toBe(empty);
    expect((await b.state(s)).mood).toBe(scene);
  });

  it("adopts legacy saved state at now without inventing elapsed consumption or erasing progress", async () => {
    localStorage.setItem("truffle.mock.demo", JSON.stringify({ ...DEFAULT_STATE, energy: 2400, lifetime_steps: 8000, steps_today: 2400, age_days: 9, zero_days: 2 }));
    const b = new MockBackend(new URLSearchParams(), true);
    const c = await b.spawn();
    expect(c.state).toMatchObject({ energy_version: 2, energy: 2400, lifetime_steps: 8000, steps_today: 2400, age_days: 9, empty_ms: 0, zero_days: 0, energy_settled_ms: START });
  });

  it("retains a legacy death and grave until explicit spore recovery", async () => {
    const grave = { age_days: 4, lifetime_steps: 0, stage: "Spore", memory: "a hello" };
    localStorage.setItem("truffle.mock.demo", JSON.stringify({ ...DEFAULT_STATE, dead: true, age_days: 4, zero_days: 4, gravestones: [grave] }));
    const b = new MockBackend(new URLSearchParams(), true); const c = await b.spawn();
    expect(c.state).toMatchObject({ energy_version: 2, dead: true, gravestones: [grave] });
    expect((await b.spore(c)).state.gravestones).toEqual([grave]);
  });
});

describe("honest sample replies", () => {
  it.each([["hello", undefined, "low", 20], ["Help me plan an afternoon", undefined, "medium", 60], ["hello", "high", "high", 200], ["Explain the sand", "low", "low", 20]] as const)("chooses effort for %s (%s)", async (message, requested, tier, spent) => {
    const b = fresh(); const c = await b.spawn(); await b.slider(c, 9000);
    const events = await reply(b, c, message, requested);
    expect(events.find(e => e.type === "brain")).toEqual({ type: "brain", brain: "sample", half_awake: false });
    expect(events.find(e => e.type === "done")).toMatchObject({ tier, spent, brain: "sample" });
    const text = events.filter(e => e.type === "token").map(e => e.type === "token" ? e.text : "").join("");
    expect(text).not.toMatch(/low on|sleepy|a (short )?walk|where you walked/i);
  });

  it("cancels before visible output without spending reply food", async () => {
    const b = fresh(); const c = await b.spawn(); await b.slider(c, 1000);
    const controller = new AbortController();
    const events: ChatEvent[] = [];
    const run = (async () => { for await (const e of b.chat(c, "hello", "en", undefined, controller.signal)) events.push(e); })();
    controller.abort(); await vi.runAllTimersAsync(); await run;
    expect(events).toEqual([]);
    expect((await b.state(c)).state.energy).toBeGreaterThanOrEqual(999);
  });

  it("reserves the last 20 points while waiting and charges once on first visible output", async () => {
    const b = fresh(); const c = await b.spawn(); await b.slider(c, 20);
    const events = await reply(b, c, "hello");
    expect(events.find(e => e.type === "done")).toMatchObject({ tier: "low", spent: 20, summary: { state: { energy: 0, dead: false } } });
  });

  it("keeps the one visible reply charge when cancelled partway through", async () => {
    const b = fresh(); const c = await b.spawn(); await b.slider(c, 1000);
    const controller = new AbortController();
    const events: ChatEvent[] = [];
    const run = (async () => {
      for await (const e of b.chat(c, "hello", "en", undefined, controller.signal)) {
        events.push(e);
        if (e.type === "token") controller.abort();
      }
    })();
    await vi.runAllTimersAsync(); await run;
    expect(events.filter(e => e.type === "token")).toHaveLength(1);
    expect(events.some(e => e.type === "done")).toBe(false);
    expect((await b.state(c)).state.energy).toBe(979);
  });

  it("fences an old sample reply after reset without spending the new pet's food", async () => {
    const b = fresh(); const c = await b.spawn(); await b.slider(c, 1000);
    const events: ChatEvent[] = [];
    const run = (async () => { for await (const e of b.chat(c, "hello", "en")) events.push(e); })();
    await b.reset(c); await b.slider(c, 500);
    await vi.runAllTimersAsync(); await run;
    expect(events).toEqual([]);
    expect((await b.state(c)).state.energy).toBe(499);
  });
});
