// Golden runner: tests/golden/moment_cases.json is the executable spec of
// momentsFor (decision 0017). Each case merges default_state with before and
// after, runs momentsFor once and asserts the exact list of moments.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, deriveStage, feed, midnight, type TruffleState } from "../src/engine";
import {
  DAY_10K_STEPS,
  LIFETIME_VALUES,
  MAX_MOMENTS,
  ONCE_PER_DAY,
  STREAK_MIN_STEPS,
  STREAK_VALUES,
  momentsFor,
  type Moment,
  type MomentContext,
  type MomentKind
} from "../src/moments";

interface MomentCase {
  id: string;
  before: Partial<TruffleState>;
  after: Partial<TruffleState>;
  ctx: MomentContext;
  expected: Moment[];
  note?: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(
  readFileSync(resolve(here, "../../tests/golden/moment_cases.json"), "utf8")
) as {
  constants: Record<string, unknown>;
  default_state: Partial<TruffleState>;
  cases: MomentCase[];
};

function stateOf(part: Partial<TruffleState>): TruffleState {
  const s: TruffleState = {
    ...DEFAULT_STATE,
    ...golden.default_state,
    ...part,
    history7: [...(part.history7 ?? [])],
    gravestones: [...(part.gravestones ?? [])]
  };
  if (part.stage === undefined) s.stage = deriveStage(s.lifetime_steps);
  return s;
}

describe("golden moment cases", () => {
  it("has at least 25 cases with unique ids", () => {
    expect(golden.cases.length).toBeGreaterThanOrEqual(25);
    expect(new Set(golden.cases.map((c) => c.id)).size).toBe(golden.cases.length);
  });

  it("the constants block matches the code", () => {
    expect(golden.constants).toMatchObject({
      max_moments: MAX_MOMENTS,
      day_10k_steps: DAY_10K_STEPS,
      streak_min_steps: STREAK_MIN_STEPS,
      streak_values: [...STREAK_VALUES],
      lifetime_values: [...LIFETIME_VALUES],
      once_per_day: [...ONCE_PER_DAY]
    });
  });

  it("covers every kind", () => {
    const kinds = new Set(golden.cases.flatMap((c) => c.expected.map((m) => m.kind)));
    const all: MomentKind[] = ["stage_up", "best_day", "beat_avg7", "day_10k", "streak", "lifetime", "heat_day_indoor"];
    for (const k of all) expect(kinds.has(k), k).toBe(true);
  });

  for (const c of golden.cases) {
    it(c.id, () => {
      const before = stateOf(c.before);
      const after = stateOf(c.after);
      const frozen = JSON.stringify([before, after, c.ctx]);
      expect(momentsFor(before, after, c.ctx)).toEqual(c.expected);
      // Purity: inputs are never mutated, and a second call gives the same answer.
      expect(JSON.stringify([before, after, c.ctx])).toBe(frozen);
      expect(momentsFor(before, after, c.ctx)).toEqual(c.expected);
    });

    // The goldens stay honest: every live after state is one the engine really produces.
    if (!c.before.dead && c.ctx.event !== "spore") {
      it(`${c.id} (after state matches the engine)`, () => {
        const before = stateOf(c.before);
        const after = stateOf(c.after);
        if (c.ctx.event === "feed") {
          const real = feed(before, after.steps_today);
          expect({ s: real.steps_today, l: real.lifetime_steps, st: real.stage, b: real.burrowed }).toEqual({
            s: after.steps_today,
            l: after.lifetime_steps,
            st: after.stage,
            b: after.burrowed
          });
        } else {
          const real = midnight(before, after.burrowed);
          expect({ h: real.history7, s: real.steps_today, d: real.dead }).toEqual({
            h: after.history7,
            s: after.steps_today,
            d: after.dead
          });
        }
      });
    }
  }
});
