import { describe, expect, it } from "vitest";
import { classifyIntent } from "../src/companion/intent";
import { companionText } from "../src/companion/copy";
import {
  companionScope, initialCompanion, persistCompanion, readCompanion, readMovement, reduceCompanion,
  type CompanionContext, type CompanionEvent, type CompanionSnapshot, type CompanionState,
} from "../src/companion/state";

const now = Date.UTC(2026, 9, 9, 12);
const scope = companionScope("https://one.test/api", "pet-a", false, 3);
const context: CompanionContext = { scope, generation: 3, demo: false, ready: true, visible: true, alive: true, burrowed: false };
const summary = (steps = 4000, day = "2026-10-09", lifetime = steps): CompanionSnapshot => ({
  generation: 3, local_day: day, mood: "content", state: { steps_today: steps, lifetime_steps: lifetime, dead: false },
});
const snapshot = (steps = 4000, at = now, day?: string, lifetime?: number): CompanionEvent => ({
  type: "snapshot", scope, summary: summary(steps, day, lifetime), at, fresh: true,
});
const reduce = (state: CompanionState, event: CompanionEvent, ctx = context) => reduceCompanion(state, event, ctx);
const base = () => reduce(initialCompanion(scope, now), snapshot()).state;
const plan = () => reduce(base(), { type: "intent", intent: { type: "plan", kind: "walk" }, source: "chat", at: now }).state;

describe("conservative companion intent", () => {
  it.each([
    ["I'm going for a walk", "walk"], ["Heading out for groceries", "errand"],
    ["I'm off to the shop", "errand"], ["I'm walking to the store now", "errand"],
    ["I am going shopping", "errand"], ["I’m heading out for a walk now!", "walk"],
    ["أنا طالع أمشي", "walk"], ["بروح البقالة", "errand"], ["رايح أقضي أغراض", "errand"],
    ["أنا رايحة أتمشى", "walk"], ["بطلع أمشي الحين", "walk"],
  ])("recognizes an explicit present plan: %s", (text, kind) => {
    expect(classifyIntent(text)).toEqual({ type: "plan", kind });
  });
  it.each([
    "I walked yesterday", "I went for groceries", "Maybe I'll walk", "If I go for groceries",
    "Should I walk?", "I'm going for a walk?", "She is going for a walk",
    "My friend said 'I'm going shopping'", '"I am going for a walk"', "Walk me through this",
    "Help me make a grocery list", "I'm going for a walk if it stops raining",
    "I'm going shopping, but actually I'm not", "I was going for a walk", "I want to go for a walk",
    "I'm not sure if I'm going shopping", "Tomorrow I might go walking", "I am going for a walk in a game",
    "Not back yet", "If I come back", "I am back in the example sentence",
    "رحت البقالة أمس", "كنت أمشي", "يمكن أطلع", "لو رحت البقالة", "أفكر أمشي",
    "هو رايح البقالة", "قالت أنا طالع أمشي", "اشرح لي خطوة خطوة", "لسه ما رجعت", "لو رجعت",
    "بروح البقالة إذا فضيت", "أنا طالع أمشي؟", "أنا طالع أمشي بس يمكن لا", "لا تقول أنا طالع أمشي",
    "My friend said stop reminding me", "If I say stop reminding me", "لا تذكرني بالمشي؟ قالها صاحبي",
  ])("does not invent intention from %s", text => {
    expect(classifyIntent(text)).toEqual({ type: "none" });
  });
  it.each(["Please stop reminding me", "No more outing prompts", "لا تذكرني بالمشي", "ما أبي تذكير", "I don't want a reminder, but I'm going shopping"])("respects quiet: %s", text => {
    expect(classifyIntent(text)).toEqual({ type: "quiet" });
  });
  it.each(["I'm back", "Back from groceries", "رجعت", "رجعت من البقالة"])("recognizes a clear return: %s", text => {
    expect(classifyIntent(text).type).toBe("back");
  });
  it.each(["Changed my mind, staying in", "بطلت، بجلس في البيت", "I am not going for a walk", "ما بطلع أمشي"])("recognizes explicit cancellation: %s", text => {
    expect(classifyIntent(text).type).toBe("cancel");
  });
});

