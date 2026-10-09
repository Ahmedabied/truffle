import type { CompanionNote } from "./copy";
import type { Intent, OutingKind } from "./intent";

export const REACTION_MS = 6_000;
export const PULSE_GAP_MS = 10_000;
export const OUTING_MS = 6 * 3_600_000;
export const RETURN_MS = 30_000;
export const GENERIC_RETURN_MS = 10 * 60_000;
export type ReactionKind = "happy" | "anticipating";
type Cursor = { day: string; acceptedTotal: number; lifetimeTotal: number };
type Outing = { kind: OutingKind; declaredAt: number; expiresAt: number; leftAt?: number; source: "button" | "chat" };
export interface CompanionState {
  version: 1;
  scope: string;
  quietNotes: boolean;
  lastAt: number;
  cursor?: Cursor;
  outing?: Outing;
  hiddenAt?: number;
  pendingReturn?: { cameBackAt: number; awayMs: number; declaredAt?: number };
  reaction?: { kind: ReactionKind; until: number; startedAt: number };
  lastPulseAt?: number;
  nativeEvents: string[];
}
export type PersistedCompanion = Pick<CompanionState, "version" | "scope" | "quietNotes" | "lastAt" | "cursor" | "outing" | "hiddenAt">;
export interface CompanionSnapshot {
  generation?: number;
  local_day: string;
  state: { steps_today: number; lifetime_steps: number; dead: boolean };
  mood: string;
}
export interface CompanionContext {
  scope: string;
  generation: number;
  demo: boolean;
  ready: boolean;
  visible: boolean;
  alive: boolean;
  burrowed: boolean;
  /** Only set after this document's native fragment import was verified. */
  nativeScope?: string;
}
export interface MovementEvent {
  type: "movement";
  scope: string;
  nativeScope: string;
  version: 1;
  eventId: string;
  delta: number;
  observedAt: number;
  intervalMs: number;
  at: number;
}
export type CompanionEvent =
  | { type: "snapshot"; scope: string; summary: CompanionSnapshot; at: number; fresh: boolean }
  | { type: "intent"; intent: Intent; source: "button" | "chat"; at: number }
  | MovementEvent
  | { type: "hidden" | "visible" | "tick"; at: number }
  | { type: "reset"; scope: string; at: number };
export type CompanionEffect =
  | { type: "reaction"; reaction: ReactionKind | null }
  | { type: "note"; note: CompanionNote }
  | { type: "persist" }
  | { type: "refresh" };

const time = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
const count = time;
const kind = (v: unknown): v is OutingKind => v === "walk" || v === "errand";
function day(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
}
function cursor(value: unknown): value is Cursor {
  const c = value as Partial<Cursor> | null;
  return !!c && day(c.day) && count(c.acceptedTotal) && count(c.lifetimeTotal) && c.lifetimeTotal >= c.acceptedTotal;
}

export function companionScope(origin: string, pet: string, demo: boolean, generation: number): string {
  if (!count(generation) || !pet) throw new Error("A verified pet and server generation are required");
  return `truffle.companion@${new URL(origin).origin}/${demo ? "demo" : "real"}/${encodeURIComponent(pet)}/${generation}`;
}
export function initialCompanion(scope: string, now: number): CompanionState {
  return { version: 1, scope, quietNotes: false, lastAt: time(now) ? now : 0, nativeEvents: [] };
}
export function persistCompanion(state: CompanionState): PersistedCompanion {
  return { version: 1, scope: state.scope, quietNotes: state.quietNotes, lastAt: state.lastAt,
    ...(state.cursor ? { cursor: { ...state.cursor } } : {}),
    ...(state.outing ? { outing: { ...state.outing } } : {}),
    ...(state.hiddenAt !== undefined ? { hiddenAt: state.hiddenAt } : {}) };
}
/** Validate untrusted decoded storage; never restore a pulse or native replay queue. */
export function readCompanion(raw: unknown, scope: string, now: number): CompanionState {
  const result = initialCompanion(scope, now);
  const value = raw as Partial<PersistedCompanion> | null;
  if (!value || value.version !== 1 || value.scope !== scope || !time(now)) return result;
  result.quietNotes = value.quietNotes === true;
  if (cursor(value.cursor)) result.cursor = { ...value.cursor };
  if (time(value.lastAt)) result.lastAt = Math.max(now, value.lastAt);
  if (result.lastAt > now) return result; // Rollback cannot resurrect an old plan.
  const o = value.outing;
  if (o && kind(o.kind) && (o.source === "button" || o.source === "chat") && time(o.declaredAt)
    && o.declaredAt <= now && time(o.expiresAt) && o.expiresAt === o.declaredAt + OUTING_MS && o.expiresAt > now) {
    result.outing = { kind: o.kind, source: o.source, declaredAt: o.declaredAt, expiresAt: o.expiresAt };
    if (time(o.leftAt) && o.leftAt >= o.declaredAt && o.leftAt <= now) result.outing.leftAt = o.leftAt;
  }
  if (time(value.hiddenAt) && value.hiddenAt <= now) result.hiddenAt = value.hiddenAt;
  return result;
}

