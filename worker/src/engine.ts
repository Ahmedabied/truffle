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
  ENERGY_V2_CAPACITIES,
  ENERGY_V2_EMPTY_DEATH_MS,
  ENERGY_V2_HIGH_MIN,
  ENERGY_V2_MEDIUM_MIN,
  ENERGY_V2_UNITS_PER_MS,
  ENERGY_V2_UNITS_PER_POINT,
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
  /** Absent means the unchanged v1 engine. These fields are persisted together. */
  energy_version?: 2;
  /** Canonical food, INCLUDING any uncharged chat reservation. */
  energy_units?: number;
  /** Authoritative elapsed-time cursor. The DO splits weather/day transitions. */
  energy_settled_ms?: number;
  /** Continuous non-sheltered milliseconds with no unreserved food. */
  empty_ms?: number;
  /** Exact v2 death instant; absent for living pets and migrated legacy deaths. */
  died_ms?: number;
  /** Whole-point display of total food, including a pending reservation. */
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

export type V2TruffleState = TruffleState & {
  energy_version: 2;
  energy_units: number;
  energy_settled_ms: number;
  empty_ms: number;
};

function requireV2(state: TruffleState): V2TruffleState {
  if (
    state.energy_version !== 2 ||
    !Number.isSafeInteger(state.energy_units) || (state.energy_units ?? -1) < 0 ||
    !Number.isSafeInteger(state.energy_settled_ms) ||
    !Number.isSafeInteger(state.empty_ms) || (state.empty_ms ?? -1) < 0 ||
    (state.empty_ms ?? Infinity) > ENERGY_V2_EMPTY_DEATH_MS
  ) throw new RangeError("Invalid v2 energy state");
  return state as V2TruffleState;
}

function checkedPointUnits(points: number): number {
  const units = points * ENERGY_V2_UNITS_PER_POINT;
  if (!Number.isSafeInteger(points) || points < 0 || !Number.isSafeInteger(units)) {
    throw new RangeError("Food points must be a non-negative safe integer");
  }
  return units;
}

function unreservedUnits(state: V2TruffleState, heldCost: number): number {
  const units = state.energy_units - checkedPointUnits(heldCost);
  if (units < 0) throw new RangeError("Food reservation exceeds canonical balance");
  return units;
}

/** V2 capacity for a stage; a state argument selects its version's capacity. */
export function energyCapacity(state: TruffleState | Stage): number {
  if (typeof state === "string") return ENERGY_V2_CAPACITIES[state];
  return state.energy_version === 2
    ? ENERGY_V2_CAPACITIES[state.stage]
    : stageConfig(state.stage).energy_max;
}

/** Whole points eligible to spend. Displayed state.energy includes the hold. */
export function availableEnergy(state: TruffleState, heldCost = 0): number {
  return state.energy_version === 2
    ? Math.floor(unreservedUnits(requireV2(state), heldCost) / ENERGY_V2_UNITS_PER_POINT)
    : Math.max(0, state.energy - heldCost);
}

/** Adopt v2 after the caller has closed every applicable v1 midnight. */
export function initializeV2(state: TruffleState, at: number): V2TruffleState {
  if (state.energy_version === 2) return requireV2(cloneState(state));
  if (!Number.isSafeInteger(at)) throw new RangeError("Invalid v2 initialization time");
  return {
    ...cloneState(state),
    energy_version: 2,
    energy_units: checkedPointUnits(state.energy),
    energy_settled_ms: at,
    empty_ms: 0,
    zero_days: state.dead ? state.zero_days : 0
  };
}

/**
 * Settle one interval under the state's existing heat protection. The caller
 * settles to each local midnight / actual heat transition BEFORE changing it.
 * The held chat cost stays inside total food but cannot fund maintenance.
 */