describe("verified step reactions", () => {
  it("baselines existing steps then celebrates one fresh accepted increase without changing health", () => {
    const first = reduce(initialCompanion(scope, now), snapshot());
    expect(first.state.reaction).toBeUndefined();
    const input = snapshot(4015, now + 1000);
    const before = structuredClone(input);
    const next = reduce(first.state, input);
    expect(next.state.reaction?.kind).toBe("happy");
    expect(next.effects).toContainEqual({ type: "reaction", reaction: "happy" });
    expect(input).toEqual(before);
    expect(next.state.cursor?.acceptedTotal).toBe(4015);
    expect(next.effects.some(e => e.type === "note")).toBe(false);
  });
  it("keeps the watermark across duplicate, lower and nonfresh reads", () => {
    let state = base();
    for (const event of [snapshot(), snapshot(3999, now + 1), { ...snapshot(4500, now + 2), fresh: false }]) {
      const result = reduce(state, event);
      expect(result.state.reaction).toBeUndefined();
      expect(result.state.cursor?.acceptedTotal).toBe(4000);
      state = result.state;
    }
  });
  it("establishes midnight baseline and rejects invalid or backwards days", () => {
    let state = base();
    const midnight = reduce(state, snapshot(10, now + 86400_000, "2026-10-10", 4010));
    expect(midnight.state.reaction).toBeUndefined();
    expect(midnight.state.cursor?.acceptedTotal).toBe(10);
    state = midnight.state;
    for (const day of ["2026-10-09", "2026-02-31", "garbage"]) {
      const next = reduce(state, snapshot(9000, now + 86400_001, day, 9000));
      expect(next.state.cursor).toEqual(state.cursor);
      expect(next.state.reaction).toBeUndefined();
    }
  });
  it("does not react to corrupt counters, scope or generation", () => {
    for (const event of [snapshot(NaN), snapshot(-1), snapshot(4.5), snapshot(5000, now, undefined, 3999),
      { ...snapshot(5000), scope: "other" }, { ...snapshot(5000), summary: { ...summary(5000), generation: 2 } }]) {
      expect(reduce(base(), event).state.reaction).toBeUndefined();
    }
  });
  it("rejects totals that grew without matching lifetime evidence", () => {
    const first = reduce(initialCompanion(scope, now), snapshot(4000, now, undefined, 5000)).state;
    expect(reduce(first, snapshot(4015, now + 1000, undefined, 5000)).state.cursor?.acceptedTotal).toBe(4000);
  });
  it("takes a fresh server heat shape ahead of a previous happy expression", () => {
    const happy = reduce(base(), snapshot(4015, now + 1000)).state;
    const heat = { ...snapshot(4015, now + 2000), summary: { ...summary(4015), mood: "burrowed" } };
    expect(reduce(happy, heat).state.reaction).toBeUndefined();
  });
  it("isolates origin, pet, real/demo and server life generation", () => {
    expect(new Set([scope, companionScope("https://two.test", "pet-a", false, 3), companionScope("https://one.test", "pet-b", false, 3), companionScope("https://one.test", "pet-a", true, 3), companionScope("https://one.test", "pet-a", false, 4)]).size).toBe(5);
    const switched = reduce(plan(), { type: "tick", at: now + 1000 }, { ...context, scope: "new-pet", generation: 4 });
    expect(switched.state.outing).toBeUndefined();
    expect(switched.state.cursor).toBeUndefined();
    expect(switched.state.reaction).toBeUndefined();
  });
  it("accepts server generation zero and rejects a missing generation", () => {
    const ctx = { ...context, generation: 0 };
    const first = reduce(initialCompanion(scope, now), { ...snapshot(), summary: { ...summary(), generation: 0 } }, ctx).state;
    expect(reduce(first, { ...snapshot(4015, now + 1000), summary: { ...summary(4015), generation: 0 } }, ctx).state.reaction?.kind).toBe("happy");
    expect(reduce(base(), { ...snapshot(4015, now + 1000), summary: { ...summary(4015), generation: undefined } }).state.reaction).toBeUndefined();
  });
  it("keeps sleeping and tired health in the server while showing a brief smile", () => {
    for (const mood of ["asleep", "tired", "wilting"]) {
      const event = { ...snapshot(4015, now + 1000), summary: { ...summary(4015), mood } };
      expect(reduce(base(), event).state.reaction?.kind).toBe("happy");
      expect(event.summary.mood).toBe(mood);
    }
  });
  it("clears all outing effects on death or unverified identity and never overrides heat", () => {
    for (const ctx of [{ ...context, alive: false }, { ...context, ready: false }]) {
      const result = reduce(plan(), { type: "tick", at: now + 1000 }, ctx);
      expect(result.state.outing).toBeUndefined();
      expect(result.state.reaction).toBeUndefined();
    }
    const heat = reduce(base(), snapshot(4015, now + 1000), { ...context, burrowed: true });
    expect(heat.state.cursor?.acceptedTotal).toBe(4015);
    expect(heat.state.reaction).toBeUndefined();
  });
  it("expires by explicit time and consumes hidden increases without replay", () => {
    const happy = reduce(base(), snapshot(4015, now + 1000)).state;
    const expired = reduce(happy, { type: "tick", at: now + 7000 });
    expect(expired.state.reaction).toBeUndefined();
    expect(expired.effects).toContainEqual({ type: "reaction", reaction: null });
    const hidden = reduce(base(), snapshot(4015, now + 1000), { ...context, visible: false }).state;
    expect(hidden.reaction).toBeUndefined();
    expect(reduce(hidden, snapshot(4015, now + 12000)).state.reaction).toBeUndefined();
  });
  it("coalesces frequent increases without extending a pulse forever", () => {
    let state = reduce(base(), snapshot(4015, now + 1000)).state;
    for (let n = 2; n <= 10; n++) state = reduce(state, snapshot(4015 + n, now + n * 1000)).state;
    expect(state.reaction).toBeUndefined();
    expect(state.cursor?.acceptedTotal).toBe(4025);
    expect(reduce(state, snapshot(4026, now + 11000)).state.reaction?.kind).toBe("happy");
  });
});

