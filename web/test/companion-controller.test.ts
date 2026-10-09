import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STATE, initializeV2 } from "../../worker/src/engine";
import { Chat, type ChatDeps } from "../src/chat";
import { CompanionController, type CompanionBinding } from "../src/companion/controller";
import { companionScope } from "../src/companion/state";
import type { Backend, ChatEvent, StateSummary } from "../src/types";

const now = Date.UTC(2026, 9, 9, 12);
const summary = (steps = 4000, generation: number | undefined = 2): StateSummary => ({
  generation, state: { ...structuredClone(DEFAULT_STATE), energy: 4000, steps_today: steps, lifetime_steps: steps },
  mood: "content", tier: "high", energy_max: 6000, energy_pct: 67,
  tz: "Asia/Muscat", country: "OM", city: "", lang: "en", demo: false,
  local_day: "2026-10-09", next_midnight_ms: null, weather: null,
});
const binding: CompanionBinding = { origin: "https://one.test", pet: "sand-moon-fig", demo: false };
const scope = companionScope(binding.origin, binding.pet, false, 2);
function fixture(overrides: Partial<ConstructorParameters<typeof CompanionController>[0]> = {}) {
  const data = new Map<string, unknown>();
  const d = { load: (key: string) => data.get(key), save: (key: string, value: unknown) => data.set(key, value),
    setReaction: vi.fn(), showNote: vi.fn(), requestState: vi.fn(), onServerSummary: vi.fn(), requestId: () => "request-id", ...overrides };
  return { c: new CompanionController(d), d, data };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("companion controller", () => {
  it("accepts no events without a verified server generation, including native movement", () => {
    const { c, d, data } = fixture();
    c.snapshot({ ...binding, nativeScope: "nonce" }, { ...summary(), generation: undefined });
    c.acceptedMessage("I'm going for a walk");
    c.movement({ version: 1, scope: "nonce", eventId: "1", delta: 3, intervalMs: 1000, observedAt: now });
    expect(data.size).toBe(0);
    expect(d.setReaction.mock.calls.every(([value]) => value === null)).toBe(true);
  });
  it("expires a static reaction by wall clock without rendering, polling or motion frames", async () => {
    const { c, d } = fixture();
    c.snapshot(binding, summary());
    c.snapshot(binding, summary(4015));
    expect(d.setReaction).toHaveBeenLastCalledWith("happy");
    await vi.advanceTimersByTimeAsync(6000);
    expect(d.setReaction).toHaveBeenLastCalledWith(null);
    c.snapshot(binding, summary(4015));
    expect(d.setReaction).toHaveBeenLastCalledWith(null);
    c.clear();
  });
  it("keeps the same outing across ordinary polls and hydration, then resolves a genuine return once", async () => {
    const { c, d, data } = fixture();
    c.snapshot(binding, summary());
    c.acceptedMessage("I'm going for a walk");
    await vi.advanceTimersByTimeAsync(6000);
    c.snapshot(binding, summary());
    expect((data.get(scope) as any).outing.kind).toBe("walk");
    c.clear();
    c.snapshot(binding, summary());
    c.hidden();
    await vi.advanceTimersByTimeAsync(30000);
    await c.returned();
    expect(d.requestState).toHaveBeenCalledOnce();
    expect((data.get(scope) as any).outing.kind).toBe("walk");
    c.snapshot(binding, summary());
    expect(d.showNote).toHaveBeenLastCalledWith({ type: "return", kind: "walk" });
    expect((data.get(scope) as any).outing).toBeUndefined();
    const notes = d.showNote.mock.calls.length;
    c.snapshot(binding, summary());
    expect(d.showNote).toHaveBeenCalledTimes(notes);
    c.clear();
  });
  it("ignores negated, uncertain and past messages and consumes a natural back without another authored reply", () => {
    const { c, d, data } = fixture();
    c.snapshot(binding, summary());
    for (const text of ["I walked yesterday", "Maybe I'll walk", "I'm not sure if I'm going shopping"]) c.acceptedMessage(text);
    expect((data.get(scope) as any).outing).toBeUndefined();
    c.acceptedMessage("I'm going shopping");
    c.acceptedMessage("I'm back");
    expect((data.get(scope) as any).outing).toBeUndefined();
    expect(d.setReaction).toHaveBeenLastCalledWith("happy");
    expect(d.showNote.mock.calls.every(([note]) => note === null)).toBe(true);
    c.clear();
  });
  it("requires exact native nonce and keeps movement presentation separate from stored totals", () => {
    const { c, d, data } = fixture();
    c.snapshot(binding, summary());
    const payload = { version: 1, scope: "nonce", eventId: "native:1", delta: 3, intervalMs: 1000, observedAt: now };
    c.movement(payload);
    expect(d.setReaction).toHaveBeenLastCalledWith(null);
    c.snapshot({ ...binding, nativeScope: "nonce" }, summary());
    c.movement({ ...payload, scope: "previous" });
    expect(d.setReaction).toHaveBeenLastCalledWith(null);
    c.movement(payload);
    expect(d.setReaction).toHaveBeenLastCalledWith("happy");
    expect((data.get(scope) as any).cursor.acceptedTotal).toBe(4000);
    c.clear();
    c.snapshot(binding, summary());
    c.movement(payload);
    expect(d.setReaction).toHaveBeenLastCalledWith(null);
    c.clear();
  });
  it("serializes away and early return before polling, without showing a late scheduling receipt", async () => {
    let release!: (value: StateSummary) => void;
    const pending = new Promise<StateSummary>(resolve => { release = resolve; });
    const request = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(summary());
    const { c, d } = fixture();
    c.snapshot({ ...binding, request }, summary());
    c.hidden();
    c.hidden(); // visibilitychange plus pagehide is still one away event
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]).toEqual(["away", "rest", "request-id", true, 2, undefined]);
    const returning = c.returned();
    expect(d.requestState).not.toHaveBeenCalled();
    release({ ...summary(), companion: { pending: { id: "job", due_ms: now + 600000, intent: "rest" }, gifts: [] } });
    await returning;
    expect(request.mock.calls[1][0]).toBe("return");
    expect(d.onServerSummary).toHaveBeenCalledExactlyOnceWith(summary());
    expect(d.requestState).toHaveBeenCalledOnce();
    c.hidden();
    await flush();
    expect(request).toHaveBeenCalledTimes(3); // An early cancel permits a later absence.
    c.clear();
  });
  it.each(["pet", "origin", "generation"])("drops in-flight receipts after a %s change", async field => {
    let release!: (value: StateSummary) => void;
    const request = vi.fn(() => new Promise<StateSummary>(resolve => { release = resolve; }));
    const { c, d } = fixture();
    c.snapshot({ ...binding, request }, summary());
    c.hidden();
    await flush();
    c.snapshot({ ...binding, ...(field === "pet" ? { pet: "new-pet" } : field === "origin" ? { origin: "https://two.test" } : {}), request }, summary(4000, field === "generation" ? 3 : 2));
    release(summary());
    await flush();
    expect(d.onServerSummary).not.toHaveBeenCalled();
    c.clear();
  });
  it("never promises an away job on network failure or in a demo", async () => {
    const request = vi.fn().mockRejectedValue(new Error("offline"));
    const { c, d } = fixture();
    c.snapshot({ ...binding, request }, summary());
    c.hidden();
    await flush();
    expect(d.onServerSummary).not.toHaveBeenCalled();
    c.clear();
    c.snapshot({ ...binding, demo: true, request }, summary());
    c.hidden();
    await flush();
    expect(request).toHaveBeenCalledOnce();
    c.clear();
  });
  it("refreshes older APIs on return even when companion generation is unavailable", async () => {
    const { c, d } = fixture();
    c.snapshot(binding, { ...summary(), generation: undefined });
    await c.returned();
    expect(d.requestState).toHaveBeenCalledOnce();
  });
});

