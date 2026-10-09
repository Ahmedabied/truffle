import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STATE, initializeV2 } from "../src/engine";
import { GIFT_WAIT_MS, GIFT_TTL_MS, MAX_GIFTS } from "../src/gifts";
import * as pairing from "../src/pairing";
import { nextLocalMidnight } from "../src/time";
import type { CompanionInput, Result, StateSummary } from "../src/types";
import { advance, clock, Deferred, FakeFetch, truffle, until, useClock, type Fixture } from "./helpers/do-harness";

const DAY = 86_400_000;
let fetcher: FakeFetch;
beforeEach(() => {
  useClock("2026-10-10T08:00:00Z");
  fetcher = new FakeFetch();
  fetcher.install();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function value(result: Result<StateSummary>): StateSummary {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
const pet = (energy = 0, burrowed = false) => initializeV2({ ...structuredClone(DEFAULT_STATE), energy, burrowed }, clock.now);
const away = (f: Fixture, extra: Partial<CompanionInput> = {}) => f.obj.companion(f.secret, {
  action: "away", generation: f.meta().generation ?? 0, client_request_id: "outing-1", ...extra
});
const back = (f: Fixture, extra: Partial<CompanionInput> = {}) => f.obj.companion(f.secret, {
  action: "return", generation: f.meta().generation ?? 0, job_id: f.meta().companion?.job?.id, ...extra
});

describe("durable procedural outing jobs", () => {
  it("stores a ready gift in the alarm before any return and makes no provider call or food charge", async () => {
    const f = await truffle({ state: pet(100, true) });
    const initial = value(await away(f, { intent: "rest" }));
    expect(initial.companion).toMatchObject({ pending: { intent: "rest", due_ms: clock.now + GIFT_WAIT_MS }, gifts: [] });
    expect(f.alarms.at(-1)).toBe(clock.now + GIFT_WAIT_MS);
    const before = f.state().energy_units;
    advance(GIFT_WAIT_MS);
    await f.obj.alarm();
    expect(f.meta().companion?.job?.state).toBe("ready");
    expect(f.meta().companion?.gifts).toHaveLength(1);
    const stored = f.meta().companion!.gifts[0];
    expect(stored).toMatchObject({ created_ms: clock.now, generation: 0, provenance: { art: "procedural", note: "authored" } });
    expect(f.state().energy_units).toBe(before);
    expect(f.ai.calls).toHaveLength(0);
    expect(f.ai.extractions).toBe(0);
    expect(fetcher.count).toBe(0);
    expect(value(await back(f)).companion).toEqual({ pending: null, gifts: [stored] });
    expect(f.alarms.at(-1)).toBe(nextLocalMidnight(clock.now, "Asia/Muscat"));
  });

  it("does not generate a millisecond early, then generates exactly once at the boundary", async () => {
    const f = await truffle({ state: pet() });
    value(await away(f));
    advance(GIFT_WAIT_MS - 1);
    await f.obj.alarm();
    expect(f.meta().companion?.gifts).toEqual([]);
    expect(f.alarms.at(-1)).toBe(clock.now + 1);
    advance(1);
    await f.obj.alarm();
    await f.obj.alarm();
    expect(f.meta().companion?.gifts).toHaveLength(1);
    expect(f.state().dead).toBe(false);
    expect(f.state().energy).toBe(0);
  });

  it.each([0, GIFT_WAIT_MS - 1, GIFT_WAIT_MS, GIFT_WAIT_MS + 1])("return at %i ms cancels work the alarm has not started", async (elapsed) => {
    const f = await truffle({ state: pet() });
    value(await away(f));
    advance(elapsed);
    const returned = value(await back(f));
    expect(returned.companion).toEqual({ pending: null, gifts: [] });
    expect(f.meta().companion?.job?.state).toBe("cancelled");
    advance(GIFT_WAIT_MS);
    await f.obj.alarm();
    expect(f.meta().companion?.gifts).toEqual([]);
  });

  it("owner reads never synthesize an overdue gift", async () => {
    const f = await truffle({ state: pet() });
    value(await away(f));
    advance(GIFT_WAIT_MS + 1);
    const read = value(await f.obj.getState(f.secret));
    expect(read.companion.gifts).toEqual([]);
    expect(read.companion.pending).not.toBeNull();
    expect(f.meta().companion?.job?.state).toBe("scheduled");
  });

  it("deduplicates concurrent tabs and request replay without replacing the seed or deadline", async () => {
    const f = await truffle({ state: pet() });
    const results = await Promise.all([away(f), away(f, { client_request_id: "another-tab" })]);
    expect(value(results[0]).companion.pending).toEqual(value(results[1]).companion.pending);
    const first = f.meta().companion!.job!;
    advance(60_000);
    value(await away(f));
    expect(f.meta().companion?.job).toEqual(first);
    expect(f.meta().companion?.rate?.count).toBe(1);
    value(await back(f));
    value(await away(f));
    expect(f.meta().companion?.job?.state).toBe("cancelled");
    value(await away(f, { client_request_id: "new-outing" }));
    const second = f.meta().companion!.job!;
    expect(second.id).not.toBe(first.id);
    expect(second.seed).not.toBe(first.seed);
    expect(second.due_ms).toBe(clock.now + GIFT_WAIT_MS);
  });

  it("a stale return job id leaves a newer outing alone", async () => {
    const f = await truffle({ state: pet() });
    const first = value(await away(f)).companion.pending!;
    value(await back(f, { job_id: first.id }));
    const next = value(await away(f, { client_request_id: "outing-2" })).companion.pending!;
    const stale = value(await back(f, { action: "cancel", job_id: first.id }));
    expect(stale.companion.pending).toEqual(next);
    value(await back(f, { job_id: next.id }));
    expect(f.meta().companion?.job?.state).toBe("cancelled");
  });

  it("a completed replay is idempotent while new outings hit the pinned daily limit", async () => {
    const f = await truffle({ state: pet() });
    value(await away(f));
    advance(GIFT_WAIT_MS);
    await f.obj.alarm();
    expect(value(await away(f)).companion.gifts).toHaveLength(1);
    expect(value(await away(f, { client_request_id: "second-gift" })).companion).toMatchObject({ pending: null, gifts: f.meta().companion!.gifts });
    expect(f.meta().companion?.gifts).toHaveLength(1);
  });

  it("preserves the midnight alarm before a due gift and pins completion to the new local day", async () => {
    useClock("2026-10-10T19:55:00Z");
    const f = await truffle({ state: pet(100, true) });
    value(await away(f));
    const due = clock.now + GIFT_WAIT_MS;
    expect(f.alarms.at(-1)).toBe(Date.parse("2026-10-10T20:00:00Z"));
    advance(5 * 60_000);
    await f.obj.alarm();
    expect(f.meta().companion?.gifts).toEqual([]);
    expect(f.alarms.at(-1)).toBe(due);
    expect(f.state().age_days).toBe(1);
    advance(5 * 60_000);
    await f.obj.alarm();
    expect(f.meta().companion?.gifts[0].day).toBe("2026-10-11");
    expect(f.alarms.at(-1)).toBe(Date.parse("2026-10-11T20:00:00Z"));
    expect(value(await away(f, { client_request_id: "new-local-day" })).companion).toMatchObject({ pending: null, gifts: f.meta().companion!.gifts });
  });

  it("keeps a new pending deadline when a midnight alarm resumes after weather", async () => {
    useClock("2026-10-10T19:59:00Z");
    const f = await truffle({ state: pet() });
    const weather = new Deferred<unknown>();
    fetcher.queue.push(weather);
    advance(60_000);
    const midnight = f.obj.alarm();
    await until(() => fetcher.count === 1);
    value(await away(f));
    const due = f.meta().companion!.job!.due_ms;
    weather.resolve(503);
    await midnight;
    expect(f.alarms.at(-1)).toBe(due);
    expect(f.meta().companion?.job?.due_ms).toBe(due);
  });

  it("closes midnight and stores the gift when both deadlines are identical", async () => {
    useClock("2026-10-10T19:50:00Z");
    const f = await truffle({ state: pet() });
    value(await away(f));
    advance(GIFT_WAIT_MS);
    await f.obj.alarm();
    expect(f.state().age_days).toBe(1);
    expect(f.meta().companion?.gifts).toHaveLength(1);
    expect(f.meta().companion?.gifts[0].day).toBe("2026-10-11");
    expect(f.alarms.at(-1)).toBe(Date.parse("2026-10-11T20:00:00Z"));
  });

  it("retains at most twelve server gifts over many real local days", async () => {
    const f = await truffle({ state: pet(0, true) });
    const ids: string[] = [];
    for (let day = 0; day < MAX_GIFTS + 2; day++) {
      const pending = value(await away(f, { client_request_id: `day-${day}` })).companion.pending!;
      ids.push(pending.id);
      advance(GIFT_WAIT_MS);
      await f.obj.alarm();
      advance(DAY - GIFT_WAIT_MS);
    }
    expect(f.meta().companion?.gifts.map(gift => gift.id)).toEqual(ids.slice(-MAX_GIFTS));
    expect(f.ai.calls).toHaveLength(0);
  });

  it("bounds new admissions per hour and lets returns release pending work", async () => {
    const f = await truffle({ state: pet() });
    for (let i = 0; i < 30; i++) {
      value(await away(f, { client_request_id: `outing-${i}` }));
      value(await back(f));
    }
    expect(await away(f, { client_request_id: "over-limit" })).toMatchObject({ ok: false, status: 429, retry_after_s: 3600 });
    expect(f.meta().companion?.rate?.count).toBe(30);
    advance(3_600_000);
    expect(value(await away(f, { client_request_id: "next-hour" })).companion.pending).not.toBeNull();
    expect(f.meta().companion?.rate?.count).toBe(1);
  });

  it("a rolled-back clock cannot admit or complete work early", async () => {
    const f = await truffle({ state: pet() });
    value(await away(f));
    advance(-1000);
    expect(await away(f, { client_request_id: "rollback" })).toMatchObject({ ok: false, status: 409 });
    await f.obj.alarm();
    expect(f.meta().companion?.gifts).toEqual([]);
    expect(f.alarms.at(-1)).toBe(clock.now + GIFT_WAIT_MS + 1000);
  });

  it("expires an alarm delivered after the bounded job lifetime", async () => {
    const f = await truffle({ state: pet(0, true) });
    value(await away(f));
    advance(GIFT_TTL_MS);
    await f.obj.alarm();
    expect(f.meta().companion?.job?.state).toBe("expired");
    expect(f.meta().companion?.gifts).toEqual([]);
  });
});

describe("gift life and privacy fences", () => {
  it("demo time travel never shortens the ten real minute wait or advances the gift day", async () => {
    const f = await truffle({ state: pet(0, true), meta: { demo: true } });
    const pending = value(await away(f)).companion.pending!;
    value(await f.obj.forceMidnight(f.secret));
    await f.obj.alarm();
    expect(f.meta().companion?.gifts).toEqual([]);
    expect(f.alarms.at(-1)).toBe(pending.due_ms);
    advance(GIFT_WAIT_MS);
    await f.obj.alarm();
    expect(f.meta().companion?.gifts[0].day).toBe("2026-10-10");
    expect(f.alarms.at(-1)).toBe(f.meta().created_ms + DAY);
    expect(value(await away(f, { client_request_id: "simulated-tomorrow" })).companion).toMatchObject({ pending: null, gifts: f.meta().companion!.gifts });
  });

  it("demo expiry wins over a later pending deadline and deletes storage", async () => {
    const f = await truffle({ state: pet(0, true), meta: { demo: true, created_ms: clock.now - DAY + 60_000 } });
    value(await away(f));
    expect(f.alarms.at(-1)).toBe(clock.now + 60_000);
    advance(60_000);
    await f.obj.alarm();
    expect(f.priv.load()).toBeNull();
    expect(await f.obj.companion(f.secret, { action: "away", generation: 0 })).toMatchObject({ ok: false, status: 401 });
  });

  it("reset clears jobs and gifts, preserves the daily fence, and rejects both kinds of old packets", async () => {
    const f = await truffle({ state: pet(0, true), meta: { demo: true } });
    value(await away(f));
    advance(GIFT_WAIT_MS);
    await f.obj.alarm();
    const reset = value(await f.obj.reset(f.secret));
    expect(reset.generation).toBe(1);
    expect(reset.companion).toEqual({ pending: null, gifts: [] });
    expect(f.meta().companion?.last_gift_day).toBe("2026-10-10");
    expect(await away(f, { generation: 0 })).toMatchObject({ ok: false, status: 409 });
    expect(await back(f, { generation: 0 })).toMatchObject({ ok: false, status: 409 });
    expect(value(await away(f, { client_request_id: "reset-bypass" })).companion).toEqual({ pending: null, gifts: [] });
    expect(f.meta().companion?.last_gift_day).toBe("2026-10-10");
  });

  it.each(["away", "return", "cancel"] as const)("fences a %s already in authentication when reset starts a new life", async (action) => {
    const f = await truffle({ state: pet(0, true), meta: { demo: true } });
    const gate = new Deferred<boolean>();
    vi.spyOn(pairing, "ownerMatches").mockImplementationOnce(() => gate.promise);
    const old = f.obj.companion(f.secret, { action, generation: 0, client_request_id: "old" });
    value(await f.obj.reset(f.secret));
    const newPending = value(await away(f, { client_request_id: "new" })).companion.pending!;
    gate.resolve(true);
    expect(await old).toMatchObject({ ok: false, status: 409 });
    expect(f.meta().companion?.job?.id).toBe(newPending.id);
    expect(f.meta().companion?.job?.generation).toBe(1);
  });

  it("settles death before an overdue gift and clears the old life before spore recovery", async () => {
    const state = { ...pet(), empty_ms: 4 * DAY - GIFT_WAIT_MS };
    const f = await truffle({ state });
    value(await away(f));
    advance(GIFT_WAIT_MS);
    await f.obj.alarm();
    expect(f.state().dead).toBe(true);
    expect(f.meta().generation).toBe(1);
    expect(f.meta().companion?.gifts).toEqual([]);
    expect(f.meta().companion?.job).toBeUndefined();
    expect(await away(f)).toMatchObject({ ok: false, status: 409 });
    const next = value(await f.obj.spore(f.secret));
    expect(next.generation).toBe(2);
    expect(next.companion).toEqual({ pending: null, gifts: [] });
    expect(await away(f, { generation: 0 })).toMatchObject({ ok: false, status: 409 });
    expect(value(await away(f, { client_request_id: "new-life" })).companion.pending).not.toBeNull();
  });

  it("publishes only pending id, intent and due time, and phrase feeding never sees gifts", async () => {
    const f = await truffle({ state: pet(0, true) });
    const summary = value(await away(f, { intent: "errand", client_request_id: "private-request-id" }));
    const job = f.meta().companion!.job!;
    expect(Object.keys(summary.companion.pending!).sort()).toEqual(["due_ms", "id", "intent"]);
    expect(JSON.stringify(summary)).not.toContain(job.seed);
    expect(JSON.stringify(summary)).not.toContain("private-request-id");
    const fed = await f.obj.feed({ total: 0, day: "2026-10-10", day_tz: "Asia/Muscat" });
    expect(fed.ok).toBe(true);
    if (fed.ok) {
      expect(fed.value).not.toHaveProperty("companion");
      expect(JSON.stringify(fed.value)).not.toContain(job.id);
    }
  });
});
