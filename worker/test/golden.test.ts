// Golden runner: tests/golden/energy_cases.json is the executable spec of the
// energy engine. Each case merges default_state with state, applies one event
// and asserts only the keys present in expect.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Tier } from "../src/config";
import {
  DEFAULT_STATE,
  chargeChat,
  decideTier,
  deriveStage,
  feed,
  midnight,
  moodOf,
  newSpore,
  shouldBurrow,
  stageConfig,
  stateBlock,
  type TruffleState
} from "../src/engine";

interface GoldenCase {
  id: string;
  state: Partial<TruffleState>;
  event: { type: string; [k: string]: unknown };
  expect: Record<string, unknown>;
  note?: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(
  readFileSync(resolve(here, "../../tests/golden/energy_cases.json"), "utf8")
) as { default_state: Partial<TruffleState>; cases: GoldenCase[] };

function startState(c: GoldenCase): TruffleState {
  const merged: TruffleState = {
    ...DEFAULT_STATE,
    ...golden.default_state,
    ...c.state,
    history7: [...(c.state.history7 ?? golden.default_state.history7 ?? [])],
    gravestones: [...(c.state.gravestones ?? [])]
  };
  if (c.state.stage === undefined) merged.stage = deriveStage(merged.lifetime_steps);
  return merged;
}

/** Everything an expect block may name, computed from one event. */
function run(c: GoldenCase, s: TruffleState): Record<string, unknown> {
  const e = c.event;
  const view = (st: TruffleState, extra: Record<string, unknown> = {}) => {
    const d = decideTier(st);
    const sc = stageConfig(st.stage);
    const last = st.gravestones[st.gravestones.length - 1];
    return {
      ...st,
      tier: d.tier,
      model_call: d.model_call,
      thinking: d.thinking,
      max_tokens: d.max_tokens,
      memory_days: d.memory_days,
      mood: moodOf(st),
      energy_max: sc.energy_max,
      burn: sc.burn,
      gravestone: last,
      gravestones_count: st.gravestones.length,
      ...extra
    };
  };
  switch (e.type) {
    case "tier_check":
      return view(s);
    case "feed":
      return view(feed(s, e.steps_today_total as number));
    case "chat": {
      const d = decideTier(s, e.requested_tier as Tier | undefined);
      const after = chargeChat(s, d);
      return { ...view(after), ...d, energy_after: after.energy };
    }
    case "midnight":
      return view(midnight(s, e.burrowed_tomorrow as boolean));
    case "new_spore":
      return view(newSpore(s));
    case "weather":
      return { burrowed: shouldBurrow(e.apparent_temperature_daytime_max_c as number) };
    case "state_block":
      return {
        state_block: stateBlock(s, {
          lang: e.lang as "ar" | "en",
          weather_text: e.weather_text as string
        })
      };
    default:
      throw new Error(`unknown event type ${e.type}`);
  }
}

describe("golden energy cases", () => {
  it("has the 30 original cases plus the 2 S10 feed cases (B06)", () => {
    expect(golden.cases).toHaveLength(32);
    const ids = golden.cases.map((c) => c.id);
    for (let i = 1; i <= 30; i++) {
      expect(ids[i - 1].startsWith(String(i).padStart(2, "0") + "_"), ids[i - 1]).toBe(true);
    }
    expect(ids.slice(30)).toEqual(["S10_feed_fraction_is_noop", "S10_feed_unsafe_integer_is_noop"]);
  });

  for (const c of golden.cases) {
    it(c.id, () => {
      const input = startState(c);
      const frozen = JSON.stringify(input);
      const out = run(c, input);
      for (const [key, want] of Object.entries(c.expect)) {
        const got = out[key];
        if (key === "gravestone") {
          expect(got, key).toMatchObject(want as object);
        } else if (typeof want === "number" && !Number.isInteger(want)) {
          expect(got, key).toBeCloseTo(want, 9);
        } else {
          expect(got, key).toEqual(want);
        }
      }
      // Purity: the input state is never mutated.
      expect(JSON.stringify(input)).toBe(frozen);
    });
  }
});