export function settleV2(
  state: TruffleState,
  to: number,
  heldCost = 0,
  memory: string | null = null
): V2TruffleState {
  const next = requireV2(cloneState(state));
  if (!Number.isSafeInteger(to)) throw new RangeError("Invalid v2 settlement time");
  const from = next.energy_settled_ms;
  const end = Math.max(from, to);
  next.energy_settled_ms = end;
  // A terminal pet keeps its food and grave. Moving its cursor permits bounded
  // catch-up to finish without creating another death transition.
  if (next.dead) return next;
  const available = unreservedUnits(next, heldCost);
  if (available > 0) next.empty_ms = 0;
  if (!next.burrowed && end > from) {
    // All engine-created balances are multiples of 1,000 units, so exhaustion
    // is exact at millisecond precision. ceil also safely handles imported
    // integer units smaller than one millisecond of maintenance.
    const fundedMs = Math.ceil(available / ENERGY_V2_UNITS_PER_MS);
    const elapsed = end - from;
    const consumedMs = Math.min(elapsed, fundedMs);
    // Bound time BEFORE multiplication; even a MAX_SAFE_INTEGER gap is safe.
    next.energy_units -= Math.min(available, consumedMs * ENERGY_V2_UNITS_PER_MS);
    const emptyElapsed = elapsed - consumedMs;
    const remainingMs = ENERGY_V2_EMPTY_DEATH_MS - next.empty_ms;
    if (emptyElapsed >= remainingMs) {
      next.empty_ms = ENERGY_V2_EMPTY_DEATH_MS;
      next.dead = true;
      next.died_ms = from + consumedMs + remainingMs;
      next.gravestones = pushGravestone(next.gravestones, gravestoneOf(next, memory));
    } else {
      next.empty_ms += emptyElapsed;
    }
  }
  next.zero_days = Math.floor(next.empty_ms / ENERGY_V2_UNITS_PER_POINT);
  next.energy = Math.floor(next.energy_units / ENERGY_V2_UNITS_PER_POINT);
  return next;
}

/**
 * Debit a generation-fenced reservation exactly once, immediately before its
 * first visible output. Ticket ownership/idempotency belongs to the DO. After
 * this call, its committed ticket must no longer be passed as an active hold.
 */
