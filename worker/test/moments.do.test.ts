// Proud moments in the Durable Object (decision 0017, packet B12): the ring of
// 20, the once-per-day list, the streak counter, and moments in every summary.
// Real TruffleDO code; fake SQLite host, clock and Open-Meteo.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advance, FakeFetch, truffle, useClock } from "./helpers/do-harness";
import { DEFAULT_STATE, feed } from "../src/engine";
import { MAX_MOMENTS, type Moment } from "../src/moments";

beforeEach(() => {
  useClock("2026-10-08T08:00:00Z"); // 12:00 in Muscat
  new FakeFetch().install();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const kinds = (ms: Moment[]) => ms.map((m) => `${m.kind}:${m.value}`);
const HISTORY = { history7: [2500, 2500, 2500, 2500, 2500, 2500, 2500], avg7: 2500, lifetime_steps: 40000, stage: "Truffle" as const };

describe("moments from real feeds", () => {
  it("crossing 2,000 then beating avg7 shows both in /state, ascending ids", async () => {
    const f = await truffle({ state: { history7: [1500, 3000], avg7: 2250, lifetime_steps: 4500 } });
    expect((await f.obj.feed({ day: "2026-10-08", day_tz: "Asia/Muscat", total: 2100 })).ok).toBe(true);
    advance(600_000);
    expect((await f.obj.feed({ day: "2026-10-08", day_tz: "Asia/Muscat", total: 2400 })).ok).toBe(true);
    const r = await f.obj.getState(f.secret);
    if (!r.ok) throw new Error(r.error);
    expect(kinds(r.value.moments)).toEqual(["stage_up:1", "beat_avg7:2400"]);
    expect(r.value.moments.map((m) => m.id)).toEqual([1, 2]);
    expect(r.value.moments[0].at_ms).toBe(Date.parse("2026-10-08T08:00:00Z"));
    expect(f.meta().moments_today).toEqual(["beat_avg7"]);
    expect(f.meta().next_moment_id).toBe(3);
  });

  it("a once-per-day kind does not fire twice in one day, and moments are not cleared on read", async () => {
    const f = await truffle({ state: { ...HISTORY, history7: [12000], avg7: 12000 } });
    await f.obj.feed({ day: "2026-10-08", day_tz: "Asia/Muscat", total: 10500 });
    advance(600_000);
    await f.obj.feed({ day: "2026-10-08", day_tz: "Asia/Muscat", total: 11000 });
    await f.obj.getState(f.secret);
    const r = await f.obj.getState(f.secret);
    if (!r.ok) throw new Error(r.error);
    expect(kinds(r.value.moments)).toEqual(["day_10k:10500", "lifetime:50000"]);
  });

  it("an ignored or rejected feed makes no moment", async () => {
    const f = await truffle({ state: HISTORY });
    await f.obj.feed({ day: "2026-10-07", day_tz: "Asia/Muscat", total: 3000 });
    expect(f.meta().moments ?? []).toEqual([]);
  });

  it("moments never change the engine state", async () => {
    const a = await truffle({ state: HISTORY });
    await a.obj.feed({ day: "2026-10-08", day_tz: "Asia/Muscat", total: 3000 });
    const withMoments = a.state();
    expect(a.meta().moments!.length).toBeGreaterThan(0);
    expect(withMoments).toEqual(feed({ ...structuredClone(DEFAULT_STATE), ...HISTORY }, 3000));
  });
});

describe("the ring keeps the last 20", () => {
  it("drops the oldest, keeps ascending ids, and ids keep counting", async () => {
    const f = await truffle({ state: { history7: [0], avg7: 0 }, meta: { demo: true } });
    // Each demo midnight after a 10k day is a fresh day: best_day and day_10k fire again.
    for (let day = 0; day < 15; day++) {
      await f.obj.setSteps(f.secret, 10000);
      await f.obj.forceMidnight(f.secret);
    }
    const r = await f.obj.getState(f.secret);
    if (!r.ok) throw new Error(r.error);
    const ids = r.value.moments.map((m) => m.id);
    expect(ids).toHaveLength(MAX_MOMENTS);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(ids[ids.length - 1]).toBe(f.meta().next_moment_id! - 1);
    expect(ids[0]).toBeGreaterThan(1);
  });
});

describe("midnight, streaks and a new spore", () => {
  it("the demo slider and demo midnight use the same paths, and midnight clears the day list", async () => {
    const f = await truffle({ state: { history7: [3000, 3000], avg7: 3000, lifetime_steps: 6000, stage: "Sprout" }, meta: { demo: true } });
    await f.obj.setSteps(f.secret, 3500);
    expect(f.meta().moments_today).toEqual(["best_day", "beat_avg7"]);
    const r = await f.obj.forceMidnight(f.secret);
    if (!r.ok) throw new Error(r.error);
    expect(kinds(r.value.moments)).toEqual(["best_day:3500", "beat_avg7:3500", "streak:3"]);
    expect(f.meta().moments_today).toEqual([]);
    expect(f.meta().streak_days).toBe(3);
  });

  it("the stored streak reaches 14 past the 7 days history7 holds", async () => {
    const f = await truffle({
      state: { history7: Array(7).fill(4000), avg7: 4000, lifetime_steps: 60000, stage: "Truffle" },
      meta: { demo: true, streak_days: 12 }
    });
    await f.obj.setSteps(f.secret, 3000);
    await f.obj.forceMidnight(f.secret);
    expect(f.meta().moments ?? []).toEqual([]);
    expect(f.meta().streak_days).toBe(13);
    await f.obj.setSteps(f.secret, 3000);
    const r = await f.obj.forceMidnight(f.secret);
    if (!r.ok) throw new Error(r.error);
    expect(kinds(r.value.moments)).toEqual(["streak:14"]);
  });

  it("the real midnight alarm fires the streak with the midnight instant", async () => {
    useClock("2026-10-08T19:00:00Z"); // 23:00 in Muscat
    const f = await truffle({ state: { history7: [3000, 3000], avg7: 3000, lifetime_steps: 9000, stage: "Sprout", energy: 5000, steps_today: 3100 } });
    f.priv.save(f.state(), { ...f.meta(), moments_today: ["best_day"] });
    useClock("2026-10-08T20:30:00Z"); // 00:30 on Oct 9
    await f.obj.alarm();
    const ms = f.meta().moments!;
    expect(kinds(ms)).toEqual(["streak:3"]);
    expect(ms[0].at_ms).toBe(Date.parse("2026-10-08T20:00:00Z"));
    expect(f.meta().moments_today).toEqual([]);
  });

  it("death emits nothing, a new spore resets the day list and the streak and keeps the ring", async () => {
    useClock("2026-10-08T19:55:00Z");
    const f = await truffle({
      state: { energy: 1000, lifetime_steps: 1000, zero_days: 3 },
      meta: { moments: [{ id: 7, kind: "best_day", at_ms: 1, value: 2500 }], next_moment_id: 8, moments_today: ["best_day"], streak_days: 5 }
    });
    useClock("2026-10-08T20:30:00Z");
    await f.obj.alarm();
    expect(f.state().dead).toBe(true);
    expect(f.meta().moments!.map((m) => m.id)).toEqual([7]);
    f.priv.save(f.state(), { ...f.meta(), moments_today: ["day_10k"] });
    const r = await f.obj.spore(f.secret);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.moments.map((m) => m.id)).toEqual([7]);
    expect(f.meta().moments_today).toEqual([]);
    expect(f.meta().streak_days).toBe(0);
    expect((await f.obj.feed({ day: "2026-10-09", day_tz: "Asia/Muscat", total: 2100 })).ok).toBe(true);
    expect(f.meta().moments!.at(-1)).toMatchObject({ id: 8, kind: "best_day", value: 2100 });
  });

  it("every summary carries moments, even an empty list", async () => {
    const f = await truffle();
    const r = await f.obj.getState(f.secret);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.moments).toEqual([]);
  });
});
