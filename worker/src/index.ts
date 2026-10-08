// Truffle Worker: routes. Every rule lives in the engine, every Truffle in its
// own Durable Object. This file validates input and picks the right object.

import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import type { Tier } from "./config";
import { AUTH_FAILED, generatePhrase, generateSecret, hashPhrase, hashSecret, isPlausibleSecret, parsePhrase } from "./pairing";
import { AUTH_FAILS_PER_MINUTE, DAY_MS, DEMO_SPAWNS_PER_DAY, DEMO_SPAWNS_PER_HOUR, HOUR_MS, MINUTE_MS } from "./ratelimit";
import { isValidTimeZone } from "./time";
import type { Env, Lang, PairInput, Result } from "./types";
import { BodyTooLarge, MAX_BODY_BYTES, parseBodyText, parseCoords, parseMessage, readBounded, stepTotalError } from "./validate";
import { sanitizeText } from "./weather";

export { TruffleDO } from "./do";
export { LimiterDO } from "./limiter";

/** Arabic by default for these countries (docs/01, Language). */
export const ARABIC_COUNTRIES = new Set(
  "AE SA OM QA KW BH JO EG IQ LB SY YE PS LY TN DZ MA SD MR SO DJ KM".split(" ")
);

const DEFAULT_GEO = { tz: "Asia/Muscat", country: "OM", lat: 23.59, lon: 58.41, city: "Muscat" };
const TIERS_IN: readonly Tier[] = ["asleep", "low", "medium", "high"];
/** Retry guidance on every rejected request. */
const FIX_AND_RETRY = "Nothing changed. Fix the request and send it again.";
const FEED_RETRY = "Nothing changed. Your steps are still on your phone. Fix the request and sync again.";

type C = Context<{ Bindings: Env }>;
const app = new Hono<{ Bindings: Env }>();

// ---------- CORS ----------

function allowedOrigin(origin: string, env: Env): string | null {
  if (!origin) return null;
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return origin;
    if (u.protocol === "https:" && (u.hostname === "truffle.pages.dev" || u.hostname.endsWith(".truffle.pages.dev"))) {
      return origin;
    }
  } catch {
    return null;
  }
  const extra = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return extra.includes(origin) ? origin : null;
}

app.use("*", (c, next) =>
  cors({
    origin: (origin) => allowedOrigin(origin, c.env),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["content-type", "x-truffle-secret"],
    maxAge: 600
  })(c, next)
);

// ---------- input helpers ----------

const bad = (c: C, error: string, status: 400 | 401 | 404 | 409 | 429 = 400, hint = FIX_AND_RETRY) =>
  c.json(status === 401 ? { error } : { error, hint }, status);

/**
 * The JSON object body, at most 8 KiB (S10-08). Anything else is a 400 with
 * guidance, before any Truffle is touched.
 */
