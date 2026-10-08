// R02 (S11-05): uniform 401 bodies, and a per-IP limit on failed owner
// lookups that answers before any Truffle object is touched. Routes run
// through the real Hono app with real TruffleDO and LimiterDO code on fakes.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { generatePhrase, generateSecret, hashPhrase, hashSecret } from "../src/pairing";
import { AUTH_FAILS_PER_MINUTE } from "../src/ratelimit";
import type { Env } from "../src/types";
import { advance, FakeFetch, makeLimiter, makeObject, namespace, useClock } from "./helpers/do-harness";

let env: Env;
let truffles: ReturnType<typeof namespace>;
let phrase: string;
let secret: string;

beforeEach(async () => {
  useClock("2026-10-08T08:00:00Z");
  new FakeFetch().install(); // weather is down: no network in tests
  truffles = namespace(() => makeObject().obj);
  const limiters = namespace(() => makeLimiter());
  env = { TRUFFLE: truffles, LIMITER: limiters, AI: {} } as unknown as Env;
  phrase = generatePhrase();
  secret = generateSecret();
  const stub = env.TRUFFLE.get(env.TRUFFLE.idFromName(await hashPhrase(phrase)));
  const r = await stub.pair({
    tz: "Asia/Muscat", country: "OM", lang: "en", lat: 23.59, lon: 58.41, city: "Muscat",
    demo: false, secret_hash: await hashSecret(secret)
  });
  expect(r.ok).toBe(true);
  truffles.gets = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function state(p: string, s: string | null, ip = "203.0.113.7") {
  const headers: Record<string, string> = { "cf-connecting-ip": ip };
  if (s !== null) headers["x-truffle-secret"] = s;
  return app.fetch(new Request(`http://truffle.test/state?phrase=${p}`, { headers }), env);
}

describe("R02 uniform auth failures (S11-05)", () => {
  it("unknown phrase, wrong secret and missing secret give the same status and bytes", async () => {
    let other = generatePhrase();
    while (other === phrase) other = generatePhrase();
    const responses = [await state(other, generateSecret()), await state(phrase, generateSecret()), await state(phrase, null)];
    const bodies = await Promise.all(responses.map((r) => r.text()));
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401]);
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0])).toEqual({ error: "That phrase and secret do not match a Truffle." });
  });

  it("an unknown phrase creates no tables", async () => {
    let other = generatePhrase();
    while (other === phrase) other = generatePhrase();
    await state(other, generateSecret());
    const id = await hashPhrase(other);
    const obj = truffles.objects.get(id) as unknown as { sql: { exec(q: string): { toArray(): unknown[] } } };
    expect(obj.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table'").toArray()).toEqual([]);
  });

  it(`after ${AUTH_FAILS_PER_MINUTE} failed lookups a minute, the next gets 429 before any Truffle object is touched`, async () => {
    expect(AUTH_FAILS_PER_MINUTE).toBe(30);
    for (let i = 0; i < AUTH_FAILS_PER_MINUTE; i++) expect((await state(phrase, generateSecret())).status).toBe(401);
    const touched = truffles.gets;
    const r = await state(phrase, generateSecret());
    expect(r.status).toBe(429);
    const body = (await r.json()) as { error: string; retry_after_s: number };
    expect(body.retry_after_s).toBeGreaterThan(0);
    expect(body.retry_after_s).toBeLessThanOrEqual(60);
    expect(truffles.gets).toBe(touched);
    // Missing secrets and the right secret wait too, from this address only.
    expect((await state(phrase, null)).status).toBe(429);
    expect((await state(phrase, secret)).status).toBe(429);
    expect(truffles.gets).toBe(touched);
    expect((await state(phrase, generateSecret(), "198.51.100.9")).status).toBe(401);
    advance(60_000);
    expect((await state(phrase, secret)).status).toBe(200);
  });

  it("missing secrets count as failed lookups", async () => {
    for (let i = 0; i < AUTH_FAILS_PER_MINUTE; i++) expect((await state(phrase, null)).status).toBe(401);
    expect((await state(phrase, secret)).status).toBe(429);
  });

  it("successful lookups do not count", async () => {
    for (let i = 0; i < AUTH_FAILS_PER_MINUTE + 5; i++) expect((await state(phrase, secret)).status).toBe(200);
    expect((await state(phrase, generateSecret())).status).toBe(401);
  });

  it("other owner routes share the limit", async () => {
    for (let i = 0; i < AUTH_FAILS_PER_MINUTE; i++) {
      const r = await app.fetch(
        new Request("http://truffle.test/chat", {
          method: "POST",
          headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7", "x-truffle-secret": generateSecret() },
          body: JSON.stringify({ phrase, message: "hi" })
        }),
        env
      );
      expect(r.status).toBe(401);
    }
    expect((await state(phrase, secret)).status).toBe(429);
  });
});

describe("auth limiter: reserve before the lookup, keyed by IP and phrase", () => {
  it("a concurrent burst of wrong secrets cannot reach the Truffle more than the limit allows", async () => {
    const burst = await Promise.all(Array.from({ length: 100 }, () => state(phrase, generateSecret())));
    const codes = burst.map((r) => r.status);
    expect(codes.filter((s) => s === 401).length).toBe(AUTH_FAILS_PER_MINUTE);
    expect(codes.filter((s) => s === 429).length).toBe(100 - AUTH_FAILS_PER_MINUTE);
    expect(truffles.gets).toBeLessThanOrEqual(AUTH_FAILS_PER_MINUTE);
  });

  it("a lockout on one phrase does not lock other phrases from the same address", async () => {
    for (let i = 0; i < AUTH_FAILS_PER_MINUTE; i++) expect((await state(phrase, generateSecret())).status).toBe(401);
    expect((await state(phrase, secret)).status).toBe(429);
    const other = generatePhrase();
    expect((await state(other, generateSecret())).status).toBe(401);
  });

  it("successful lookups give the reserved try back, so an owner never spends the budget", async () => {
    for (let i = 0; i < AUTH_FAILS_PER_MINUTE - 1; i++) expect((await state(phrase, generateSecret())).status).toBe(401);
    for (let i = 0; i < 10; i++) expect((await state(phrase, secret)).status).toBe(200);
    expect((await state(phrase, generateSecret())).status).toBe(401);
    expect((await state(phrase, generateSecret())).status).toBe(429);
  });
});
