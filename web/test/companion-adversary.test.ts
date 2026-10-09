import { describe, expect, it } from "vitest";
import { classifyIntent } from "../src/companion/intent";
import {
  companionScope, initialCompanion, persistCompanion, readCompanion, reduceCompanion,
  type CompanionContext, type CompanionEvent, type CompanionState,
} from "../src/companion/state";

const now = Date.UTC(2026, 9, 9, 12);
const scope = companionScope("https://truffle.test", "test-pet", false, 2);
const context: CompanionContext = {
  scope, generation: 2, demo: false, ready: true, visible: true, alive: true, burrowed: false,
  nativeScope: "verified-document",
};
const snapshot = (at: number, steps = 100): CompanionEvent => ({
  type: "snapshot", scope, fresh: true, at,
  summary: { generation: 2, local_day: "2026-10-09", mood: "content",
    state: { steps_today: steps, lifetime_steps: steps, dead: false } },
});
const reduce = (state: CompanionState, event: CompanionEvent, ctx = context) => reduceCompanion(state, event, ctx);
const base = () => reduce(initialCompanion(scope, now), snapshot(now)).state;
const say = (state: CompanionState, message: string, at: number) => reduce(state, {
  type: "intent", intent: classifyIntent(message), source: "chat", at,
});

describe("natural but explicit English and Arabic outing messages", () => {
  it.each([
    ["I'm heading to the grocery store", "errand"],
    ["I'm going to get some groceries now", "errand"],
    ["I'm heading out to buy groceries", "errand"],
    ["I am going to the supermarket", "errand"],
    ["I'm going out for a walk", "walk"],
    ["I'm taking a short walk", "walk"],
    ["I'm heading out for a short walk now", "walk"],
    ["I'm going to walk for a bit", "walk"],
    ["I'm going to go for a walk", "walk"],
    ["أنا رايح للبقالة", "errand"],
    ["أنا رايحة للسوق الحين", "errand"],
    ["بروح للسوبرماركت", "errand"],
    ["بطلع أشتري أغراض", "errand"],
    ["أَنَا طَالِع أَمْشِي الآن!", "walk"],
    ["أنا رايحة أتمشى شوي", "walk"],
    ["سأذهب للمشي", "walk"],
  ])("recognizes a clear plan: %s", (message, kind) => {
    expect(classifyIntent(message)).toEqual({ type: "plan", kind });
  });

  it.each([
    "I'm not heading to the grocery store", "I'm not going to walk", "I'm not taking a short walk",
    "I'm going to walk if my knee feels better", "I'm going out for a walk tomorrow maybe",
    "I was heading to the grocery store", "I had been going for a walk", "I took a short walk",
    "I'm going to walk you through the options", "I'm taking a short walk in this story",
    "Can I go for a walk?", "I'm going to walk?", "Should I be heading to the store?",
    "He says I'm going to walk", "“I'm going out for a walk”", "'I'm going to walk'",
    "My daughter is heading to the grocery store", "If I said I'm going to walk",
    "Maybe I'm heading to the grocery store", "I wish I were going for a walk",
    "أنا مو رايح للبقالة", "أنا مش رايحة للسوق", "كنت رايح للبقالة", "رحت للسوق أمس",
    "بروح للسوبرماركت إذا قدرت", "يمكن أطلع أمشي", "هو رايح للبقالة", "قالت سأذهب للمشي",
    "هل أذهب للمشي؟", "أنا رايحة أتمشى شوي؟", "«أنا رايح للبقالة»", "سأذهب للمشي لو فضيت",
    "Stop reminding me, said my friend", "Stop reminding me, is what she told him",
    "I don't want reminders, but actually keep reminding me",
    "Could you stop reminding me? That's what my friend asked", "لا تذكرني، قالت صديقتي",
  ])("does not create a plan or act on reported or uncertain speech: %s", message => {
    expect(classifyIntent(message)).toEqual({ type: "none" });
  });

  it.each([
    "I'm back from the grocery store", "Back from the supermarket now", "I'm back home",
    "I'm home now", "رجعت من السوبرماركت", "رجعت البيت الحين",
  ])("welcomes a clearly reported return through the one normal chat response: %s", message => {
    const planned = say(base(), "I'm going shopping", now + 1).state;
    const result = say(planned, message, now + 40_001);
    expect(result.state.outing).toBeUndefined();
    expect(result.state.reaction?.kind).toBe("happy");
    expect(result.effects.some(effect => effect.type === "note")).toBe(false);
  });

  it.each([
    "I'll be back home soon", "I was home yesterday", "I'm home now?", "She said I'm home now",
    "I'm back from the grocery store in this example", "لسه ما رجعت البيت", "قال رجعت البيت الحين",
  ])("keeps an outing active when a return has not been reported: %s", message => {
    const planned = say(base(), "I'm going shopping", now + 1).state;
    expect(say(planned, message, now + 40_001).state.outing).toEqual(planned.outing);
  });
});