async function body(c: C, hint = FIX_AND_RETRY): Promise<{ b: Record<string, unknown> } | { error: Response }> {
  const declared = Number(c.req.header("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { error: bad(c, `The request body is too large. The limit is ${MAX_BODY_BYTES} bytes.`, 400, hint) };
  }
  // Read at most the cap plus one byte, then stop. A missing or false
  // content-length must not make the Worker buffer an unbounded body.
  let text: string;
  try {
    text = await readBounded(c.req.raw.body, MAX_BODY_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLarge) {
      return { error: bad(c, `The request body is too large. The limit is ${MAX_BODY_BYTES} bytes.`, 400, hint) };
    }
    return { error: bad(c, "The request body could not be read.", 400, hint) };
  }
  const r = parseBodyText(text);
  return r.ok ? { b: r.value } : { error: bad(c, r.error, 400, hint) };
}

function reply<T>(c: C, r: Result<T>) {
  if (r.ok) return c.json(r.value as object);
  const extra = r.retry_after_s !== undefined ? { retry_after_s: r.retry_after_s } : {};
  return c.json({ error: r.error, ...(r.hint ? { hint: r.hint } : {}), ...extra }, r.status);
}

function isNum(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
function isCalendarDay(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(v + "T00:00:00Z");
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
}

function langOf(v: unknown): Lang | undefined {
  return v === "ar" || v === "en" ? v : undefined;
}

function secretOf(c: C, b: Record<string, unknown>): string | null {
  const s = c.req.header("x-truffle-secret") ?? b.secret;
  return isPlausibleSecret(s) ? s : null;
}

async function stubFor(env: Env, phrase: string) {
  return env.TRUFFLE.get(env.TRUFFLE.idFromName(await hashPhrase(phrase)));
}

// S11-05: failed owner lookups (unknown phrase, wrong or missing secret) are
// limited per client IP, 30 a minute. The check runs before any Truffle object
// is touched. Every failure has the same 401 body, but the response time is
// not equal across them, so the limit is what bounds guessing.
const AUTH_FAIL_RULE = { name: "fail", limit: AUTH_FAILS_PER_MINUTE, windowMs: MINUTE_MS };

function authLimiter(c: C) {
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  return c.env.LIMITER.get(c.env.LIMITER.idFromName(`auth:${ip}`));
}

/** Count one failed lookup, then give the uniform 401. */
async function authFailed(c: C) {
  await authLimiter(c).hit([AUTH_FAIL_RULE]);
  return bad(c, AUTH_FAILED, 401);
}

/**
 * Phrase + secret for routes that need ownership. A missing secret gets the
 * same 401 as a wrong one or an unknown phrase (S10-01).
 */
async function owned(c: C, b: Record<string, unknown>) {
  const phrase = parsePhrase(b.phrase ?? c.req.query("phrase"));
  if (!phrase) return { error: bad(c, "phrase must be three words from the list, like sand-moon-fig") };
  const gate = await authLimiter(c).peek([AUTH_FAIL_RULE]);
  if (!gate.allowed) {
    return {
      error: c.json(
        { error: `Too many failed tries from here. Try again in ${gate.retry_after_s} s.`, retry_after_s: gate.retry_after_s },
        429
      )
    };
  }
  const secret = secretOf(c, b);
  if (!secret) return { error: await authFailed(c) };
  return { stub: await stubFor(c.env, phrase), secret };
}

/** reply() for owner routes: a 401 from the Truffle counts as a failed lookup. */
async function ownerReply<T>(c: C, r: Result<T>) {
  if (!r.ok && r.status === 401) return authFailed(c);
  return reply(c, r);
}

/** Defaults from request.cf, guarded for `wrangler dev` where it can be missing. */
function geoDefaults(c: C, b: Record<string, unknown>): Omit<PairInput, "secret_hash" | "demo"> {
  const cf = (c.req.raw as Request & { cf?: IncomingRequestCfProperties }).cf;
  const tz = isValidTimeZone(b.tz) ? b.tz : isValidTimeZone(cf?.timezone) ? cf!.timezone! : DEFAULT_GEO.tz;
  const country =
    typeof cf?.country === "string" && /^[A-Z]{2}$/.test(cf.country) ? cf.country : DEFAULT_GEO.country;
  const lat = Number(cf?.latitude);
  const lon = Number(cf?.longitude);
  const hasPoint = cf?.latitude !== undefined && isNum(lat, -90, 90) && isNum(lon, -180, 180);
  const city = sanitizeText(cf?.city, 32) || (hasPoint ? "" : DEFAULT_GEO.city);
  return {
    tz,
    country,
    lang: langOf(b.lang) ?? (ARABIC_COUNTRIES.has(country) ? "ar" : "en"),
    lat: hasPoint ? Math.round(lat * 100) / 100 : DEFAULT_GEO.lat,
    lon: hasPoint ? Math.round(lon * 100) / 100 : DEFAULT_GEO.lon,
    city
  };
}

async function create(c: C, demo: boolean) {
  const p = await body(c);
  if ("error" in p) return p.error;
  const geo = geoDefaults(c, p.b);
  for (let attempt = 0; attempt < 5; attempt++) {
    const phrase = generatePhrase();
    const secret = generateSecret();
    const r = await (await stubFor(c.env, phrase)).pair({ ...geo, demo, secret_hash: await hashSecret(secret) });
    if (r.ok) return c.json({ phrase, secret, ...r.value });
    if (r.status !== 409) return reply(c, r);
  }
  return bad(c, "could not find a free phrase, try again", 409);
}

// ---------- routes ----------

app.get("/health", (c) => c.json({ ok: true, service: "truffle", modal: Boolean(c.env.MODAL_URL) }));

app.post("/pair", (c) => spawnLimited(c, "pair", false));

// Feed admission (S10-07, S10-08, S10-09). Every check here runs before the
// Truffle is touched. A rejection is a 400 with guidance: never a zero day,
// never a weather or brain call.
app.post("/feed", async (c) => {
  const p = await body(c, FEED_RETRY);
  if ("error" in p) return p.error;
  const b = p.b;
  const no = (error: string) => bad(c, error, 400, FEED_RETRY);
  const phrase = parsePhrase(b.phrase);
  if (!phrase) return no("phrase must be three words from the list, like sand-moon-fig");
  const totalError = stepTotalError(b.steps_today_total);
  if (totalError) return no(totalError);
  const coords = parseCoords(b.lat, b.lon);
  if (!coords.ok) return no(coords.error);
  if (b.device_tz !== undefined && !isValidTimeZone(b.device_tz)) return no("device_tz must be an IANA zone");
  if (b.day !== undefined && !isCalendarDay(b.day)) return no("day must be a real date, YYYY-MM-DD");
  const stub = await stubFor(c.env, phrase);
  return reply(
    c,
    await stub.feed({
      total: b.steps_today_total as number,
      lat: coords.value?.lat,
      lon: coords.value?.lon,
      device_tz: b.device_tz as string | undefined,
      day: b.day as string | undefined
    })
  );
});

app.get("/state", async (c) => {
  const o = await owned(c, {});
  if ("error" in o) return o.error;
  return ownerReply(c, await o.stub.getState(o.secret));
});

app.post("/chat", async (c) => {
  const p = await body(c);
  if ("error" in p) return p.error;
  const b = p.b;
  const msg = parseMessage(b.message);
  if (!msg.ok) return bad(c, msg.error);
  const message = msg.value;
  const o = await owned(c, b);
  if ("error" in o) return o.error;
  if (b.requested_tier !== undefined && !TIERS_IN.includes(b.requested_tier as Tier)) {
    return bad(c, "requested_tier must be asleep, low, medium or high");
  }
  if (b.lang !== undefined && !langOf(b.lang)) return bad(c, "lang must be ar or en");
  const r = await o.stub.chat(o.secret, message, b.requested_tier as Tier | undefined, langOf(b.lang));
  if (!r.ok) return ownerReply(c, r);
  return new Response(r.value, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache"
    }
  });
});

