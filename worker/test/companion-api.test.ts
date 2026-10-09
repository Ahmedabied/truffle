import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { generatePhrase, generateSecret, hashPhrase, hashSecret } from "../src/pairing";
import type { Env } from "../src/types";
import { FakeFetch, makeLimiter, makeObject, namespace, useClock } from "./helpers/do-harness";

let env: Env;
let truffles: ReturnType<typeof namespace<ReturnType<typeof makeObject>["obj"]>>;
let limiters: ReturnType<typeof namespace<ReturnType<typeof makeLimiter>>>;
let phrase: string;
let secret: string;

beforeEach(async () => {
  useClock("2026-10-10T08:00:00Z");
  new FakeFetch().install();
  truffles = namespace(() => makeObject().obj);
  limiters = namespace(() => makeLimiter());
  env = { TRUFFLE: truffles, LIMITER: limiters, AI: {} } as unknown as Env;
  phrase = generatePhrase();
  secret = generateSecret();
  const stub = env.TRUFFLE.get(env.TRUFFLE.idFromName(await hashPhrase(phrase)));
  expect((await stub.pair({
    tz: "Asia/Muscat", country: "OM", lang: "en", lat: 23.59, lon: 58.41, city: "Muscat",
    demo: false, secret_hash: await hashSecret(secret)
  })).ok).toBe(true);
  truffles.gets = 0;
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function request(fields: Record<string, unknown> = {}, credential: string | null = secret) {
  const headers: Record<string, string> = { "content-type": "application/json", "cf-connecting-ip": "203.0.113.20" };
  if (credential !== null) headers["x-truffle-secret"] = credential;
  return app.fetch(new Request("http://truffle.test/companion", {
    method: "POST", headers,
    body: JSON.stringify({ phrase, action: "away", generation: 0, client_request_id: "test-outing", ...fields })
  }), env);
}

describe("owner companion API", () => {
  it.each([
    { action: "hide" }, { action: null }, { action: 1 },
    { generation: undefined }, { generation: -1 }, { generation: 0.5 },
    { generation: "0" }, { generation: Number.MAX_SAFE_INTEGER + 1 },
    { intent: "exercise" }, { intent: null },
    { client_request_id: "" }, { client_request_id: "a".repeat(129) },
    { client_request_id: "a\nb" }, { client_request_id: {} },
    { job_id: "" }, { job_id: "a".repeat(129) }, { job_id: "<job>" }
  ])("rejects malformed fields before any object or auth limiter lookup: %j", async (fields) => {
    const response = await request(fields);
    expect(response.status).toBe(400);
    expect(truffles.gets).toBe(0);
    expect(limiters.gets).toBe(0);
  });

  it("rejects an oversized body before an object lookup", async () => {
    expect((await request({ client_request_id: "x".repeat(9000) })).status).toBe(400);
    expect(truffles.gets).toBe(0);
    expect(limiters.gets).toBe(0);
  });

  it("missing, wrong, unknown and expired ownership have the same 401 bytes", async () => {
    let unknown = generatePhrase();
    while (unknown === phrase) unknown = generatePhrase();
    const replies = [await request({}, null), await request({}, generateSecret()), await request({ phrase: unknown }, generateSecret())];
    const obj = truffles.objects.get(await hashPhrase(phrase))!;
    const priv = obj as unknown as ReturnType<typeof makeObject>["priv"];
    const row = priv.load()!;
    row.m.demo = true;
    row.m.created_ms -= 86_400_000;
    priv.save(row.s, row.m);
    replies.push(await request());
    expect(replies.map(r => r.status)).toEqual([401, 401, 401, 401]);
    const bodies = await Promise.all(replies.map(r => r.text()));
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0])).toEqual({ error: "That phrase and secret do not match a Truffle." });
    const unknownObject = truffles.objects.get(await hashPhrase(unknown))! as unknown as {
      sql: { exec(query: string): { toArray(): unknown[] } }
    };
    expect(unknownObject.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table'").toArray()).toEqual([]);
  });

  it("the owner can schedule, read and cancel; forged generation cannot mutate the job", async () => {
    const response = await request({ intent: "walk" });
    expect(response.status).toBe(200);
    const scheduled = await response.json() as { generation: number; companion: { pending: { id: string; intent: string }; gifts: unknown[] } };
    expect(scheduled.generation).toBe(0);
    expect(scheduled.companion.pending.intent).toBe("walk");
    expect(scheduled.companion.gifts).toEqual([]);
    expect((await request({ action: "cancel", generation: 1 })).status).toBe(409);
    const read = await app.fetch(new Request(`http://truffle.test/state?phrase=${phrase}`, { headers: { "x-truffle-secret": secret } }), env);
    expect((await read.json() as typeof scheduled).companion.pending.id).toBe(scheduled.companion.pending.id);
    const cancelled = await request({ action: "return", job_id: scheduled.companion.pending.id });
    expect(cancelled.status).toBe(200);
    expect((await cancelled.json() as typeof scheduled).companion.pending).toBeNull();
  });

  it("another owner's valid secret cannot access or cancel this owner's job", async () => {
    expect((await request()).status).toBe(200);
    const otherPhrase = generatePhrase();
    const otherSecret = generateSecret();
    const other = env.TRUFFLE.get(env.TRUFFLE.idFromName(await hashPhrase(otherPhrase)));
    await other.pair({ tz: "UTC", country: "", lang: "en", lat: 0, lon: 0, city: "", demo: false, secret_hash: await hashSecret(otherSecret) });
    expect((await request({ action: "cancel" }, otherSecret)).status).toBe(401);
    const read = await request();
    expect(read.status).toBe(200);
    expect((await read.json() as { companion: { pending: unknown } }).companion.pending).not.toBeNull();
  });

  it("failed lookups share the auth limit and stop before object access", async () => {
    for (let i = 0; i < 30; i++) expect((await request({}, generateSecret())).status).toBe(401);
    const count = truffles.gets;
    expect((await request()).status).toBe(429);
    expect(truffles.gets).toBe(count);
  });

  it("successful retries return auth reservations and do not consume new outing slots", async () => {
    for (let i = 0; i < 35; i++) expect((await request()).status).toBe(200);
    const obj = truffles.objects.get(await hashPhrase(phrase))! as unknown as ReturnType<typeof makeObject>["priv"];
    expect(obj.load()!.m.companion?.rate?.count).toBe(1);
  });
});