describe("accepted chat boundary", () => {
  function chatFixture() {
    vi.stubGlobal("window", globalThis);
    const element = () => ({ textContent: "", lang: "", classList: { add: vi.fn(), remove: vi.fn() } });
    const input = { value: "", disabled: false, placeholder: "", lang: "", blur: vi.fn() };
    const send = { disabled: false };
    const backend = { chat: vi.fn(async function* (): AsyncGenerator<ChatEvent> { yield { type: "done", tier: "medium", brain: "test", half_awake: false, spent: 60, partial: false, summary: null }; }) } as unknown as Backend;
    let s = summary();
    s.state = initializeV2(s.state, now);
    let blocked = false;
    const accepted = vi.fn();
    const deps: ChatDeps = { backend: () => backend, creds: () => ({ phrase: binding.pet, secret: "test" }), lang: () => "en", summary: () => s,
      reduced: () => true, requested: () => undefined, onYawn: vi.fn(), onHalfAwake: vi.fn(), onSummary: vi.fn(), onExplain: vi.fn(),
      afterChat: vi.fn(), demo: false, openSettings: vi.fn(), blocked: () => blocked, onAcceptedMessage: accepted };
    const c = new Chat({ querySelector: () => send, addEventListener: vi.fn() } as any, input as any, element() as any, element() as any, element() as any, deps);
    return { c, backend, accepted, setBlocked: (value: boolean) => { blocked = value; }, setDead: () => { s = { ...s, state: { ...s.state, dead: true } }; } };
  }
  it("calls accepted intent once and sends exactly one ordinary medium request", async () => {
    const { c, backend, accepted } = chatFixture();
    await c.send("I'm going for a walk");
    expect(accepted).toHaveBeenCalledExactlyOnceWith("I'm going for a walk");
    expect(backend.chat).toHaveBeenCalledTimes(1);
    expect(vi.mocked(backend.chat).mock.calls[0][3]).toBe("medium");
    c.clear();
  });
  it("refuses direct calls while blocked, dead, already busy or input is invalid", async () => {
    const { c, backend, accepted, setBlocked, setDead } = chatFixture();
    setBlocked(true);
    await c.send("I'm going for a walk");
    setBlocked(false);
    await c.send(" ");
    await c.send("a".repeat(2001));
    expect(accepted).not.toHaveBeenCalled();
    const sending = c.send("Hello");
    await c.send("I'm going shopping");
    await sending;
    expect(accepted).toHaveBeenCalledExactlyOnceWith("Hello");
    expect(backend.chat).toHaveBeenCalledTimes(1);
    setDead();
    await c.send("I'm going for a walk");
    expect(accepted).toHaveBeenCalledTimes(1);
    c.clear();
  });
});
