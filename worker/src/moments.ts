// Proud moments (decision 0017). PURE: no Date.now, no I/O, no randomness.
// The engine notices a real thing the person did. A moment never changes
// energy, tier, mood or death. tests/golden/moment_cases.json is the spec.

import { STAGES } from "./config";
import type { TruffleState } from "./engine";

export type MomentKind =
  | "stage_up"
  | "best_day"
  | "beat_avg7"
  | "day_10k"
  | "streak"
  | "lifetime"
  | "heat_day_indoor";

export interface Moment {
  id: number;
  kind: MomentKind;
  at_ms: number;
  value: number;
}

export interface MomentContext {
  now_ms: number;
  event: "feed" | "midnight" | "spore";
  /** Id of the first moment this call may emit. Ids count up from here. */
  next_id: number;
  /** Once-per-day kinds already fired today. The DO clears it at local midnight. */
  already_today: MomentKind[];
  /**
   * Midnight only: the streak length (completed days at or above the floor)
   * before this midnight, as the DO counts it. history7 holds 7 days, so a 14
   * or 30 day streak needs this. Absent: counted from before.history7.
   */
  streak_before?: number;
}

/** Kept in the DO: the last 20, ascending id. */
export const MAX_MOMENTS = 20;
export const BEST_DAY_MIN_STEPS = 2000;
export const DAY_10K_STEPS = 10000;
export const HEAT_DAY_MIN_STEPS = 2000;
export const STREAK_MIN_STEPS = 3000;
export const STREAK_VALUES: readonly number[] = [3, 7, 14, 30];
export const LIFETIME_VALUES: readonly number[] = [10000, 50000, 100000, 250000, 500000];
/** Kinds that fire at most once per local day. */
export const ONCE_PER_DAY: readonly MomentKind[] = ["best_day", "beat_avg7", "day_10k", "heat_day_indoor"];

function stageIndex(stage: TruffleState["stage"]): number {
  return Math.max(0, STAGES.findIndex((s) => s.name === stage));
}

/** Trailing completed days at or above the streak floor in a history, newest last. */
export function trailingStreak(history: number[]): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0 && history[i] >= STREAK_MIN_STEPS; i--) n++;
  return n;
}

/** Streak length after a midnight closed a day with closedSteps. */
export function nextStreak(streak_before: number, closedSteps: number): number {
  return closedSteps >= STREAK_MIN_STEPS ? streak_before + 1 : 0;
}

type Check = (s: TruffleState) => boolean;

/** Daily kinds as conditions on a state. A kind fires when its condition turns true. */
const DAILY: Array<[MomentKind, Check]> = [
  ["best_day", (s) => s.steps_today >= BEST_DAY_MIN_STEPS && s.history7.every((d) => s.steps_today > d)],
  ["beat_avg7", (s) => s.avg7 > 0 && s.steps_today > s.avg7],
  ["day_10k", (s) => s.steps_today >= DAY_10K_STEPS],
  ["heat_day_indoor", (s) => s.burrowed && s.steps_today >= HEAT_DAY_MIN_STEPS]
];

/**
 * Moments from one event. Order inside one call is fixed: stage_up, then the
 * daily kinds (best_day, beat_avg7, day_10k), streak, lifetime, heat_day_indoor.
 */
export function momentsFor(before: TruffleState, after: TruffleState, ctx: MomentContext): Moment[] {
  if (ctx.event === "spore" || before.dead || after.dead) return [];
  const out: Moment[] = [];
  const emit = (kind: MomentKind, value: number) =>
    out.push({ id: ctx.next_id + out.length, kind, at_ms: ctx.now_ms, value });

  if (ctx.event === "midnight") {
    const closed = after.history7[after.history7.length - 1];
    if (closed === undefined) return [];
    const streak = nextStreak(ctx.streak_before ?? trailingStreak(before.history7), closed);
    if (STREAK_VALUES.includes(streak)) emit("streak", streak);
    return out;
  }

  // event === "feed"
  for (let i = stageIndex(before.stage) + 1; i <= stageIndex(after.stage); i++) emit("stage_up", i);

  const fired = (kind: MomentKind, check: Check) =>
    !ctx.already_today.includes(kind) && check(after) && !check(before);
  const daily = DAILY.filter(([kind, check]) => fired(kind, check)).map(([kind]) => kind);
  for (const kind of daily) {
    if (kind !== "heat_day_indoor") emit(kind, after.steps_today);
  }

  for (const t of LIFETIME_VALUES) {
    if (before.lifetime_steps < t && after.lifetime_steps >= t) emit("lifetime", t);
  }

  if (daily.includes("heat_day_indoor")) emit("heat_day_indoor", after.steps_today);
  return out;
}

/** Append to the ring, keep the newest MAX_MOMENTS, ascending id. */
export function pushMoments(ring: Moment[], add: Moment[]): Moment[] {
  const next = [...ring, ...add];
  return next.length > MAX_MOMENTS ? next.slice(next.length - MAX_MOMENTS) : next;
}

/** already_today after some moments fired: once-per-day kinds are added, no duplicates. */
export function markToday(already: MomentKind[], fired: Moment[]): MomentKind[] {
  const next = [...already];
  for (const m of fired) if (ONCE_PER_DAY.includes(m.kind) && !next.includes(m.kind)) next.push(m.kind);
  return next;
}
