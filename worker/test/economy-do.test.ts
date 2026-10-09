import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENERGY_V2_CUTOVER_MS as C } from "../src/config";
import { DEFAULT_STATE, initializeV2 } from "../src/engine";
import { hashSecret } from "../src/pairing";
import { advance, clock, Deferred, FakeFetch, makeObject, settle, startChat, truffle, until, useClock } from "./helpers/do-harness";

const D = 86_400_000;
const U = 86_400_000;
beforeEach(() => { useClock(new Date(C).toISOString()); new FakeFetch().install(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const v2 = (energy = 0) => initializeV2({ ...structuredClone(DEFAULT_STATE), energy }, clock.now);

it("new pairs initialize an empty canonical balance and publish total capacity/generation", async () => {
  const f = makeObject();
  const r = await f.obj.pair({ tz: "UTC", country: "", lang: "en", lat: 0, lon: 0, city: "", secret_hash: await hashSecret("owner"), demo: false });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.value).toMatchObject({ energy_max: 12000, generation: 0, state: { energy_version: 2, energy_units: 0, energy_settled_ms: C } });
});

it("migrates after all legacy midnights and settles through the request before feeding", async () => {
  const f = await truffle({ state: { energy: 6000, burrowed: true, steps_today: 200, history7: [300] }, meta: { tz: "UTC", created_ms: C - 24 * D, last_tick_ms: C - 24 * D, last_midnight_key: new Date(C - 24 * D).toISOString().slice(0, 10) } });
  f.priv.addFacts(["Likes mushrooms"], "2026-09-15", 1);
  advance(D);
  const r = await f.obj.feed({ day: new Date(clock.now).toISOString().slice(0, 10), day_tz: "UTC", total: 100 });
  expect(r.ok).toBe(true);
  expect(f.state()).toMatchObject({ energy_version: 2, energy: 6100, steps_today: 100, age_days: 25, energy_settled_ms: clock.now });
  expect(f.facts()).toHaveLength(1);
});

it("v2 reads close midnight without a food debit and preserve exact fractional maintenance", async () => {
  useClock("2026-10-09T23:59:00Z");
  const f = await truffle({ state: { ...v2(1000), steps_today: 1000 }, meta: { tz: "UTC", last_midnight_key: "2026-10-09" } });
  advance(180000);
  const r = await f.obj.getState(f.secret);
  expect(r.ok).toBe(true);
  expect(f.state()).toMatchObject({ energy: 997, energy_units: 1000 * U - 180000000, steps_today: 0, age_days: 1 });
});

it("holds admitted food across reads and charges before the first visible provider token", async () => {
  const f = await truffle({ state: v2(20) });
  const held = f.ai.hold();
  const chat = await startChat(f, "low");
  await settle();
  expect(f.meta().chat).toMatchObject({ cost: 20, charged: false });
  advance(10000);
  const read = await f.obj.getState(f.secret);
  expect(read.ok && read.value).toMatchObject({ reserved_energy: 20, tier: "asleep", state: { energy: 20, empty_ms: 10000 } });
  held.push("Hello.");
  await settle();
  expect(f.state().energy).toBe(0);
  expect(f.meta().chat?.charged).toBe(true);
  held.end();
  const events = await chat.events!;
  await f.drain();
  expect(events.find(e => e.event === "done")?.data.spent).toBe(20);
  expect(f.state().energy).toBe(0);
});

it("v2 demo next day consumes 24 actual hours without a cursor rewind", async () => {
  const f = await truffle({ state: v2(5000), meta: { demo: true } });
  const r = await f.obj.forceMidnight(f.secret);
  expect(r.ok && r.value.state).toMatchObject({ energy: 4000, age_days: 1, energy_settled_ms: C + D });
  advance(3600000);
  await f.obj.getState(f.secret);
  expect(f.state().energy_units).toBe(4000 * U - 3600000000);
});

it("simultaneous absolute feeds cannot overwrite each other's accepted total", async () => {
  const f = await truffle({ state: v2(100) });
  const day = new Date(clock.now + 4 * 3600000).toISOString().slice(0, 10);
  await Promise.all([f.obj.feed({ total: 200, day, day_tz: "Asia/Muscat" }), f.obj.feed({ total: 100, day, day_tz: "Asia/Muscat" })]);
  expect(f.state()).toMatchObject({ energy: 300, steps_today: 200, lifetime_steps: 200 });
});

it("an expired uncommitted hold releases at its deadline, then funds subsequent maintenance", async () => {
  const f = await truffle({ state: v2(20), meta: { chat: { id: "crashed", generation: 0, until: C + 60000, cost: 20, charged: false } } });
  advance(120000);
  await f.obj.getState(f.secret);
  expect(f.meta().chat).toBeUndefined();
  expect(f.state()).toMatchObject({ energy_units: 20 * U - 60000000, empty_ms: 0 });
});

it("crash recovery never refunds a visible committed reply", async () => {
  const f = await truffle({ state: v2(80), meta: { demo: true, demo_replies: { start_ms: C, count: 1 }, chat: { id: "paid", generation: 0, until: C + 60000, cost: 20, charged: true, demo_window: C } } });
  advance(120000);
  await f.obj.getState(f.secret);
  expect(f.meta().chat).toBeUndefined();
  expect(f.meta().demo_replies?.count).toBe(1);
  expect(f.state().energy_units).toBe(80 * U - 120000000);
});

it("death happens at the exact elapsed deadline and wipes memory only once", async () => {
  const f = await truffle({ state: v2(0) });
  f.priv.addFacts(["The favorite mushroom"], "2026-10-09", 2);
  advance(4 * D);
  const r = await f.obj.feed({ total: 100, day: new Date(clock.now + 4 * 3600000).toISOString().slice(0, 10), day_tz: "Asia/Muscat" });
  expect(r.ok).toBe(true);
  expect(f.state()).toMatchObject({ dead: true, died_ms: C + 4 * D, energy: 0 });
  expect(f.state().gravestones).toHaveLength(1);
  expect(f.state().gravestones[0].memory).toBe("The favorite mushroom");
  expect(f.facts()).toEqual([]);
  expect(f.meta().generation).toBe(1);
  await f.obj.getState(f.secret);
  await f.obj.alarm();
  expect(f.state().gravestones).toHaveLength(1);
  expect(f.meta().generation).toBe(1);
  const planted = await f.obj.spore(f.secret);
  expect(planted.ok && planted.value.state).toMatchObject({ dead: false, energy_version: 2, energy_settled_ms: clock.now });
});

it("positive food one millisecond before death resets empty time; duplicate food does not", async () => {
  const f = await truffle({ state: v2(0) });
  advance(4 * D - 1);
  const day = new Date(clock.now + 4 * 3600000).toISOString().slice(0, 10);
  await f.obj.feed({ total: 1, day, day_tz: "Asia/Muscat" });
  expect(f.state()).toMatchObject({ dead: false, empty_ms: 0, energy: 1 });
  advance(86401);
  await f.obj.feed({ total: 1, day, day_tz: "Asia/Muscat" });
  expect(f.state()).toMatchObject({ dead: false, empty_ms: 1, energy: 0 });
});

it("migration fences a legacy cursor already past cutover without changing its balance", async () => {
  const f = await truffle({ state: { energy: 3000 }, meta: { created_ms: C - D, last_tick_ms: C + 1 } });
  advance(2);
  const r = await f.obj.getState(f.secret);
  expect(r).toMatchObject({ ok: false, status: 409 });
  expect(f.state().energy).toBe(3000);
  expect(f.state().energy_version).toBeUndefined();
});

it("a long pre-cutover gap may cause legacy death, and migration never revives it", async () => {
  const f = await truffle({ state: { energy: 0, zero_days: 3 }, meta: { tz: "UTC", created_ms: C - 30 * D, last_tick_ms: C - 30 * D, last_midnight_key: new Date(C - 30 * D).toISOString().slice(0, 10) } });
  f.priv.addFacts(["Keep on the grave"], "2026-09-01", 1);
  await f.obj.getState(f.secret);
  expect(f.state()).toMatchObject({ energy_version: 2, dead: true, energy: 0, age_days: 1 });
  expect(f.state().gravestones).toHaveLength(1);
  expect(f.meta().generation).toBe(1);
});

it("migrating a dead record preserves its existing grave, generation and facts", async () => {
  const grave = { age_days: 5, lifetime_steps: 10, stage: "Spore" as const, memory: "A day" };
  const f = await truffle({ state: { dead: true, gravestones: [grave] }, meta: { generation: 4, created_ms: C - D, last_tick_ms: C - D } });
  f.priv.addFacts(["Preserve historical record"], "2026-10-08", 1);
  await f.obj.getState(f.secret);
  expect(f.state().gravestones).toEqual([grave]);
  expect(f.meta().generation).toBe(4);
  expect(f.facts()).toHaveLength(1);
});

it("sheltered long catch-up retains weather until its future intervals are consumed", async () => {
  const start = Date.UTC(2026, 10, 1, 12);
  useClock(new Date(start).toISOString());
  const weather_days: Record<string, number> = {};
  for (let i = 1; i <= 25; i++) weather_days[new Date(start + i * D).toISOString().slice(0, 10)] = i === 1 ? 45 : 30;
  const f = await truffle({ state: v2(24000), meta: { tz: "UTC", last_midnight_key: "2026-11-01", weather_days } });
  advance(24 * D);
  await f.obj.getState(f.secret);
  expect(f.state()).toMatchObject({ dead: false, energy: 1000, age_days: 24, energy_settled_ms: clock.now });
});

it("DST calendar days consume actual elapsed hours", async () => {
  useClock("2026-10-24T22:00:00Z");
  const f = await truffle({ state: v2(5000), meta: { tz: "Europe/Berlin", last_midnight_key: "2026-10-25" } });
  advance(25 * 3600000);
  await f.obj.getState(f.secret);
  expect(f.state()).toMatchObject({ energy_units: 5000 * U - 90000000000, age_days: 1, history7: [0] });
});

it("a delayed owner check cannot replace a concurrent accepted feed", async () => {
  const f = await truffle({ state: v2(100) });
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  const gate = new Deferred<ArrayBuffer>();
  vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(() => gate.promise);
  const owner = f.obj.getState(f.secret);
  const day = new Date(clock.now + 4 * 3600000).toISOString().slice(0, 10);
  await f.obj.feed({ total: 200, day, day_tz: "Asia/Muscat" });
  gate.resolve(await digest("SHA-256", new TextEncoder().encode("truffle-secret:" + f.secret)));
  expect((await owner).ok).toBe(true);
  expect(f.state()).toMatchObject({ energy: 300, steps_today: 200 });
});

it("a held full-cap reply does not create feed capacity and preserves concurrent food", async () => {
  const f = await truffle({ state: v2(12000) });
  const held = f.ai.hold();
  const chat = await startChat(f, "high");
  await settle();
  const day = new Date(clock.now + 4 * 3600000).toISOString().slice(0, 10);
  await f.obj.feed({ total: 100, day, day_tz: "Asia/Muscat" });
  expect(f.state().energy).toBe(12000);
  expect(f.meta().chat).toMatchObject({ cost: 200, charged: false });
  held.push("Here is a thought.");
  held.end();
  await chat.events;
  await f.drain();
  expect(f.state()).toMatchObject({ energy: 11800, steps_today: 100 });
});

it("heat and whitespace never commit food, and empty failure releases only its own hold", async () => {
  const f = await truffle({ state: { ...v2(20), burrowed: true }, meta: { demo: true } });
  f.ai.script.push({ kind: "text", parts: ["  "] }, { kind: "text", parts: ["\n"] });
  const chat = await startChat(f, "low");
  const events = await chat.events!;
  await f.drain();
  expect(events.some(e => e.event === "error")).toBe(true);
  expect(f.state().energy).toBe(20);
  expect(f.meta().chat).toBeUndefined();
  expect(f.meta().demo_replies?.count).toBe(0);
});

it("visible partial replies keep one committed charge after a stream failure", async () => {
  const f = await truffle({ state: v2(100) });
  f.ai.script.push({ kind: "text", parts: ["First words."], errorAfter: true });
  const chat = await startChat(f, "low");
  const events = await chat.events!;
  await f.drain();
  expect(events.find(e => e.event === "done")?.data).toMatchObject({ spent: 20, partial: true });
  expect(f.state().energy).toBe(80);
  expect(f.turns()).toHaveLength(2);
});

it("demo reset fences late visible output and removes the old hold", async () => {
  const f = await truffle({ state: v2(100), meta: { demo: true } });
  const held = f.ai.hold();
  const chat = await startChat(f, "low");
  await settle();
  await f.obj.reset(f.secret);
  held.push("Old life words.");
  held.end();
  const events = await chat.events!;
  await f.drain();
  expect(events.filter(e => e.event === "token")).toEqual([]);
  expect(f.state()).toMatchObject({ energy: 0, energy_version: 2, empty_ms: 0 });
  expect(f.meta().chat).toBeUndefined();
  expect(f.meta().generation).toBe(1);
  expect(f.turns()).toEqual([]);
});

it("clock rollback cannot reopen a closed feed day or rewind food", async () => {
  useClock("2026-10-10T00:01:00Z");
  const f = await truffle({ state: v2(1000), meta: { tz: "UTC", last_midnight_key: "2026-10-10" } });
  const cursor = clock.now;
  advance(-120000);
  const r = await f.obj.feed({ total: 200, day: "2026-10-09", day_tz: "UTC" });
  expect(r.ok && r.value).toMatchObject({ expected_day: "2026-10-10", energy: 1000 });
  expect(r.ok && r.value.ignored).toContain("closed");
  expect(f.state()).toMatchObject({ energy_settled_ms: cursor, steps_today: 0 });
});

it("missing forecast retains shelter through an offline gap", async () => {
  const f = await truffle({ state: { ...v2(0), burrowed: true } });
  advance(12 * D);
  await f.obj.getState(f.secret);
  expect(f.state()).toMatchObject({ energy: 0, empty_ms: 0, dead: false, age_days: 12, burrowed: true });
});

it("migration discards an unversioned ticket without inventing a visible charge", async () => {
  const f = await truffle({ state: { energy: 400 }, meta: { demo: true, created_ms: C - 1000, last_tick_ms: C - 1000, demo_replies: { start_ms: C - 1000, count: 1 }, chat: { id: "legacy", generation: 0, until: C + 60000, demo_window: C - 1000 } } });
  await f.obj.getState(f.secret);
  expect(f.state()).toMatchObject({ energy_version: 2, energy: 400 });
  expect(f.meta().chat).toBeUndefined();
  expect(f.meta().demo_replies?.count).toBe(0);
});

it("a fresh cool forecast cannot retroactively consume a protected interval", async () => {
  const f = await truffle({ state: { ...v2(1000), burrowed: true } });
  const net = new FakeFetch();
  const pending = new Deferred<unknown>();
  net.queue.push(pending);
  net.install();
  const read = f.obj.getState(f.secret);
  await until(() => net.count === 1);
  advance(3600000);
  const day = new Date(clock.now + 4 * 3600000).toISOString().slice(0, 10);
  await f.obj.feed({ total: 100, day, day_tz: "Asia/Muscat" });
  pending.resolve({ timezone: "Asia/Muscat", current: { apparent_temperature: 30, weather_code: 0 }, hourly: { time: [day + "T12:00"], apparent_temperature: [30] } });
  await read;
  expect(f.state()).toMatchObject({ energy: 1100, burrowed: false, energy_settled_ms: clock.now, steps_today: 100 });
  advance(3600000);
  await f.obj.getState(f.secret);
  expect(f.state().energy_units).toBe(1100 * U - 3600000000);
});

it("a newly spawned demo previews v2 before the real-pet cutover", async () => {
  useClock(new Date(C - 60000).toISOString());
  const f = makeObject();
  const r = await f.obj.pair({ tz: "UTC", country: "", lang: "en", lat: 0, lon: 0, city: "", secret_hash: await hashSecret("owner"), demo: true });
  expect(r.ok && r.value.state.energy_version).toBe(2);
  expect(DEFAULT_STATE).not.toHaveProperty("energy_version");
  expect(DEFAULT_STATE.energy).toBe(0);
});

it("a guarded private state block is a free notice, not a paid provider reply", async () => {
  const f = await truffle({ state: v2(100) });
  f.ai.script.push({ kind: "text", parts: ["[truffle stage=Spore energy=2% tier=low]"] });
  const chat = await startChat(f, "low");
  const events = await chat.events!;
  await f.drain();
  expect(f.state().energy).toBe(100);
  expect(f.turns()).toEqual([]);
  expect(events.some(e => e.event === "error")).toBe(true);
});

it("restarts after a persisted migration batch without repeating its calendar work", async () => {
  const start = C - 24 * D;
  const f = await truffle({ state: { energy: 6000, burrowed: true, steps_today: 200 }, meta: { tz: "UTC", created_ms: start, last_tick_ms: start, last_midnight_key: new Date(start).toISOString().slice(0, 10) } });
  const save = f.priv.save.bind(f.priv);
  let interrupted = false;
  vi.spyOn(f.priv, "save").mockImplementation((state, meta) => {
    save(state, meta);
    if (!interrupted && state.age_days === 14) {
      interrupted = true;
      throw new Error("simulated restart after committed batch");
    }
  });
  await expect(f.obj.getState(f.secret)).rejects.toThrow("simulated restart");
  expect(f.state().age_days).toBe(14);
  const r = await f.obj.getState(f.secret);
  expect(r.ok && r.value.state).toMatchObject({ energy_version: 2, energy: 6000, age_days: 24, energy_settled_ms: C });
});

it("a living migration starts measured empty time from cutover rather than old zero snapshots", async () => {
  const f = await truffle({ state: { energy: 0, zero_days: 3 }, meta: { created_ms: C - 1, last_tick_ms: C - 1 } });
  await f.obj.getState(f.secret);
  expect(f.state()).toMatchObject({ energy_version: 2, empty_ms: 0, zero_days: 0, dead: false });
  expect(f.meta().generation ?? 0).toBe(0);
});
