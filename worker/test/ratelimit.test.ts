import { describe, expect, it } from "vitest";
import { checkRate, FEED_LIMIT_PER_HOUR, HOUR_MS } from "../src/ratelimit";

describe("feed rate limit (60 per hour per Truffle)", () => {
  it("allows 60 then blocks the 61st", () => {
    let w = undefined;
    const t0 = 1_000_000;
    for (let i = 0; i < FEED_LIMIT_PER_HOUR; i++) {
      const r = checkRate(w, t0 + i * 1000);
      expect(r.allowed).toBe(true);
      w = r.window;
    }
    const blocked = checkRate(w, t0 + 61_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retry_after_s).toBe(Math.ceil((HOUR_MS - 61_000) / 1000));
    expect(blocked.window.count).toBe(60);
  });
  it("resets after the window", () => {
    const full = { start_ms: 0, count: 60 };
    expect(checkRate(full, HOUR_MS - 1).allowed).toBe(false);
    const r = checkRate(full, HOUR_MS);
    expect(r.allowed).toBe(true);
    expect(r.window).toEqual({ start_ms: HOUR_MS, count: 1 });
  });
  it("a clock going backwards starts a fresh window", () => {
    expect(checkRate({ start_ms: 5000, count: 60 }, 1000).allowed).toBe(true);
  });
});

import { plausibleTotal } from "../src/ratelimit";

describe("feed plausibility since local midnight (S10-02 replay guard)", () => {
  it("rejects yesterday's 5000 replayed one minute after midnight", () => {
    expect(plausibleTotal(5000, 60_000)).toBe(false);
  });
  it("accepts a real early total and a big afternoon total", () => {
    expect(plausibleTotal(100, 60_000)).toBe(true);
    expect(plausibleTotal(25_000, 12 * HOUR_MS)).toBe(true);
    expect(plausibleTotal(0, 0)).toBe(true);
  });
});

import {
  coordRefreshAllowed,
  DEMO_REPLIES_PER_DAY,
  feedBaseline,
  jumpCheck,
  MAX_JUMP_STEPS_PER_SECOND,
  peekRate
} from "../src/ratelimit";

describe("feed jump cap: 20 steps a second since the last accepted feed (S10-07)", () => {
  it("is 20 steps per second", () => expect(MAX_JUMP_STEPS_PER_SECOND).toBe(20));
  it("allows exactly 20 per second and rejects one more", () => {
    expect(jumpCheck(1200, 60_000)).toEqual({ allowed: true, retry_after_s: 0 });
    const r = jumpCheck(1201, 60_000);
    expect(r.allowed).toBe(false);
    expect(r.retry_after_s).toBe(1);
  });
  it("15000 one minute after midnight must wait", () => {
    const r = jumpCheck(15_000, 60_000);
    expect(r.allowed).toBe(false);
    expect(r.retry_after_s).toBe(750 - 60);
  });
  it("another 35000 on top needs at least 1750 seconds", () => {
    expect(jumpCheck(35_000, 1_749_000).allowed).toBe(false);
    expect(jumpCheck(35_000, 1_750_000).allowed).toBe(true);
  });
  it("zero or negative deltas always pass (they are no-ops)", () => {
    expect(jumpCheck(0, 0).allowed).toBe(true);
    expect(jumpCheck(-50, 0).allowed).toBe(true);
  });
  it("a clock that went backwards gives no allowance, not a negative one", () => {
    expect(jumpCheck(1, -5000).allowed).toBe(false);
  });
});

describe("feed baseline", () => {
  const midnight = 1_000_000;
  it("first feed of the day counts from local midnight, not pairing time", () => {
    expect(feedBaseline(undefined, "2026-10-08", midnight)).toBe(midnight);
    expect(feedBaseline({ day: "2026-10-07", ms: 999_000 }, "2026-10-08", midnight)).toBe(midnight);
  });
  it("later feeds count from the last accepted feed of the same day", () => {
    expect(feedBaseline({ day: "2026-10-08", ms: 1_500_000 }, "2026-10-08", midnight)).toBe(1_500_000);
  });
  it("never earlier than local midnight", () => {
    expect(feedBaseline({ day: "2026-10-08", ms: 5 }, "2026-10-08", midnight)).toBe(midnight);
  });
});

describe("demo reply quota (S10-05)", () => {
  it("is 30 a day", () => expect(DEMO_REPLIES_PER_DAY).toBe(30));
  it("peek does not count", () => {
    const w = { start_ms: 0, count: 29 };
    expect(peekRate(w, 10, 30, DAY_MS_T)).toEqual({ allowed: true, retry_after_s: 0 });
    expect(w.count).toBe(29);
  });
  it("blocks at 30 until the day window ends", () => {
    const w = { start_ms: 0, count: 30 };
    const r = peekRate(w, 1000, 30, DAY_MS_T);
    expect(r.allowed).toBe(false);
    expect(r.retry_after_s).toBe(Math.ceil((DAY_MS_T - 1000) / 1000));
    expect(peekRate(w, DAY_MS_T, 30, DAY_MS_T).allowed).toBe(true);
    expect(peekRate(undefined, 0, 30, DAY_MS_T).allowed).toBe(true);
  });
});

describe("coordinate-triggered weather refresh: once an hour", () => {
  it("first one is allowed, then not for an hour", () => {
    expect(coordRefreshAllowed(undefined, 5)).toBe(true);
    expect(coordRefreshAllowed(0, HOUR_MS - 1)).toBe(false);
    expect(coordRefreshAllowed(0, HOUR_MS)).toBe(true);
  });
});

const DAY_MS_T = 86_400_000;