describe("outing lifecycle", () => {
  it("survives polling and reload without a premature welcome", () => {
    const declared = plan();
    expect(reduce(declared, snapshot(4000, now + 30000)).state.outing?.kind).toBe("walk");
    const loaded = readCompanion(persistCompanion(declared), scope, now + 30000);
    expect(loaded.outing?.kind).toBe("walk");
    expect(loaded.reaction).toBeUndefined();
    expect(reduce(loaded, snapshot(4000, now + 31000)).effects.some(e => e.type === "note")).toBe(false);
  });
  it("requires genuine hidden, visible, and then fresh living state before one return", () => {
    const hidden = reduce(plan(), { type: "hidden", at: now + 1000 }, { ...context, visible: false }).state;
    const visible = reduce(hidden, { type: "visible", at: now + 31000 });
    expect(visible.effects).toContainEqual({ type: "refresh" });
    expect(visible.state.outing).toBeDefined();
    const stale = reduce(visible.state, { ...snapshot(4000, now + 32000), fresh: false });
    expect(stale.state.pendingReturn).toBeDefined();
    const returned = reduce(stale.state, snapshot(4000, now + 33000));
    expect(returned.state.outing).toBeUndefined();
    expect(returned.effects).toContainEqual({ type: "note", note: { type: "return", kind: "walk" } });
    expect(reduce(returned.state, snapshot(4000, now + 34000)).effects.some(e => e.type === "note")).toBe(false);
  });
  it("does not consume an outing from a short tab switch or stale smaller response", () => {
    const hidden = reduce(plan(), { type: "hidden", at: now + 1000 }).state;
    expect(reduce(hidden, { type: "visible", at: now + 5000 }).state.outing).toBeDefined();
    const visible = reduce(hidden, { type: "visible", at: now + 31000 }).state;
    expect(reduce(visible, snapshot(3999, now + 32000)).state.pendingReturn).toBeDefined();
  });
  it("makes an explicit chat return happy without a second authored reply", () => {
    const returned = reduce(plan(), { type: "intent", intent: { type: "back" }, source: "chat", at: now + 30000 });
    expect(returned.state.outing).toBeUndefined();
    expect(returned.state.reaction?.kind).toBe("happy");
    expect(returned.effects.some(e => e.type === "note")).toBe(false);
  });
  it("cancels silently and honors a quiet preference across reload", () => {
    const cancelled = reduce(plan(), { type: "intent", intent: { type: "cancel" }, source: "chat", at: now + 1000 });
    expect(cancelled.state.outing).toBeUndefined();
    expect(cancelled.state.reaction).toBeUndefined();
    const quiet = reduce(plan(), { type: "intent", intent: { type: "quiet" }, source: "chat", at: now + 1000 });
    expect(quiet.state.quietNotes).toBe(true);
    expect(quiet.state.outing).toBeUndefined();
    const loaded = readCompanion(persistCompanion(quiet.state), scope, now + 2000);
    expect(loaded.quietNotes).toBe(true);
    const automatic = reduce(loaded, { type: "intent", intent: { type: "plan", kind: "walk" }, source: "chat", at: now + 2000 });
    expect(automatic.state.outing).toBeUndefined();
    const manual = reduce(loaded, { type: "intent", intent: { type: "plan", kind: "walk" }, source: "button", at: now + 2000 });
    expect(manual.state.outing).toBeDefined();
  });
  it("expires six-hour plans silently and drops plans on rollback", () => {
    const expired = reduce(plan(), { type: "tick", at: now + 6 * 3600_000 });
    expect(expired.state.outing).toBeUndefined();
    expect(expired.effects.some(e => e.type === "note")).toBe(false);
    const rollback = reduce(plan(), { type: "tick", at: now - 1 });
    expect(rollback.state.outing).toBeUndefined();
    expect(reduce(rollback.state, { type: "tick", at: now + 1 }).state.outing).toBeUndefined();
    expect(readCompanion(persistCompanion(plan()), scope, now - 1).outing).toBeUndefined();
  });
  it("offers a generic welcome only after ten genuine minutes away", () => {
    const hidden = reduce(base(), { type: "hidden", at: now }).state;
    expect(reduce(hidden, { type: "visible", at: now + 599999 }).effects.some(e => e.type === "refresh")).toBe(false);
    const visible = reduce(hidden, { type: "visible", at: now + 600000 }).state;
    const returned = reduce(visible, snapshot(4000, now + 600001));
    expect(returned.effects).toContainEqual({ type: "note", note: { type: "return" } });
  });
  it("does not let a newer plan get consumed by an old pending return", () => {
    const hidden = reduce(plan(), { type: "hidden", at: now + 1000 }).state;
    const visible = reduce(hidden, { type: "visible", at: now + 31000 }).state;
    const next = reduce(visible, { type: "intent", intent: { type: "plan", kind: "errand" }, source: "chat", at: now + 32000 }).state;
    expect(reduce(next, snapshot(4000, now + 33000)).state.outing?.kind).toBe("errand");
  });
  it("bounds repeated manual anticipation to twelve continuous seconds", () => {
    let state = plan();
    for (const ms of [5000, 10000]) state = reduce(state, { type: "intent", intent: { type: "plan", kind: "walk" }, source: "button", at: now + ms }).state;
    expect(state.reaction?.until).toBe(now + 12000);
    expect(reduce(state, { type: "tick", at: now + 12000 }).state.reaction).toBeUndefined();
  });
});

