import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STATE, initializeV2 } from "../src/engine";
import { GIFT_WAIT_MS } from "../src/gifts";
import * as pairing from "../src/pairing";
import type { Result, StateSummary } from "../src/types";
import { advance, clock, Deferred, FakeFetch, truffle, useClock } from "./helpers/do-harness";

beforeEach(() => { useClock("2026-10-10T08:00:00Z"); new FakeFetch().install(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function value(result: Result<StateSummary>) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
const pet = () => initializeV2({ ...structuredClone(DEFAULT_STATE), energy: 100, burrowed: true }, clock.now);

describe("independent same-life gift cancellation adversary", () => {
  it.each(["return", "cancel"] as const)("an unscoped %s packet leaves the current outing untouched", async action => {
    const f = await truffle({ state: pet() });
    value(await f.obj.companion(f.secret, { action: "away", generation: 0, client_request_id: "outing-A" }));
    const before = f.meta().companion!.job;
    await f.obj.companion(f.secret, { action, generation: 0 });
    expect(f.meta().companion!.job).toEqual(before);
    // The original request identity is sufficient when its receipt was lost.
    value(await f.obj.companion(f.secret, { action, generation: 0, client_request_id: "outing-A" }));
    expect(f.meta().companion!.job?.state).toBe("cancelled");
  });

  it.each(["return", "cancel"] as const)("a delayed %s for a cancelled outing cannot cancel a newer outing in the same life", async action => {
    const f = await truffle({ state: pet() });
    const first = value(await f.obj.companion(f.secret, { action: "away", generation: 0, client_request_id: "outing-A" })).companion.pending!;
    value(await f.obj.companion(f.secret, { action: "return", generation: 0, job_id: first.id }));
    const next = value(await f.obj.companion(f.secret, { action: "away", generation: 0, client_request_id: "outing-B" })).companion.pending!;
    // A duplicate packet has the original request identity but lost its receipt,
    // a normal outcome when the keepalive response did not reach the old page.
    await f.obj.companion(f.secret, { action, generation: 0, client_request_id: "outing-A" });
    expect(f.meta().companion?.job?.id).toBe(next.id);
    expect(f.meta().companion?.job?.state).toBe("scheduled");
    advance(GIFT_WAIT_MS);
    await f.obj.alarm();
    expect(f.meta().companion?.gifts.map(gift => gift.id)).toEqual([next.id]);
    expect(f.ai.calls).toHaveLength(0);
  });

  it("preserves a completed gift when the return was authenticating as the alarm ran", async () => {
    const f = await truffle({ state: pet() });
    const pending = value(await f.obj.companion(f.secret, { action: "away", generation: 0, client_request_id: "outing" })).companion.pending!;
    const auth = new Deferred<boolean>();
    vi.spyOn(pairing, "ownerMatches").mockImplementationOnce(() => auth.promise);
    const returning = f.obj.companion(f.secret, { action: "return", generation: 0, job_id: pending.id });
    advance(GIFT_WAIT_MS);
    await f.obj.alarm();
    const created = structuredClone(f.meta().companion!.gifts);
    expect(created).toHaveLength(1);
    auth.resolve(true);
    expect(value(await returning).companion).toEqual({ pending: null, gifts: created });
    await f.obj.alarm();
    expect(f.meta().companion!.gifts).toEqual(created);
    expect(f.ai.calls).toHaveLength(0);
  });
});
