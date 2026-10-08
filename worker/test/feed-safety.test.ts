import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import type { FeedInput } from "../src/do";
import type { Env } from "../src/types";
import { FakeFetch, truffle, useClock } from "./helpers/do-harness";

beforeEach(() => {
  useClock("2026-10-08T08:00:00Z");
  new FakeFetch().install();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("dated step uploads", () => {
  it.each([
    {}, { day: "2026-10-08" }, { day_tz: "Asia/Muscat" },
    { day: "2026-02-30", day_tz: "Asia/Muscat" },
    { day: "2026-10-08", day_tz: "not/a-zone" }
  ])("rejects an incomplete or invalid day envelope before touching a pet: %j", async (fields) => {
    const get = vi.fn(() => ({ feed: async () => ({ ok: true, value: {} }) }));
    const env = { TRUFFLE: { get, idFromName: (name: string) => name }, LIMITER: {} } as unknown as Env;
    const response = await app.fetch(new Request("https://api.test/feed", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ phrase: "sand-moon-fig", steps_today_total: 2500, ...fields })
    }), env);
    expect(response.status).toBe(400);
    expect(get).not.toHaveBeenCalled();
  });

  it("a dayless replay after midnight cannot credit energy or moments", async () => {
    const f = await truffle({ state: { steps_today: 5000, lifetime_steps: 5000, energy: 5000 } });
    useClock("2026-10-08T20:10:00Z");
    const result = await f.obj.feed({ total: 5000 });
    expect(result.ok).toBe(false);
    expect(f.state().lifetime_steps).toBe(5000);
    expect(f.meta().moments ?? []).toEqual([]);
  });

  it("ignores the wrong zone without credit, then accepts a correctly aggregated retry", async () => {
    const f = await truffle();
    const wrong = await f.obj.feed({ total: 2500, day: "2026-10-08", day_tz: "Pacific/Honolulu" } as FeedInput);
    expect(wrong.ok && wrong.value).toMatchObject({ ignored: expect.any(String), active_tz: "Asia/Muscat", expected_day: "2026-10-08", steps_today: 0 });
    expect(f.state().lifetime_steps).toBe(0);
    expect(f.meta().feed_accept).toBeUndefined();
    expect(f.meta().moments ?? []).toEqual([]);
    const right = await f.obj.feed({ total: 2000, day: "2026-10-08", day_tz: "Asia/Muscat" } as FeedInput);
    expect(right.ok && right.value.steps_today).toBe(2000);
  });

  it("does not accept yesterday's correctly zoned total", async () => {
    const f = await truffle();
    const result = await f.obj.feed({ total: 5000, day: "2026-10-07", day_tz: "Asia/Muscat" } as FeedInput);
    expect(result.ok && result.value.ignored).toContain("already closed");
    expect(f.state().lifetime_steps).toBe(0);
  });

  it("the HTTP route preserves day_tz for the object's mismatch check", async () => {
    const f = await truffle();
    const env = { TRUFFLE: { idFromName: (name: string) => name, get: () => f.obj } } as unknown as Env;
    const response = await app.fetch(new Request("https://api.test/feed", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ phrase: "sand-moon-fig", steps_today_total: 2500, day: "2026-10-08", day_tz: "Pacific/Honolulu" })
    }), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ steps_today: 0, ignored: expect.any(String), active_tz: "Asia/Muscat" });
    expect(f.state().lifetime_steps).toBe(0);
  });
});

describe("weather outages preserve known heat protection", () => {
  it("keeps a hot day protected through missed midnights without manufacturing a cool forecast", async () => {
    const f = await truffle({ state: { burrowed: true, energy: 3000, lifetime_steps: 3000 } });
    useClock("2026-10-12T08:00:00Z");
    await f.obj.alarm();
    expect(f.state()).toMatchObject({ burrowed: true, dead: false, zero_days: 0, energy: 3000 });
    expect(f.meta().weather_days).toEqual({});
  });

  it("uses a known cool forecast instead of retaining yesterday's heat flag", async () => {
    const f = await truffle({ state: { burrowed: true, energy: 3000, lifetime_steps: 3000 }, meta: { weather_days: { "2026-10-09": 25 } } });
    useClock("2026-10-09T08:00:00Z");
    await f.obj.alarm();
    expect(f.state().burrowed).toBe(false);
  });
});