describe("native document-scoped presentation", () => {
  const movement = (at = now + 1000): CompanionEvent => ({ type: "movement", scope, nativeScope: "document-nonce", version: 1, eventId: "doc:1", delta: 3, intervalMs: 2000, observedAt: at - 100, at });
  const native = { ...context, nativeScope: "document-nonce" };
  it("uses recent validated positive movement without crediting any step count", () => {
    const before = base();
    const result = reduce(before, movement(), native);
    expect(result.state.reaction?.kind).toBe("happy");
    expect(result.state.cursor).toEqual(before.cursor);
    expect(result.effects.some(e => e.type === "note")).toBe(false);
    const expired = reduce(result.state, { type: "tick", at: now + 11000 }, native).state;
    expect(reduce(expired, { ...movement(now + 12000), observedAt: now + 11900 }, native).state.reaction).toBeUndefined();
  });
  it("rejects ordinary tabs, demo, unknown versions, stale, future, zero and unbounded events", () => {
    expect(reduce(base(), movement()).state.reaction).toBeUndefined();
    expect(reduce(base(), movement(), { ...native, demo: true }).state.reaction).toBeUndefined();
    for (const change of [{ version: 2 }, { scope: "other" }, { nativeScope: "previous-document" }, { delta: 0 }, { delta: NaN }, { delta: 1.5 }, { intervalMs: 30001 }, { intervalMs: 0 }, { observedAt: now - 15000 }, { observedAt: now + 1001 }, { eventId: "" }]) {
      expect(reduce(base(), { ...movement(), ...change } as CompanionEvent, native).state.reaction).toBeUndefined();
    }
  });
  it("validates the native nonce before creating a document-scoped event", () => {
    const payload = { version: 1, scope: "document-nonce", eventId: "doc:1", delta: 3, intervalMs: 2000, observedAt: now + 900 };
    expect(readMovement(payload, "document-nonce", scope, now + 1000)).toEqual(movement());
    expect(readMovement(payload, "previous-document", scope, now + 1000)).toBeNull();
    expect(readMovement(payload, "", scope, now + 1000)).toBeNull();
    expect(readMovement({ ...payload, delta: 2 }, "document-nonce", scope, now + 1000)).toBeNull();
  });
});

