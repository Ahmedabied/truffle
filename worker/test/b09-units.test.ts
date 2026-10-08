// Pure helpers added in B09: the admitted tier in the state block (decision
// 0013), quota give-back, and the forecast failure backoff.

import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, stateBlock, type TruffleState } from "../src/engine";
import { HOUR_MS, nextWeatherBackoff, unreserve, WEATHER_BACKOFF_START_MS } from "../src/ratelimit";

const at = (energy: number): TruffleState => ({ ...structuredClone(DEFAULT_STATE), energy, lifetime_steps: energy });
const tierIn = (block: string) => /tier=(\w+)/.exec(block)![1];

describe("stateBlock with the admitted tier (decision 0013)", () => {
  const opts = { lang: "en" as const, weather_text: "33C clear" };

  it("without a tier it shows what energy allows, as before", () => {
    expect(tierIn(stateBlock(at(3600), opts))).toBe("high");
  });

  it("shows a lower admitted tier", () => {
    expect(tierIn(stateBlock(at(3600), { ...opts, tier: "low" }))).toBe("low");
    expect(tierIn(stateBlock(at(3600), { ...opts, tier: "medium" }))).toBe("medium");
    expect(tierIn(stateBlock(at(3600), { ...opts, tier: "asleep" }))).toBe("asleep");
  });

  it("never shows more than energy allows", () => {
    expect(tierIn(stateBlock(at(1000), { ...opts, tier: "high" }))).toBe("low");
    expect(tierIn(stateBlock(at(10), { ...opts, tier: "high" }))).toBe("asleep");
  });

  it("changes nothing else in the block", () => {
    const a = stateBlock(at(3600), opts).replace("tier=high", "tier=low");
    expect(stateBlock(at(3600), { ...opts, tier: "low" })).toBe(a);
  });
});

describe("unreserve", () => {
  it("gives one slot back in the same window only", () => {
    expect(unreserve({ start_ms: 5, count: 30 }, 5)).toEqual({ start_ms: 5, count: 29 });
    expect(unreserve({ start_ms: 9, count: 3 }, 5)).toEqual({ start_ms: 9, count: 3 });
    expect(unreserve({ start_ms: 5, count: 0 }, 5)).toEqual({ start_ms: 5, count: 0 });
    expect(unreserve(undefined, 5)).toBeUndefined();
  });
});

describe("nextWeatherBackoff", () => {
  it("starts at 5 minutes and doubles to at most 1 hour", () => {
    const seq: number[] = [];
    let b: number | undefined;
    for (let i = 0; i < 7; i++) seq.push((b = nextWeatherBackoff(b)));
    expect(WEATHER_BACKOFF_START_MS).toBe(5 * 60_000);
    expect(seq.map((ms) => ms / 60_000)).toEqual([5, 10, 20, 40, 60, 60, 60]);
    expect(Math.max(...seq)).toBe(HOUR_MS);
  });
});
