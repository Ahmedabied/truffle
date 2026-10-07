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