export function commitReservedChatV2(state: TruffleState, cost: number, remainingHeldCost = 0): V2TruffleState {
  const next = requireV2(cloneState(state));
  if (next.dead) throw new RangeError("Cannot charge a dead pet");
  const units = checkedPointUnits(cost);
  if (units > next.energy_units) throw new RangeError("Reply cost exceeds canonical balance");
  next.energy_units -= units;
  next.energy = Math.floor(next.energy_units / ENERGY_V2_UNITS_PER_POINT);
  if (unreservedUnits(next, remainingHeldCost) > 0) {
    next.empty_ms = 0;
    next.zero_days = 0;
  }
  return next;
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
export function allowedTier(state: TruffleState, heldCost = 0): Tier {
  if (state.energy_version === 2) {
    const available = availableEnergy(state, heldCost);
    if (state.dead || available < ASLEEP_BELOW_ENERGY) return "asleep";
    if (available >= ENERGY_V2_HIGH_MIN) return "high";
    if (available >= ENERGY_V2_MEDIUM_MIN) return "medium";
    return "low";
  }
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
export function decideTier(state: TruffleState, requested?: Tier, heldCost = 0): TierDecision {
  let tier = allowedTier(state, heldCost);
  const energy = state.energy_version === 2 ? availableEnergy(state, heldCost) : state.energy;
  // Unknown strings from clients are ignored, never looked up in TIERS.
  if (requested !== undefined && TIER_ORDER.includes(requested)) tier = lowerTier(tier, requested);
  if (tier !== "asleep" && energy < TIERS[tier].cost) {
    tier = TIER_ORDER[TIER_ORDER.indexOf(tier) - 1];
  }
  if (energy < ASLEEP_BELOW_ENERGY) tier = "asleep";
  return decisionFor(tier);
}

/** Deduct the tier cost after a reply was produced. */
export function chargeChat(state: TruffleState, decision: TierDecision): TruffleState {
  if (state.energy_version === 2) {
    if (state.dead || decision.cost === 0) return cloneState(state);
    return commitReservedChatV2(state, decision.cost);
  }
  const next = cloneState(state);
  next.energy = Math.max(0, state.energy - decision.cost);
  return next;
}

/** /feed with an absolute total since local midnight. Dead Truffle: no-op. */
export function feed(state: TruffleState, steps_today_total: number): TruffleState {
  const next = cloneState(state);
  // Only non-negative safe integers are steps. Anything else is a no-op (S10-08).
  if (state.dead || !Number.isSafeInteger(steps_today_total) || steps_today_total < 0) return next;
  const total = steps_today_total;
  const delta = Math.max(0, total - state.steps_today);
  if (delta === 0) return next;
  next.steps_today = total;
  if (!state.burrowed) {
    next.lifetime_steps = state.lifetime_steps + delta;
    next.stage = deriveStage(next.lifetime_steps);
  }
  // Cap against the stage after growth: growth happens the moment the threshold is crossed.
  if (state.energy_version === 2) {
    const v2 = requireV2(next);
    const capUnits = energyCapacity(next) * ENERGY_V2_UNITS_PER_POINT;
    // Bound the credit before multiplying a potentially huge accepted total.
    const room = Math.max(0, capUnits - v2.energy_units);
    v2.energy_units += Math.min(delta, Math.ceil(room / ENERGY_V2_UNITS_PER_POINT)) * ENERGY_V2_UNITS_PER_POINT;
    v2.energy_units = Math.min(capUnits, v2.energy_units);
    v2.energy = Math.floor(v2.energy_units / ENERGY_V2_UNITS_PER_POINT);
    v2.empty_ms = 0;
    v2.zero_days = 0;
  } else {
    next.energy = Math.min(stageConfig(next.stage).energy_max, state.energy + delta);
  }
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
  if (state.energy_version !== 2 && !state.burrowed) {
    next.energy = Math.max(0, state.energy - stageConfig(state.stage).burn);
    next.zero_days = next.energy === 0 ? state.zero_days + 1 : 0;
  }

  // 6. Age and reset. Done before the gravestone so it records midnights survived, per golden 15.
  next.age_days = state.age_days + 1;
  next.steps_today = 0;
  next.burrowed = burrowed_tomorrow;

  // 5. Death. Never on a burrowed day.
  if (state.energy_version !== 2 && !state.burrowed && next.zero_days >= DEATH_ZERO_DAYS) {
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
export function newSpore(state: TruffleState, at?: number): TruffleState {
  // A living Truffle cannot be replaced. Only death opens the way to a new spore (S10-11).
  if (!state.dead) return cloneState(state);
  let gravestones = state.gravestones.map((g) => ({ ...g }));
  if (state.dead) {
    // midnight() normally wrote the stone already. Write it here only if it is missing.
    const g = gravestoneOf(state);
    const last = gravestones[gravestones.length - 1];
    if (!last || !sameGravestone(last, g)) gravestones = pushGravestone(gravestones, g);
  }
  const fresh = { ...cloneState(DEFAULT_STATE), gravestones };
  // Production callers pass the actual planting time; the old cursor is a
  // deterministic fallback for pure callers that use the legacy signature.
  return state.energy_version === 2
    ? initializeV2(fresh, at ?? requireV2(state).energy_settled_ms)
    : fresh;
}

/**
 * The exact one-line block the model sees. String-for-string per golden case 30.
 * `tier` is the admitted tier the Worker charges and caps (decision 0013). It
 * goes through decideTier, so it can only lower the tier energy allows. Without
 * it the block shows the tier energy allows, as the original goldens expect.
 */
export function stateBlock(
  state: TruffleState,
  opts: { lang: "ar" | "en"; weather_text: string; tier?: Tier }
): string {
  const pct = Math.round((100 * state.energy) / energyCapacity(state));
  const tier = decideTier(state, opts.tier).tier;
  const weather = opts.weather_text.replace(/[\]\r\n]/g, " ").replace(/"/g, "'").trim();
  return (
    `[truffle stage=${state.stage} energy=${pct}% tier=${tier} mood=${moodOf(state)}` +
    ` zero_days=${state.zero_days} burrowed=${state.burrowed ? "yes" : "no"}` +
    ` weather="${weather}" lang=${opts.lang} steps_today=${state.steps_today}` +
    ` avg7=${Math.round(state.avg7)} age_days=${state.age_days}]`
  );
}
