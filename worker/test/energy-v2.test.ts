import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";
import type { Stage, Tier } from "../src/config";
import * as E from "../src/engine";

const DAY = 86_400_000;
const start = (over: Partial<E.TruffleState> = {}, at = 0): E.TruffleState =>
  E.initializeV2({ ...E.DEFAULT_STATE, history7: [], gravestones: [], ...over }, at);

interface V2Case {
  id: string;
  state?: Partial<E.TruffleState>;
  events: Array<{ type: string; total?: number; at?: number; held?: number; tier?: Tier; count?: number; value?: boolean }>;
  expect: Record<string, unknown>;
}
const fixtures = JSON.parse(readFileSync(new URL("../../tests/golden/energy_v2_cases.json", import.meta.url), "utf8")) as { cases: V2Case[] };

describe("energy v2, decision 0023", () => {
  it("preserves newly accepted overflow in the expanded Sprout capacity", () => {
    const state = { ...E.DEFAULT_STATE, energy_version: 2, energy_units: 0, energy_settled_ms: 0, empty_ms: 0 } as E.TruffleState;
    expect(E.feed(state, 15000).energy).toBe(15000);
  });

  for (const c of fixtures.cases) {
    it(c.id, () => {
      let state = start(c.state);
      for (const event of c.events) {
        const frozen = JSON.stringify(state);
        let after: E.TruffleState;
        switch (event.type) {
          case "feed": after = E.feed(state, event.total!); break;
          case "settle": after = E.settleV2(state, event.at!, event.held); break;
          case "midnight": after = E.midnight(state, false); break;
          case "heat": after = { ...state, burrowed: event.value! }; break;
          case "chat":
            after = state;
            for (let i = 0; i < (event.count ?? 1); i++) after = E.chargeChat(after, E.decideTier(after, event.tier));
            break;
          default: throw new Error(`unknown v2 fixture event ${event.type}`);
        }
        expect(JSON.stringify(state), "pure input").toBe(frozen);
        state = after;
      }
      const view = { ...state, tier: E.decideTier(state).tier, gravestones_count: state.gravestones.length };
      expect(view).toMatchObject(c.expect);
    });
  }

  for (const stage of ["Spore", "Sprout", "Truffle", "Elder"] as Stage[]) {
    for (const [energy, tier] of [[19, "asleep"], [20, "low"], [1499, "low"], [1500, "medium"], [3599, "medium"], [3600, "high"]] as const) {
      it(`${stage} has absolute eligibility ${energy} -> ${tier}`, () => {
        expect(E.allowedTier(start({ stage, energy }))).toBe(tier);
        expect(E.decideTier(start({ stage, energy })).tier).toBe(tier);
      });
    }
  }

  it("keeps exact fractional food across thousands of reads", () => {
    const original = start({ energy: 1234 });
    let split = original;
    for (let i = 1; i <= 5000; i++) split = E.settleV2(split, i * 37);
    expect(split).toEqual(E.settleV2(original, 185000));
    expect(split.energy_units).toBe(106432600000);
    expect(split.energy).toBe(1231);
  });

  it("keeps the same exact death time across reads and records one favourite memory", () => {
    const original = start({ energy: 1, age_days: 12 });
    let split = original;
    for (let at = 100000; at < 400000000; at += 100000) split = E.settleV2(split, at, 0, "the sea");
    split = E.settleV2(split, 400000000, 0, "the sea");
    expect(split).toEqual(E.settleV2(original, 400000000, 0, "the sea"));
    expect(split.died_ms).toBe(345686400);
    expect(split.gravestones).toEqual([{ age_days: 12, lifetime_steps: 0, stage: "Spore", memory: "the sea" }]);
  });

  it("does not rewind or refund on backward or repeated timestamps", () => {
    const state = E.settleV2(start({ energy: 1000 }), 200000);
    expect(E.settleV2(state, 100000)).toEqual(state);
    expect(E.settleV2(state, 200000)).toEqual(state);
    expect(E.settleV2(E.settleV2(state, 100000), 300000)).toEqual(E.settleV2(state, 300000));
  });

  it("bounds huge elapsed intervals before multiplication", () => {
    const state = E.settleV2(start({ energy: 42000, stage: "Elder" }), Number.MAX_SAFE_INTEGER);
    expect(state.energy_units).toBe(0);
    expect(state.empty_ms).toBe(345600000);
    expect(state.died_ms).toBe(3974400000);
    expect(Number.isSafeInteger(state.energy_settled_ms)).toBe(true);
  });

  it("preserves empty duration on duplicate and invalid feeds, then clears it during heat on a real increase", () => {
    const empty = { ...E.settleV2(start(), 3 * DAY), burrowed: true };
    for (const total of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(E.feed(empty, total)).toEqual(empty);
    const fed = E.feed(empty, 1);
    expect(fed).toMatchObject({ empty_ms: 0, zero_days: 0, energy: 1, lifetime_steps: 0 });
    expect(E.moodOf({ ...fed, burrowed: false })).toBe("content");
  });

  it("caps the canonical total while food is reserved and exact commit spends only that hold", () => {
    let state = start({ stage: "Spore", energy: 12000, burrowed: true });
    state = E.settleV2(state, 1000, 200);
    expect(E.availableEnergy(state, 200)).toBe(11800);
    state = E.feed(state, 500);
    expect(state.energy_units).toBe(1036800000000);
    state = E.commitReservedChatV2(state, 200);
    expect(state.energy).toBe(11800);
    expect(state.energy_units).toBe(1019520000000);
  });

  it("returns an unused hold without minting food and immediately clears empty duration", () => {
    const held = E.settleV2(start({ energy: 20 }), 2 * DAY, 20);
    expect(held).toMatchObject({ energy: 20, empty_ms: 2 * DAY, zero_days: 2 });
    const released = E.settleV2(held, 2 * DAY);
    expect(released).toMatchObject({ energy: 20, energy_units: 1728000000, empty_ms: 0, zero_days: 0 });
  });

  it("does not admit held food to another reply", () => {
    const state = start({ energy: 1510 });
    expect(E.allowedTier(state, 20)).toBe("low");
    expect(E.decideTier(state, "high", 20)).toMatchObject({ tier: "low", cost: 20 });
    expect(E.decideTier(start({ energy: 20 }), undefined, 20).tier).toBe("asleep");
  });

  it("rejects an unfunded exact charge instead of claiming a larger clamped debit", () => {
    expect(() => E.commitReservedChatV2(start({ energy: 19 }), 20)).toThrow();
    expect(() => E.commitReservedChatV2(start({ energy: 20 }), 20.5)).toThrow();
  });

  it("initialization is idempotent and cannot erase a fractional balance or rewind the cursor", () => {
    const state = E.settleV2(start({ energy: 20 }, 1000), 1001);
    expect(E.initializeV2(state, 500)).toEqual(state);
    expect(state.energy_units).toBe(1727999000);
  });

  it("migration leaves a dead pet and its graves terminal", () => {
    const grave = { age_days: 7, lifetime_steps: 5000, stage: "Sprout" as const, memory: "a memory" };
    const dead = start({ dead: true, zero_days: 4, age_days: 7, gravestones: [grave] }, 500);
    expect(dead).toMatchObject({ dead: true, zero_days: 4, gravestones: [grave], age_days: 7 });
    expect(E.feed(E.settleV2(dead, DAY), 5000).dead).toBe(true);
    expect(E.settleV2(dead, DAY).gravestones).toEqual([grave]);
  });

  it("explicit new life preserves v2 and starts its empty clock at planting", () => {
    const dead = E.settleV2(start(), 4 * DAY);
    const fresh = E.newSpore(dead, 10 * DAY);
    expect(fresh).toMatchObject({ energy_version: 2, energy_units: 0, energy_settled_ms: 10 * DAY, empty_ms: 0, dead: false, age_days: 0 });
    expect(fresh.died_ms).toBeUndefined();
    expect(fresh.gravestones).toHaveLength(1);
    expect(E.settleV2(fresh, 11 * DAY).empty_ms).toBe(DAY);
  });

  it("uses expanded capacity in v2 prompts and retains the legacy capacity helper behavior", () => {
    expect(E.stateBlock(start({ energy: 6000 }), { lang: "en", weather_text: "clear" })).toContain("energy=50%");
    expect(E.energyCapacity(start({ stage: "Elder" }))).toBe(42000);
    expect(E.energyCapacity(E.DEFAULT_STATE)).toBe(6000);
  });
});