/** Payload validation does not grant native authority. The reducer also checks the import scope. */
export function readMovement(raw: unknown, nativeScope: string, scope: string, at: number): MovementEvent | null {
  const value = raw as Partial<MovementEvent> | null;
  if (!nativeScope || !value || value.scope !== nativeScope || value.version !== 1 || typeof value.eventId !== "string" || !/^[\w:.-]{1,96}$/.test(value.eventId)
    || !count(value.delta) || value.delta < 3 || value.delta > 1000
    || !time(value.intervalMs) || value.intervalMs < 1 || value.intervalMs > 30_000
    || !time(value.observedAt) || !time(at) || value.observedAt > at || at - value.observedAt > 15_000) return null;
  return { type: "movement", scope, nativeScope, version: 1, eventId: value.eventId, delta: value.delta,
    intervalMs: value.intervalMs, observedAt: value.observedAt, at };
}

/** Pure presentation reducer. No effect can feed, chat, pair, notify, or alter server health. */
export function reduceCompanion(previous: CompanionState, event: CompanionEvent, context: CompanionContext): { state: CompanionState; effects: CompanionEffect[] } {
  let state: CompanionState = previous.scope === context.scope ? { ...previous } : initialCompanion(context.scope, event.at);
  const effects: CompanionEffect[] = [];
  const clear = () => { delete state.outing; delete state.pendingReturn; delete state.hiddenAt; delete state.reaction; };
  const finish = () => {
    if (previous.reaction?.kind !== state.reaction?.kind || previous.reaction?.until !== state.reaction?.until) {
      effects.push({ type: "reaction", reaction: state.reaction?.kind ?? null });
    }
    if (JSON.stringify(persistCompanion(previous)) !== JSON.stringify(persistCompanion(state))) effects.push({ type: "persist" });
    return { state, effects };
  };
  if (!time(event.at) || event.at < state.lastAt) { clear(); return finish(); }
  state.lastAt = event.at;
  if (event.type === "reset") { state = initialCompanion(context.scope, event.at); return finish(); }
  if (!context.ready || !count(context.generation) || !context.alive) { clear(); return finish(); }
  if (state.reaction && (state.reaction.until <= event.at || !context.visible || context.burrowed)) delete state.reaction;
  if (state.outing && state.outing.expiresAt <= event.at) delete state.outing;
  const pulse = (reaction: ReactionKind, explicit = false) => {
    if (!context.visible || context.burrowed) return;
    if (!explicit && state.lastPulseAt !== undefined && event.at - state.lastPulseAt < PULSE_GAP_MS) return;
    const startedAt = state.reaction?.startedAt ?? event.at;
    const until = Math.min(event.at + REACTION_MS, startedAt + 12_000);
    if (until <= event.at) return;
    state.reaction = { kind: reaction, until, startedAt };
    state.lastPulseAt = event.at;
  };
  if (event.type === "hidden") {
    state.hiddenAt ??= event.at;
    if (state.outing && state.outing.leftAt === undefined) state.outing = { ...state.outing, leftAt: event.at };
    delete state.reaction;
  } else if (event.type === "visible") {
    if (state.hiddenAt !== undefined) {
      const awayMs = event.at - state.hiddenAt;
      if (!state.quietNotes && (state.outing ? awayMs >= RETURN_MS : awayMs >= GENERIC_RETURN_MS)) {
        state.pendingReturn = { cameBackAt: event.at, awayMs, ...(state.outing ? { declaredAt: state.outing.declaredAt } : {}) };
        effects.push({ type: "refresh" });
      }
      delete state.hiddenAt;
    }
  } else if (event.type === "snapshot") {
    const s = event.summary;
    if (!event.fresh || event.scope !== context.scope || s.generation !== context.generation || !day(s.local_day)
      || !count(s.state.steps_today) || !count(s.state.lifetime_steps) || s.state.lifetime_steps < s.state.steps_today) return finish();
    if (s.state.dead || s.mood === "dead") { clear(); return finish(); }
    if (s.mood === "burrowed") delete state.reaction;
    const next = { day: s.local_day, acceptedTotal: s.state.steps_today, lifetimeTotal: s.state.lifetime_steps };
    const old = state.cursor;
    if (old && (next.day < old.day || next.lifetimeTotal < old.lifetimeTotal
      || (next.day === old.day && (next.acceptedTotal < old.acceptedTotal
        || next.acceptedTotal - old.acceptedTotal > next.lifetimeTotal - old.lifetimeTotal)))) return finish();
    state.cursor = next;
    if (old && next.day === old.day && next.acceptedTotal > old.acceptedTotal && s.mood !== "burrowed") pulse("happy");
    if (state.pendingReturn && context.visible && event.at >= state.pendingReturn.cameBackAt) {
      const pending = state.pendingReturn;
      const declared = state.outing && state.outing.declaredAt === pending.declaredAt ? state.outing : undefined;
      if (!state.quietNotes && (declared || pending.awayMs >= GENERIC_RETURN_MS)) effects.push({ type: "note", note: context.burrowed || s.mood === "burrowed" ? { type: "heat" } : { type: "return", ...(declared ? { kind: declared.kind } : {}) } });
      if (declared) delete state.outing;
      delete state.pendingReturn;
    }
  } else if (event.type === "movement") {
    if (context.demo || event.scope !== context.scope || !context.nativeScope || event.nativeScope !== context.nativeScope
      || !readMovement({ ...event, scope: event.nativeScope }, context.nativeScope, context.scope, event.at)
      || state.nativeEvents.includes(event.eventId)) return finish();
    state.nativeEvents = [...state.nativeEvents.slice(-127), event.eventId];
    pulse("happy");
  } else if (event.type === "intent") {
    const intent = event.intent;
    if (intent.type === "quiet") {
      state.quietNotes = true;
      clear();
      effects.push({ type: "note", note: { type: "quiet" } });
    } else if (intent.type === "cancel") {
      if (!intent.kind || state.outing?.kind === intent.kind) {
        delete state.outing; delete state.pendingReturn;
        if (state.reaction?.kind === "anticipating") delete state.reaction;
      }
    } else if (intent.type === "back") {
      if (state.outing && (!intent.kind || intent.kind === state.outing.kind)) {
        const declared = state.outing;
        delete state.outing; delete state.pendingReturn; delete state.hiddenAt;
        pulse("happy", true);
        if (event.source === "button") effects.push({ type: "note", note: context.burrowed ? { type: "heat" } : { type: "return", kind: declared.kind } });
      }
    } else if (intent.type === "plan" && (!state.quietNotes || event.source === "button")) {
      state.outing = { kind: intent.kind, source: event.source, declaredAt: event.at, expiresAt: event.at + OUTING_MS };
      delete state.pendingReturn;
      pulse("anticipating", true);
      if (event.source === "button") effects.push({ type: "note", note: context.burrowed ? { type: "heat" } : { type: "plan", kind: intent.kind } });
    }
  }
  return finish();
}