describe("quiet requests and choosing rest", () => {
  it.each([
    "Please don't remind me", "Don't remind me about walks", "Could you stop reminding me?",
    "Can you please stop reminding me?", "Stop reminding me, please", "No more outing prompts, thanks",
    "I don't want any reminders", "I don't want a reminder, but I'm going shopping",
    "من فضلك لا تذكرني بالمشي", "لا تذكرني بالمشي لو سمحت", "ممكن ما تذكرني بالمشي؟",
    "ما أبغى تذكير", "ما أبي تذكيرات", "بدون تذكير لو سمحت",
  ])("honors a direct quiet request even when polite: %s", message => {
    expect(classifyIntent(message)).toEqual({ type: "quiet" });
  });

  it.each([
    "I'm staying home instead", "I've changed my mind, I'm staying home", "I'm resting today",
    "I'll stay home today", "I'm not going to the grocery store", "I am not going grocery shopping",
    "بجلس في البيت", "بأرتاح اليوم", "غيرت رأيي، بجلس في البيت", "ما بروح للبقالة", "ماني رايحة للسوق",
  ])("silently cancels an existing outing when choosing to stay in: %s", message => {
    const plan = say(base(), "I'm going shopping", now + 1).state;
    const result = say(plan, message, now + 2);
    expect(result.state.outing).toBeUndefined();
    expect(result.state.reaction).toBeUndefined();
    expect(result.effects.some(effect => effect.type === "note")).toBe(false);
  });

  it.each([
    "I rested yesterday", "Maybe I'll stay home", "Should I stay home?", "She is staying home",
    "I'm resting today if the weather gets worse", "I don't want to stop reminding me",
    "Can you explain stop reminding me?", "أمس ارتحت", "يمكن بجلس في البيت", "هي بتجلس في البيت",
  ])("does not cancel a plan based on someone else or uncertainty: %s", message => {
    const planned = say(base(), "I'm going for a walk", now + 1).state;
    const result = say(planned, message, now + 2);
    expect(result.state.outing).toEqual(planned.outing);
    expect(result.state.quietNotes).toBe(false);
  });

  it("persists polite quiet, consumes a pending welcome and leaves subsequent chat ordinary", () => {
    let state = say(base(), "I'm going for a walk", now + 1).state;
    state = reduce(state, { type: "hidden", at: now + 2 }, { ...context, visible: false }).state;
    state = reduce(state, { type: "visible", at: now + 31_002 }).state;
    expect(state.pendingReturn).toBeDefined();
    state = say(state, "Could you stop reminding me?", now + 31_003).state;
    state = readCompanion(persistCompanion(state), scope, now + 31_004);
    const afterChat = say(state, "I'm going to the supermarket", now + 31_005);
    expect(afterChat.state.quietNotes).toBe(true);
    expect(afterChat.state.outing).toBeUndefined();
    expect(afterChat.state.pendingReturn).toBeUndefined();
    const fresh = reduce(afterChat.state, snapshot(now + 31_006));
    expect(fresh.effects.some(effect => effect.type === "note")).toBe(false);
  });
});

describe("fresh movement during an anticipated outing", () => {
  it.each(["snapshot", "native"])("turns anticipation into happiness for fresh %s movement without restarting its timer", signal => {
    const planned = say(base(), "I'm going for a walk", now + 1).state;
    const event: CompanionEvent = signal === "snapshot" ? snapshot(now + 1001, 110) : {
      type: "movement", scope, nativeScope: "verified-document", version: 1, eventId: "sample:1",
      delta: 5, observedAt: now + 901, intervalMs: 1000, at: now + 1001,
    };
    const result = reduce(planned, event);
    expect(result.state.reaction?.kind).toBe("happy");
    expect(result.state.reaction?.until).toBe(planned.reaction?.until);
    expect(result.state.outing).toEqual(planned.outing);
    expect(result.effects.some(effect => effect.type === "note")).toBe(false);
    expect(reduce(result.state, { type: "tick", at: now + 6001 }).state.reaction).toBeUndefined();
  });

  it("keeps hidden or sheltered walking quiet even during an explicit plan", () => {
    const planned = say(base(), "I'm going for a walk", now + 1).state;
    for (const ctx of [{ ...context, visible: false }, { ...context, burrowed: true }]) {
      const result = reduce(planned, snapshot(now + 1001, 110), ctx);
      expect(result.state.reaction).toBeUndefined();
      expect(result.effects.some(effect => effect.type === "note")).toBe(false);
      expect(result.state.cursor?.acceptedTotal).toBe(110);
    }
  });
});
