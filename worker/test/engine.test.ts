// Extra unit tests beyond the goldens: edges the DO relies on.
import { describe, expect, it } from "vitest";
import { MAX_GRAVESTONES, type Tier } from "../src/config";
import {
  DEFAULT_STATE,
  decideTier,
  deriveStage,
  feed,
  midnight,
  newSpore,
  stateBlock,
  type TruffleState
} from "../src/engine";

const s = (over: Partial<TruffleState>): TruffleState => ({
  ...DEFAULT_STATE,
  history7: [],
  gravestones: [],
  ...over
});

describe("engine edges", () => {
  it("stage thresholds are inclusive", () => {
    expect(deriveStage(4999)).toBe("Spore");
    expect(deriveStage(5000)).toBe("Sprout");
    expect(deriveStage(30000)).toBe("Truffle");
    expect(deriveStage(100000)).toBe("Elder");
  });

  it("requested tier lower than allowed is honoured", () => {
    const d = decideTier(s({ energy: 5000, lifetime_steps: 4000 }), "low");
    expect(d.tier).toBe("low");
    expect(d.cost).toBe(20);
  });

  it("dead is asleep with no model call even with energy", () => {
    const d = decideTier(s({ energy: 5000, dead: true }), "high");
    expect(d).toMatchObject({ tier: "asleep", model_call: false, cost: 0 });
  });

  it("history7 keeps only the last 7 days", () => {
    const out = midnight(s({ history7: [1, 2, 3, 4, 5, 6, 7], steps_today: 8 }), false);
    expect(out.history7).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it("death writes a gravestone with the favourite memory, and newSpore does not duplicate it", () => {
    const dead = midnight(
      s({ lifetime_steps: 8000, stage: "Sprout", zero_days: 3, age_days: 10 }),
      false,
      "the walk to the sea"
    );
    expect(dead.gravestones).toEqual([
      { age_days: 11, lifetime_steps: 8000, stage: "Sprout", memory: "the walk to the sea" }
    ]);
    const fresh = newSpore(dead);
    expect(fresh.gravestones).toHaveLength(1);
    expect(fresh.dead).toBe(false);
  });

  it("burrowed day cannot cause death", () => {
    const out = midnight(s({ zero_days: 3, burrowed: true }), false);
    expect(out.dead).toBe(false);
    expect(out.zero_days).toBe(3);
  });

  it("midnight on a dead state is a no-op", () => {
    const st = s({ dead: true, age_days: 5 });
    expect(midnight(st, false)).toEqual(st);
  });

  it("gravestones are capped at 20, newest last", () => {
    const stones = Array.from({ length: MAX_GRAVESTONES }, (_, i) => ({
      age_days: i,
      lifetime_steps: 0,
      stage: "Spore" as const,
      memory: null
    }));
    const out = newSpore(s({ dead: true, age_days: 99, gravestones: stones }));
    expect(out.gravestones).toHaveLength(MAX_GRAVESTONES);
    expect(out.gravestones[MAX_GRAVESTONES - 1].age_days).toBe(99);
    expect(out.gravestones[0].age_days).toBe(1);
  });

  it("feed ignores non-finite totals", () => {
    const st = s({ energy: 10, steps_today: 10 });
    expect(feed(st, Number.NaN)).toEqual(st);
  });

  it("state block keeps weather quotes from breaking the line", () => {
    const line = stateBlock(s({}), { lang: "en", weather_text: 'say "hi"]\nnow' });
    expect(line).toContain(`weather="say 'hi'  now"`);
    expect(line.split("\n")).toHaveLength(1);
  });
});

describe("decideTier input hardening", () => {
  it("ignores an unknown requested tier instead of crashing", () => {
    const state = { ...DEFAULT_STATE, energy: 5000, lifetime_steps: 4000 };
    const bogus = "ultra" as unknown as Tier;
    expect(decideTier(state, bogus).tier).toBe("high");
    expect(decideTier(state, bogus).cost).toBe(200);
  });
});

describe("S10 hardening", () => {
  it("feed ignores fractional, negative and unsafe totals", () => {
    const state = { ...DEFAULT_STATE, energy: 100, steps_today: 100, lifetime_steps: 100 };
    for (const bad of [100.5, -1, Number.MAX_SAFE_INTEGER + 2, NaN, Infinity]) {
      expect(feed(state, bad)).toEqual(state);
    }
  });
  it("newSpore on a living Truffle is a no-op", () => {
    const state = { ...DEFAULT_STATE, energy: 3000, lifetime_steps: 3000, steps_today: 3000 };
    expect(newSpore(state)).toEqual(state);
  });
});
