// Truffle energy engine constants, v1. Source of truth: docs/01_product_spec.md
// and tests/golden/energy_cases.json (constants block). Change only with a
// decision record in decisions/.

export type Stage = "Spore" | "Sprout" | "Truffle" | "Elder";
export type Tier = "asleep" | "low" | "medium" | "high";

export interface StageConfig {
  name: Stage;
  min_lifetime_steps: number;
  energy_max: number;
  burn: number;
}

export const STAGES: readonly StageConfig[] = [
  { name: "Spore", min_lifetime_steps: 0, energy_max: 6000, burn: 1500 },
  { name: "Sprout", min_lifetime_steps: 5000, energy_max: 12000, burn: 3000 },
  { name: "Truffle", min_lifetime_steps: 30000, energy_max: 20000, burn: 5000 },
  { name: "Elder", min_lifetime_steps: 100000, energy_max: 30000, burn: 7000 }
];

export interface TierConfig {
  cost: number;
  thinking: boolean;
  max_tokens: number;
  /** Days of memory facts allowed in the prompt. null = everything. */
  memory_days: number | null;
}

export const TIERS: Record<Tier, TierConfig> = {
  asleep: { cost: 0, thinking: false, max_tokens: 0, memory_days: 0 },
  low: { cost: 20, thinking: false, max_tokens: 120, memory_days: 1 },
  medium: { cost: 60, thinking: false, max_tokens: 400, memory_days: 7 },
  high: { cost: 200, thinking: true, max_tokens: 1200, memory_days: null }
};

/** ratio = energy / energy_max. low: 0 < r < 0.25, medium: 0.25 <= r < 0.60, high: r >= 0.60 */
export const TIER_MEDIUM_MIN_RATIO = 0.25;
export const TIER_HIGH_MIN_RATIO = 0.6;
/** Below this energy a message is answered as asleep even if ratio > 0. */
export const ASLEEP_BELOW_ENERGY = 20;

export const DEATH_ZERO_DAYS = 4;
export const AFFECTION_MIN_STEPS = 500;
export const AFFECTION_MULTIPLIER = 1.1;
export const AFFECTION_MAX = 5;
export const BURROW_APPARENT_C = 42;
export const MAX_GRAVESTONES = 20;
export const MAX_MEMORY_FACTS = 60;
export const HISTORY_DAYS = 7;

// Continuous food v2. Decision 0023 leaves every v1 constant above unchanged.
export const ENERGY_V2_CUTOVER_MS = Date.parse("2026-10-09T08:43:00Z");
export const ENERGY_V2_UNITS_PER_POINT = 86_400_000;
export const ENERGY_V2_UNITS_PER_MS = 1_000;
export const ENERGY_V2_EMPTY_DEATH_MS = 96 * 60 * 60 * 1_000;
export const ENERGY_V2_MEDIUM_MIN = 1_500;
export const ENERGY_V2_HIGH_MIN = 3_600;
export const ENERGY_V2_CAPACITIES: Readonly<Record<Stage, number>> = {
  Spore: 12_000,
  Sprout: 24_000,
  Truffle: 32_000,
  Elder: 42_000
};
