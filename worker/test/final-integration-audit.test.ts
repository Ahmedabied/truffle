// Final independent integration audit. In-memory SQLite and stubbed providers only.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ENERGY_V2_CUTOVER_MS as C, ENERGY_V2_UNITS_PER_POINT as U } from "../src/config";
import { DEFAULT_STATE, initializeV2 } from "../src/engine";
import { GIFT_WAIT_MS } from "../src/gifts";
import { advance, clock, FakeFetch, settle, truffle, useClock } from "./helpers/do-harness";

const D = 86_400_000;
const day = (at: number) => new Date(at).toISOString().slice(0, 10);
beforeEach(() => { useClock(new Date(C).toISOString()); new FakeFetch().install(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("closes one unsettled legacy midnight, then exactly one elapsed v2 day, preserving the owner and records", async () => {
  const midnight = Math.floor(C / D) * D;
  const created = midnight - 30 * 60_000;
  const grave = { age_days: 8, lifetime_steps: 400, stage: "Spore" as const, memory: "Earlier life" };
  const f = await truffle({
    state: { energy: 6000, steps_today: 200, lifetime_steps: 1200, history7: [10], gravestones: [grave] },
    meta: { tz: "UTC", created_ms: created, last_tick_ms: created, last_midnight_key: day(created), generation: 7 }
  });
  const owner = f.meta().secret_hash;
  f.priv.addFacts(["Keeps a small garden"], day(created), 2);

  advance(D);
  const result = await f.obj.getState(f.secret);
  expect(result.ok).toBe(true);
  // One old Spore midnight costs 1,500. The next actual day costs 1,000,
  // regardless of the additional v2 calendar boundary inside that interval.
  expect(f.state()).toMatchObject({
    energy_version: 2, energy: 3500, energy_units: 3500 * U, energy_settled_ms: C + D,
    age_days: 2, steps_today: 0, lifetime_steps: 1200, history7: [10, 200, 0], gravestones: [grave]
  });
  expect(f.meta()).toMatchObject({ secret_hash: owner, generation: 7, created_ms: created });
  expect(f.facts()).toEqual([{ text: "Keeps a small garden", day_written: day(created) }]);

  const before = f.state();
  const replay = await f.obj.feed({ total: 200, day: day(created), day_tz: "UTC" });
  expect(replay.ok && replay.value.ignored).toContain("already closed");
  expect(f.state()).toEqual(before);
  expect(f.ai.calls).toHaveLength(0);
});

it("a midnight gift alarm preserves an unpaid chat hold, then cancellation releases only the hold", async () => {
  const tomorrow = (Math.floor(C / D) + 3) * D;
  const origin = tomorrow - GIFT_WAIT_MS + 20_000;
  useClock(new Date(origin).toISOString());
  const f = await truffle({
    state: initializeV2({ ...structuredClone(DEFAULT_STATE), energy: 1000, steps_today: 100, lifetime_steps: 100 }, origin),
    meta: { tz: "UTC", last_midnight_key: day(origin) }
  });
  const scheduled = await f.obj.companion(f.secret, {
    action: "away", generation: 0, intent: "rest", client_request_id: "final-audit-outing"
  });
  expect(scheduled.ok).toBe(true);
  const jobId = f.meta().companion!.job!.id;

  advance(GIFT_WAIT_MS - 30_000);
  const held = f.ai.hold();
  const chat = await f.obj.chat(f.secret, "Hello", "low", "en");
  if (!chat.ok) throw new Error(chat.error);
  await settle();
  held.push("stage"); // Possible guard prefix is not visible provider text.
  await settle();
  expect(f.meta().chat).toMatchObject({ cost: 20, charged: false });

  advance(30_000);
  await f.obj.alarm();
  const expectedUnits = 1000 * U - GIFT_WAIT_MS * 1000;
  expect(f.state()).toMatchObject({ energy_units: expectedUnits, steps_today: 0, age_days: 1, dead: false });
  expect(f.meta().chat).toMatchObject({ cost: 20, charged: false });
  expect(f.meta().companion!.gifts).toHaveLength(1);
  const gift = f.meta().companion!.gifts[0];
  expect(gift).toMatchObject({ id: jobId, generation: 0, day: day(tomorrow), created_ms: clock.now });
  expect(f.ai.calls).toHaveLength(1); // The chat alone; the alarm uses no provider.
  expect(f.ai.extractions).toBe(0);

  await chat.value.cancel("owner left before visible reply");
  await f.drain();
  expect(held.aborted).toBe(true);
  expect(f.meta().chat).toBeUndefined();
  expect(f.turns()).toEqual([]);
  expect(f.state().energy_units).toBe(expectedUnits);
  const oldFeed = await f.obj.feed({ total: 100, day: day(origin), day_tz: "UTC" });
  expect(oldFeed.ok && oldFeed.value.ignored).toContain("already closed");
  await f.obj.companion(f.secret, { action: "away", generation: 0, client_request_id: "second-outing" });
  await f.obj.alarm();
  expect(f.meta().companion!.gifts).toEqual([gift]);
  expect(f.state().energy_units).toBe(expectedUnits);
});
