// Truffle energy engine. PURE: no fetch, no Date.now, no randomness.
// Time and weather are passed in. This file is spec-by-test against
// tests/golden/energy_cases.json. Contract below is shared with the DO (B02);
// B01 implements the bodies and must keep every exported name and signature.

import {
  AFFECTION_MAX,
  AFFECTION_MIN_STEPS,
  AFFECTION_MULTIPLIER,
  ASLEEP_BELOW_ENERGY,
  BURROW_APPARENT_C,
  DEATH_ZERO_DAYS,
  HISTORY_DAYS,
  MAX_GRAVESTONES,
  STAGES,
  TIERS,
  TIER_HIGH_MIN_RATIO,
  TIER_MEDIUM_MIN_RATIO
} from "./config";
import type { Stage, Tier } from "./config";

export type Mood =
  | "dead"
  | "burrowed"
  | "wilting"
  | "tired"
  | "asleep"
  | "affectionate"
  | "content";

export interface Gravestone {
  age_days: number;
  lifetime_steps: number;
  stage: Stage;
  /** One favourite memory, or null if none. */
  memory: string | null;
}

export interface TruffleState {
  energy: number;
  lifetime_steps: number;
  stage: Stage;
  zero_days: number;
  affection: number;
  age_days: number;
  steps_today: number;
  avg7: number;
  /** Last 7 completed days' steps, oldest first. */
  history7: number[];
  burrowed: boolean;
  dead: boolean;
  gravestones: Gravestone[];
}

export interface TierDecision {
  tier: Tier;
  model_call: boolean;
  thinking: boolean;
  max_tokens: number;
  memory_days: number | null;
  cost: number;
}

export const DEFAULT_STATE: TruffleState = {
  energy: 0,
  lifetime_steps: 0,
  stage: "Spore",
  zero_days: 0,
  affection: 0,
  age_days: 0,
  steps_today: 0,
  avg7: 0,
  history7: [],
  burrowed: false,
  dead: false,
  gravestones: []
};

/** Tiers from least to most effort. Index arithmetic drives capping and dropping. */
export const TIER_ORDER: readonly Tier[] = ["asleep", "low", "medium", "high"];

/** Copy a state so callers never see shared arrays or gravestone objects. */
function cloneState(state: TruffleState): TruffleState {
  return {
    ...state,
    history7: [...state.history7],
    gravestones: state.gravestones.map((g) => ({ ...g }))
  };
}

function lowerTier(a: Tier, b: Tier): Tier {
  return TIER_ORDER.indexOf(a) <= TIER_ORDER.indexOf(b) ? a : b;
}

function decisionFor(tier: Tier): TierDecision {
  const t = TIERS[tier];
  return {
    tier,
    model_call: tier !== "asleep",
    thinking: t.thinking,
    max_tokens: t.max_tokens,
    memory_days: t.memory_days,
    cost: t.cost
  };
}

function sameGravestone(a: Gravestone, b: Gravestone): boolean {
  return a.age_days === b.age_days && a.lifetime_steps === b.lifetime_steps && a.stage === b.stage;
}

function pushGravestone(list: Gravestone[], g: Gravestone): Gravestone[] {
  const next = [...list, g];
  return next.length > MAX_GRAVESTONES ? next.slice(next.length - MAX_GRAVESTONES) : next;
}

/** Stage from lifetime_steps. */
export function deriveStage(lifetime_steps: number): Stage {
  let stage: Stage = STAGES[0].name;
  for (const s of STAGES) {
    if (lifetime_steps >= s.min_lifetime_steps) stage = s.name;
  }
  return stage;
}

/** energy_max and burn for a stage. */
export function stageConfig(stage: Stage): { energy_max: number; burn: number } {
  const s = STAGES.find((x) => x.name === stage) ?? STAGES[0];
  return { energy_max: s.energy_max, burn: s.burn };
}

/** Derived mood in spec priority order. Never stored. */
export function moodOf(state: TruffleState): Mood {
  if (state.dead) return "dead";
  if (state.burrowed) return "burrowed";
  if (state.zero_days >= 2) return "wilting";
  if (state.zero_days === 1) return "tired";
  if (state.energy === 0) return "asleep";
  if (state.affection >= 3) return "affectionate";
  return "content";
}

/** Tier the current energy allows, before any request cap or cost check. */
export function allowedTier(state: TruffleState): Tier {
  if (state.dead || state.energy <= 0) return "asleep";
  const ratio = state.energy / stageConfig(state.stage).energy_max;
  if (ratio >= TIER_HIGH_MIN_RATIO) return "high";
  if (ratio >= TIER_MEDIUM_MIN_RATIO) return "medium";
  return "low";
}

/**
 * Tier for the next message. requested is capped by what energy allows.
 * Does not spend. energy < cost -> drop one tier; energy < 20 -> asleep.
 */