describe("storage and truthful copy", () => {
  it("rejects alien scope and corrupted persistence and never restores visual or native queues", () => {
    expect(readCompanion({ ...persistCompanion(plan()), scope: "other" }, scope, now).outing).toBeUndefined();
    const loaded = readCompanion({ ...persistCompanion(plan()), reaction: { kind: "happy", until: now + 10000 }, nativeEvents: ["id"], hiddenAt: now + 1, cursor: { day: "2026-02-31", acceptedTotal: 10, lifetimeTotal: 10 } }, scope, now);
    expect(loaded.reaction).toBeUndefined();
    expect(loaded.nativeEvents).toEqual([]);
    expect(loaded.hiddenAt).toBeUndefined();
    expect(loaded.cursor).toBeUndefined();
  });
  it("provides EN/AR notes from declared facts without inventing outdoors or phone settings", () => {
    for (const lang of ["en", "ar"] as const) {
      for (const note of [{ type: "plan", kind: "walk" }, { type: "plan", kind: "errand" }, { type: "return", kind: "errand" }, { type: "return" }, { type: "heat" }, { type: "quiet" }] as const) {
        expect(companionText(note, lang).length).toBeGreaterThan(5);
        expect(companionText(note, lang)).not.toMatch(/outdoors|you walked|notifications are off|GPS/i);
      }
    }
    expect(companionText({ type: "return", kind: "errand" }, "en")).not.toMatch(/groceries/);
  });
});
