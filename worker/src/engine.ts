// Truffle energy engine. PURE: no fetch, no Date.now, no randomness.
// Time and weather are passed in. This file is spec-by-test against
// tests/golden/energy_cases.json. Contract below is shared with the DO (B02);
// B01 implements the bodies and must keep every exported name and signature.

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

const NOT_IMPLEMENTED = "engine: implemented by packet B01";

/** Stage from lifetime_steps. */
export function deriveStage(lifetime_steps: number): Stage {
  throw new Error(NOT_IMPLEMENTED);
}

/** energy_max and burn for a stage. */
export function stageConfig(stage: Stage): { energy_max: number; burn: number } {
  throw new Error(NOT_IMPLEMENTED);
}

/** Derived mood in spec priority order. Never stored. */
export function moodOf(state: TruffleState): Mood {
  throw new Error(NOT_IMPLEMENTED);
}

/**
 * Tier for the next message. requested is capped by what energy allows.
 * Does not spend. energy < cost -> drop one tier; energy < 20 -> asleep.
 */
export function decideTier(state: TruffleState, requested?: Tier): TierDecision {
  throw new Error(NOT_IMPLEMENTED);
}

/** Deduct the tier cost after a reply was produced. */
export function chargeChat(state: TruffleState, decision: TierDecision): TruffleState {
  throw new Error(NOT_IMPLEMENTED);
}

/** /feed with an absolute total since local midnight. Dead Truffle: no-op. */
export function feed(state: TruffleState, steps_today_total: number): TruffleState {
  throw new Error(NOT_IMPLEMENTED);
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
  throw new Error(NOT_IMPLEMENTED);
}

/** Burrow decision from the daytime (06:00-22:00 local) max apparent temperature. */
export function shouldBurrow(apparent_temperature_daytime_max_c: number): boolean {
  throw new Error(NOT_IMPLEMENTED);
}

/** After death: fresh Spore, gravestones kept (max 20). */
export function newSpore(state: TruffleState): TruffleState {
  throw new Error(NOT_IMPLEMENTED);
}

/** The exact one-line block the model sees. String-for-string per golden case 30. */
export function stateBlock(
  state: TruffleState,
  opts: { lang: "ar" | "en"; weather_text: string }
): string {
  throw new Error(NOT_IMPLEMENTED);
}