export function decideTier(state: TruffleState, requested?: Tier): TierDecision {
  let tier = allowedTier(state);
  // Unknown strings from clients are ignored, never looked up in TIERS.
  if (requested !== undefined && TIER_ORDER.includes(requested)) tier = lowerTier(tier, requested);
  if (tier !== "asleep" && state.energy < TIERS[tier].cost) {
    tier = TIER_ORDER[TIER_ORDER.indexOf(tier) - 1];
  }
  if (state.energy < ASLEEP_BELOW_ENERGY) tier = "asleep";
  return decisionFor(tier);
}

/** Deduct the tier cost after a reply was produced. */
export function chargeChat(state: TruffleState, decision: TierDecision): TruffleState {
  const next = cloneState(state);
  next.energy = Math.max(0, state.energy - decision.cost);
  return next;
}

/** /feed with an absolute total since local midnight. Dead Truffle: no-op. */
export function feed(state: TruffleState, steps_today_total: number): TruffleState {
  const next = cloneState(state);
  if (state.dead || !Number.isFinite(steps_today_total)) return next;
  const total = Math.floor(steps_today_total);
  const delta = Math.max(0, total - state.steps_today);
  if (delta === 0) return next;
  next.steps_today = total;
  if (!state.burrowed) {
    next.lifetime_steps = state.lifetime_steps + delta;
    next.stage = deriveStage(next.lifetime_steps);
  }
  // Cap against the stage after growth: growth happens the moment the threshold is crossed.
  next.energy = Math.min(stageConfig(next.stage).energy_max, state.energy + delta);
  return next;
}

/**
 * Midnight tick in spec order: close day, affection, burn, zero days, death,
 * age/steps reset, burrowed for the new day. favourite_memory is written on
 * the gravestone if death happens in this tick.
 */
export function midnight(
  state: TruffleState,
  burrowed_tomorrow: boolean,
  favourite_memory: string | null = null
): TruffleState {
  const next = cloneState(state);
  if (state.dead) return next;

  // 1. Close the day.
  const avg7_before = state.avg7;
  const history = [...state.history7, state.steps_today];
  next.history7 = history.length > HISTORY_DAYS ? history.slice(history.length - HISTORY_DAYS) : history;
  next.avg7 = next.history7.reduce((a, b) => a + b, 0) / next.history7.length;

  // 2. Affection.
  const beat =
    state.steps_today >= AFFECTION_MIN_STEPS && state.steps_today > avg7_before * AFFECTION_MULTIPLIER;
  next.affection = beat
    ? Math.min(AFFECTION_MAX, state.affection + 1)
    : Math.max(0, state.affection - 1);

  // 3. Burn, and 4. zero days. Both paused on a burrowed day.
  if (!state.burrowed) {
    next.energy = Math.max(0, state.energy - stageConfig(state.stage).burn);
    next.zero_days = next.energy === 0 ? state.zero_days + 1 : 0;
  }

  // 6. Age and reset. Done before the gravestone so it records midnights survived, per golden 15.
  next.age_days = state.age_days + 1;
  next.steps_today = 0;
  next.burrowed = burrowed_tomorrow;

  // 5. Death. Never on a burrowed day.
  if (!state.burrowed && next.zero_days >= DEATH_ZERO_DAYS) {
    next.dead = true;
    next.gravestones = pushGravestone(next.gravestones, gravestoneOf(next, favourite_memory));
  }
  return next;
}

/** The gravestone a dead state would leave. */
export function gravestoneOf(state: TruffleState, memory: string | null = null): Gravestone {
  return {
    age_days: state.age_days,
    lifetime_steps: state.lifetime_steps,
    stage: state.stage,
    memory
  };
}

/** Burrow decision from the daytime (06:00-22:00 local) max apparent temperature. */
export function shouldBurrow(apparent_temperature_daytime_max_c: number): boolean {
  return apparent_temperature_daytime_max_c >= BURROW_APPARENT_C;
}

/** After death: fresh Spore, gravestones kept (max 20). */
export function newSpore(state: TruffleState): TruffleState {
  let gravestones = state.gravestones.map((g) => ({ ...g }));
  if (state.dead) {
    // midnight() normally wrote the stone already. Write it here only if it is missing.
    const g = gravestoneOf(state);
    const last = gravestones[gravestones.length - 1];
    if (!last || !sameGravestone(last, g)) gravestones = pushGravestone(gravestones, g);
  }
  return { ...cloneState(DEFAULT_STATE), gravestones };
}

/** The exact one-line block the model sees. String-for-string per golden case 30. */
export function stateBlock(
  state: TruffleState,
  opts: { lang: "ar" | "en"; weather_text: string }
): string {
  const pct = Math.round((100 * state.energy) / stageConfig(state.stage).energy_max);
  const tier = decideTier(state).tier;
  const weather = opts.weather_text.replace(/[\]\r\n]/g, " ").replace(/"/g, "'").trim();
  return (
    `[truffle stage=${state.stage} energy=${pct}% tier=${tier} mood=${moodOf(state)}` +
    ` zero_days=${state.zero_days} burrowed=${state.burrowed ? "yes" : "no"}` +
    ` weather="${weather}" lang=${opts.lang} steps_today=${state.steps_today}` +
    ` avg7=${Math.round(state.avg7)} age_days=${state.age_days}]`
  );
}
