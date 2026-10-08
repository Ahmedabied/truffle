/** THROWAWAY MODEL, not production code. All dates and forecasts are supplied. */
import assert from "node:assert/strict";
import { DEFAULT_STATE, chargeChat, decideTier, deriveStage, feed, midnight, stageConfig, TIER_ORDER, type TruffleState } from "../../worker/src/engine";
import { TIERS, type Stage, type Tier } from "../../worker/src/config";
import { localDayKey, nextLocalMidnight } from "../../worker/src/time";

export const DAY = 86_400_000;
export const MODELS = ["current", "gentle_continuous", "pantry_current_rate", "pantry_gentle_protected"] as const;
export type Model = typeof MODELS[number];
type Weather = Record<string, boolean>;
export const settings = {
  current: { continuous: false, pantry: false, flat_burn: null, chat_floor: 0 },
  gentle_continuous: { continuous: true, pantry: false, flat_burn: 1000, chat_floor: 0 },
  pantry_current_rate: { continuous: true, pantry: true, flat_burn: null, chat_floor: 0 },
  pantry_gentle_protected: { continuous: true, pantry: true, flat_burn: 1000, chat_floor: 1000 }
} as const;

export class Pet {
  s: TruffleState;
  now: number;
  /** Integer numerator, denominator DAY. A fractional step is never minted or discarded. */
  balanceNum: number;
  emptyMs = 0;
  readonly metrics = { credited: 0, overflow: 0, basal: 0, chat: 0, replies: { high: 0, medium: 0, low: 0, asleep: 0 }, ignored_envelopes: 0, dead_requests: 0 };
  firstEmpty: number | null = null;
  deathAt: number | null = null;
  readonly start: number;
  readonly opening: number;
  constructor(readonly model: Model, at: string | number, initial: Partial<TruffleState> = {}, readonly tz = "Asia/Muscat", readonly weather: Weather = {}) {
    this.now = typeof at === "number" ? at : Date.parse(at);
    this.start = this.now;
    this.s = { ...structuredClone(DEFAULT_STATE), ...initial };
    this.s.stage = deriveStage(this.s.lifetime_steps);
    this.balanceNum = this.s.energy * DAY;
    this.opening = this.s.energy;
  }
  get total() { return this.balanceNum / DAY; }
  get pantry() { return Math.max(0, this.total - stageConfig(this.s.stage).energy_max); }
  get rate() { return settings[this.model].flat_burn ?? stageConfig(this.s.stage).burn; }
  get capacity() {
    const max = stageConfig(this.s.stage).energy_max;
    return max + (settings[this.model].pantry ? Math.min(12000, max) : 0);
  }
  private normalize() { this.s.energy = Math.min(stageConfig(this.s.stage).energy_max, Math.floor(this.total)); }
  private markEmpty() { if (this.balanceNum === 0 && this.firstEmpty === null) this.firstEmpty = this.now; }
  private elapse(to: number) {
    assert(to >= this.now, "cannot rewind the clock");
    if (!settings[this.model].continuous || this.s.dead || this.s.burrowed) { this.now = to; return; }
    const dt = to - this.now;
    const liveMs = Math.min(dt, Math.ceil(this.balanceNum / this.rate));
    const spent = Math.min(this.balanceNum, dt * this.rate);
    assert(Number.isSafeInteger(spent));
    this.balanceNum -= spent;
    this.metrics.basal += spent / DAY;
    if (this.balanceNum === 0) {
      if (this.firstEmpty === null) this.firstEmpty = this.now + liveMs;
      const newEmptyMs = dt - liveMs;
      if (this.emptyMs + newEmptyMs >= 4 * DAY) {
        this.deathAt = this.now + liveMs + (4 * DAY - this.emptyMs);
        this.s.dead = true;
        this.emptyMs = 4 * DAY;
      } else this.emptyMs += newEmptyMs;
    }
    this.s.zero_days = Math.floor(this.emptyMs / DAY);
    this.now = to;
    this.normalize();
  }
  /** Split at real local boundaries; stage changes are settled before feed. Missing weather retains protection. */
  advance(to: string | number) {
    const target = typeof to === "number" ? to : Date.parse(to);
    assert(target >= this.now);
    while (nextLocalMidnight(this.now, this.tz) <= target) {
      const at = nextLocalMidnight(this.now, this.tz);
      this.elapse(at);
      const nextBurrow = this.weather[localDayKey(at, this.tz)] ?? this.s.burrowed;
      if (this.model === "current") {
        const before = this.s.energy;
        this.s = midnight(this.s, nextBurrow);
        this.metrics.basal += before - this.s.energy;
        this.balanceNum = this.s.energy * DAY;
        if (this.s.dead && this.deathAt === null) this.deathAt = at;
        this.markEmpty();
      } else {
        // Reuse only production calendar/affection/history semantics. Artificial heat
        // here prevents production's lump burn/zero-days/death, replaced above.
        if (!this.s.dead) this.s = midnight({ ...this.s, burrowed: true }, nextBurrow);
        this.normalize();
      }
    }
    this.elapse(target);
    this.invariant();
    return this;
  }
  feed(total: number, day = localDayKey(this.now, this.tz), dayTz = this.tz) {
    if (day !== localDayKey(this.now, this.tz) || dayTz !== this.tz) { this.metrics.ignored_envelopes++; return this; }
    const before = this.s;
    const after = feed(before, total);
    const delta = after.steps_today - before.steps_today;
    if (delta <= 0) return this;
    this.metrics.credited += delta;
    if (this.model === "current") {
      this.metrics.overflow += before.energy + delta - after.energy;
      this.s = after;
      this.balanceNum = after.energy * DAY;
    } else {
      this.s = after;
      const added = this.balanceNum + delta * DAY;
      this.balanceNum = Math.min(this.capacity * DAY, added);
      this.metrics.overflow += (added - this.balanceNum) / DAY;
      this.emptyMs = 0;
      this.s.zero_days = 0;
      this.normalize();
    }
    this.invariant();
    return this;
  }
  /** Simulated successful requested reply. No network/provider invocation. */
  chat(requested?: Tier, visible = true) {
    if (this.s.dead) { this.metrics.dead_requests++; return this; }
    let decision = decideTier(this.s, requested);
    const floor = settings[this.model].chat_floor;
    while (decision.cost > Math.max(0, Math.floor(this.total) - floor)) {
      decision = decideTier(this.s, TIER_ORDER[TIER_ORDER.indexOf(decision.tier) - 1]);
    }
    if (!visible) return this;
    this.metrics.replies[decision.tier]++;
    if (this.model === "current") {
      this.s = chargeChat(this.s, decision);
      this.balanceNum = this.s.energy * DAY;
    } else {
      this.balanceNum -= decision.cost * DAY;
      this.normalize();
    }
    this.metrics.chat += decision.cost;
    this.markEmpty();
    this.invariant();
    return this;
  }
  invariant() {
    assert(this.balanceNum >= 0 && this.balanceNum <= this.capacity * DAY);
    assert(Number.isSafeInteger(this.balanceNum));
    assert(this.s.energy >= 0 && this.s.energy <= stageConfig(this.s.stage).energy_max);
    assert(Math.abs(this.opening + this.metrics.credited - this.total - this.metrics.basal - this.metrics.chat - this.metrics.overflow) < 1e-6, "every credited point has an account");
  }
  snapshot() {
    const round = (n: number) => Math.round(n * 1e6) / 1e6;
    return { at: new Date(this.now).toISOString(), stage: this.s.stage, ready: this.s.energy, stored: round(this.pantry), total: round(this.total), tier: decideTier(this.s).tier, zero_days: this.s.zero_days, dead: this.s.dead, burrowed: this.s.burrowed, lifetime_steps: this.s.lifetime_steps, steps_today: this.s.steps_today, first_empty_hours: this.firstEmpty === null ? null : round((this.firstEmpty - this.start) / 3600000), death_hours: this.deathAt === null ? null : round((this.deathAt - this.start) / 3600000), credited: this.metrics.credited, overflow: round(this.metrics.overflow), basal: round(this.metrics.basal), chat_spend: this.metrics.chat, replies: { ...this.metrics.replies }, ignored_envelopes: this.metrics.ignored_envelopes, dead_requests: this.metrics.dead_requests };
  }
}

export const minLife: Record<Stage, number> = { Spore: 0, Sprout: 5000, Truffle: 30000, Elder: 100000 };
export const costs = Object.fromEntries(Object.entries(TIERS).map(([k, v]) => [k, v.cost]));