app.post("/spore", async (c) => {
  const p = await body(c);
  if ("error" in p) return p.error;
  const b = p.b;
  const o = await owned(c, b);
  if ("error" in o) return o.error;
  return ownerReply(c, await o.stub.spore(o.secret));
});

// ---------- judge mode ----------
// Demo controls never read a client "demo" field. The Truffle's own stored
// flag decides, checked inside the Durable Object on every call (S10-05).

// S10-05: 5 spawns per hour and 20 per day per client IP for both /pair and
// /demo/spawn, counted before any Truffle object is created. A real person pairs
// once; the limit only stops scripts from allocating objects. Demo Truffles still
// self-delete after 24h.
async function spawnLimited(c: C, kind: "pair" | "demo-spawn", demo: boolean) {
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  const limiter = c.env.LIMITER.get(c.env.LIMITER.idFromName(`${kind}:${ip}`));
  const r = await limiter.hit([
    { name: "hour", limit: DEMO_SPAWNS_PER_HOUR, windowMs: HOUR_MS },
    { name: "day", limit: DEMO_SPAWNS_PER_DAY, windowMs: DAY_MS }
  ]);
  if (!r.allowed) {
    const wait = r.rule === "hour" ? `${Math.ceil(r.retry_after_s / 60)} min` : `${Math.ceil(r.retry_after_s / 3600)} h`;
    const what = demo ? "demo Truffles" : "new Truffles";
    return c.json({ error: `Too many ${what} from here. Try again in ${wait}.` }, 429);
  }
  return create(c, demo);
}

app.post("/demo/spawn", (c) => spawnLimited(c, "demo-spawn", true));

app.post("/demo/slider", async (c) => {
  const p = await body(c);
  if ("error" in p) return p.error;
  const b = p.b;
  const stepsError = stepTotalError(b.steps, "steps");
  if (stepsError) return bad(c, stepsError);
  const o = await owned(c, b);
  if ("error" in o) return o.error;
  return ownerReply(c, await o.stub.setSteps(o.secret, b.steps as number));
});

app.post("/demo/midnight", async (c) => {
  const p = await body(c);
  if ("error" in p) return p.error;
  const b = p.b;
  const o = await owned(c, b);
  if ("error" in o) return o.error;
  return ownerReply(c, await o.stub.forceMidnight(o.secret));
});

app.post("/demo/heat", async (c) => {
  const p = await body(c);
  if ("error" in p) return p.error;
  const b = p.b;
  const o = await owned(c, b);
  if ("error" in o) return o.error;
  if (typeof b.on !== "boolean") return bad(c, "on must be true or false");
  return ownerReply(c, await o.stub.setHeat(o.secret, b.on));
});

app.post("/demo/reset", async (c) => {
  const p = await body(c);
  if ("error" in p) return p.error;
  const b = p.b;
  const o = await owned(c, b);
  if ("error" in o) return o.error;
  return ownerReply(c, await o.stub.reset(o.secret));
});

app.notFound((c) => c.json({ error: "not found" }, 404));
app.onError((e, c) => {
  console.error("unhandled", e);
  return c.json({ error: "internal error" }, 500);
});

export default app;
