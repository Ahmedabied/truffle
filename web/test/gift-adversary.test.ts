import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STATE } from "../../worker/src/engine";
import { generateGift, type GiftJob } from "../../worker/src/gifts";
import { RealBackend } from "../src/api";
import { CompanionController, type CompanionBinding } from "../src/companion/controller";
import type { StateSummary } from "../src/types";

const now = Date.UTC(2026, 9, 10, 8);
const binding: CompanionBinding = { origin: "https://gift.test", pet: "test-pet", demo: false };
const pending = { id: "job-A", intent: "rest" as const, due_ms: now + 600_000 };
const summary = (job: typeof pending | null = null): StateSummary => ({
  generation: 2,
  state: { ...structuredClone(DEFAULT_STATE), energy: 4000, steps_today: 4000, lifetime_steps: 4000 },
  companion: { pending: job, gifts: [] },
  mood: "content", tier: "high", energy_max: 6000, energy_pct: 67,
  tz: "Asia/Muscat", country: "OM", city: "", lang: "en", demo: false,
  local_day: "2026-10-10", next_midnight_ms: null, weather: null,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>(r => { resolve = r; }), resolve: (value: T) => resolve(value) };
}
function fixture(request: NonNullable<CompanionBinding["request"]>) {
  const data = new Map<string, unknown>();
  const deps = {
    load: (key: string) => data.get(key), save: (key: string, value: unknown) => data.set(key, value),
    setReaction: vi.fn(), showNote: vi.fn(), requestState: vi.fn(), onServerSummary: vi.fn(),
    requestId: () => "outing-A",
  };
  const controller = new CompanionController(deps);
  controller.snapshot({ ...binding, request }, summary());
  return { controller, deps };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("independent gift return adversary", () => {
  it("targets the admitted job when return was queued before the away receipt arrived", async () => {
    const receipt = deferred<StateSummary>();
    const request = vi.fn().mockReturnValueOnce(receipt.promise).mockResolvedValue(summary());
    const { controller, deps } = fixture(request);
    controller.hidden();
    await flush();
    const returning = controller.returned();
    receipt.resolve(summary(pending));
    await returning;
    expect(request.mock.calls[1]?.[0]).toBe("return");
    expect(request.mock.calls[1]?.[5]).toBe(pending.id);
    expect(deps.onServerSummary).toHaveBeenCalledExactlyOnceWith(summary());
    controller.clear();
  });

  it("uses the original away request identity when its server receipt is lost", async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error("response lost after admission")).mockResolvedValue(summary());
    const { controller } = fixture(request);
    controller.hidden();
    await flush();
    await controller.returned();
    expect(request.mock.calls[1]?.[0]).toBe("return");
    expect(request.mock.calls[1]?.[2]).toBe("outing-A");
    controller.clear();
  });

  it("does not redirect an already queued return onto a newer outing learned from a snapshot", async () => {
    const receipt = deferred<StateSummary>();
    const newer = { ...pending, id: "job-B" };
    const request = vi.fn().mockReturnValueOnce(receipt.promise).mockResolvedValue(summary(newer));
    const { controller } = fixture(request);
    controller.hidden();
    await flush();
    const returning = controller.returned();
    controller.snapshot({ ...binding, request }, summary(newer));
    receipt.resolve(summary(pending));
    await returning;
    expect(request.mock.calls[1]?.[0]).toBe("return");
    expect(request.mock.calls[1]?.[5]).toBe("job-A");
    controller.clear();
  });

  it("does not replace a newer completed-gift snapshot with a delayed same-generation away receipt", async () => {
    const receipt = deferred<StateSummary>();
    const request = vi.fn(() => receipt.promise);
    const { controller, deps } = fixture(request);
    // A different tab admitted this job 9m55s ago. This tab's away request
    // deduplicates it; an already-running state read can win the response race.
    // Keep the entire race below RealBackend's twelve-second deadline.
    const nearingDue = { ...pending, due_ms: now + 5000 };
    controller.snapshot({ ...binding, request }, summary(nearingDue));
    controller.hidden();
    await flush();
    const job: GiftJob = {
      ...nearingDue, seed: "independent-seed", generation: 2, day: "2026-10-10", generator_version: 1,
      created_ms: now - 595_000, expires_ms: now - 595_000 + 86_400_000, state: "ready",
    };
    const fresh = summary();
    fresh.companion!.gifts = [generateGift(job, { stage: "Spore", dead: false }, nearingDue.due_ms)];
    fresh.state.steps_today = 5000;
    vi.setSystemTime(nearingDue.due_ms);
    controller.snapshot({ ...binding, request }, fresh);
    receipt.resolve(summary(nearingDue));
    await flush();
    expect(deps.onServerSummary).not.toHaveBeenCalled();
    controller.clear();
  });

  it("a stalled real keepalive request releases the return queue at the API deadline", async () => {
    const backend = new RealBackend(binding.origin);
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(() => {}))
      .mockResolvedValue(new Response(JSON.stringify(summary()), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const request: NonNullable<CompanionBinding["request"]> = (...args) => backend.companion({ phrase: binding.pet, secret: "test-secret" }, ...args);
    const { controller, deps } = fixture(request);
    controller.hidden();
    await flush();
    const returning = controller.returned();
    await vi.advanceTimersByTimeAsync(12_000);
    await returning;
    expect(fetcher).toHaveBeenCalledTimes(2);
    const firstInit = fetcher.mock.calls[0][1] as RequestInit;
    expect(firstInit.keepalive).toBe(true);
    expect(firstInit.signal?.aborted).toBe(true);
    expect(deps.requestState).toHaveBeenCalledOnce();
    controller.clear();
  });
});
