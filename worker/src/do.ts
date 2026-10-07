// TruffleDO: one Durable Object per Truffle. SQLite storage, one alarm.
// Thin on purpose: the engine decides every rule, this file stores, schedules,
// fetches weather and calls the brain.

import { DurableObject } from "cloudflare:workers";
import { MAX_MEMORY_FACTS, TIERS, type Tier } from "./config";
import * as engine from "./engine";
import type { TruffleState } from "./engine";
import { askBrain, extractFacts, type BrainName, type ChatMessage } from "./brain";
import { buildSystemPrompt, sleepyLine, type Fact } from "./prompt";
import { CHAT_LIMIT_PER_HOUR, CHAT_LOCK_MS, checkRate, plausibleTotal } from "./ratelimit";
import { hashSecret, safeEqual } from "./pairing";
import { daysBetween, isValidTimeZone, localDayKey, missedMidnights, nextLocalMidnight } from "./time";
import type { Env, FeedSummary, Lang, Meta, PairInput, Result, StateSummary } from "./types";
import { daytimeMax, fetchForecast, forecastDays, parseForecast, weatherText } from "./weather";

export const DEMO_TTL_MS = 24 * 3_600_000;
const WEATHER_NOW_TTL_MS = 30 * 60_000;
const MAX_LOG_ROWS = 200;
const MAX_TURNS = 20;
const CONTEXT_TURNS = 6;

export interface FeedInput {
  total: number;
  lat?: number;
  lon?: number;
  device_tz?: string;
  day?: string;
}

const err = (status: 400 | 401 | 404 | 409 | 429, error: string) => ({ ok: false, status, error }) as const;
const ok = <T>(value: T) => ({ ok: true, value }) as const;

export class TruffleDO extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK (id = 1), engine TEXT NOT NULL, meta TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS facts (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, day_written TEXT NOT NULL, affection INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS turns (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, day TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL);
    `);
  }

  // ---------- storage helpers ----------

  private load(): { s: TruffleState; m: Meta } | null {
    const rows = this.sql.exec<{ engine: string; meta: string }>("SELECT engine, meta FROM state WHERE id = 1").toArray();
    if (!rows.length) return null;
    return { s: JSON.parse(rows[0].engine), m: JSON.parse(rows[0].meta) };
  }

  private save(s: TruffleState, m: Meta): void {
    this.sql.exec(
      "INSERT INTO state (id, engine, meta) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET engine = excluded.engine, meta = excluded.meta",
      JSON.stringify(s),
      JSON.stringify(m)
    );
  }

  private log(kind: string, detail: unknown): void {
    this.sql.exec("INSERT INTO log (ts, kind, detail) VALUES (?, ?, ?)", Date.now(), kind, JSON.stringify(detail));
    this.sql.exec(`DELETE FROM log WHERE id NOT IN (SELECT id FROM log ORDER BY id DESC LIMIT ${MAX_LOG_ROWS})`);
  }

  private facts(): Fact[] {
    return this.sql
      .exec<{ text: string; day_written: string }>("SELECT text, day_written FROM facts ORDER BY id")
      .toArray();
  }

  /** Highest-affection fact, newest wins ties. Goes on the gravestone. */
  private favouriteMemory(): string | null {
    const r = this.sql.exec<{ text: string }>("SELECT text FROM facts ORDER BY affection DESC, id DESC LIMIT 1").toArray();
    return r.length ? r[0].text : null;
  }

  private addFacts(texts: string[], day: string, affection: number): void {
    for (const t of texts) {
      const dup = this.sql.exec("SELECT 1 FROM facts WHERE lower(text) = lower(?)", t).toArray();
      if (!dup.length) this.sql.exec("INSERT INTO facts (text, day_written, affection) VALUES (?, ?, ?)", t, day, affection);
    }
    this.sql.exec(`DELETE FROM facts WHERE id NOT IN (SELECT id FROM facts ORDER BY id DESC LIMIT ${MAX_MEMORY_FACTS})`);
  }

  private wipeMemory(): void {
    this.sql.exec("DELETE FROM facts");
    this.sql.exec("DELETE FROM turns");
  }

  private async checkSecret(m: Meta, secret: string | null): Promise<boolean> {
    if (secret === null) return true; // route does not need it (/feed)
    return safeEqual(await hashSecret(secret), m.secret_hash);
  }

  // ---------- time and weather ----------

  /** Run every local midnight missed since the last tick. Idempotent per day key. */
  private catchUp(s: TruffleState, m: Meta, now: number): { s: TruffleState; ticks: number } {
    if (m.demo) return { s, ticks: 0 };
    let ticks = 0;
    for (const mid of missedMidnights(m.last_tick_ms, now, m.tz, 14)) {
      m.last_tick_ms = mid;
      const key = localDayKey(mid, m.tz);
      if (key <= m.last_midnight_key) {
        // Day already processed. With tz pinned at /pair this should not
        // happen; if it does, never burn twice, but restart today's steps.
        if (s.steps_today !== 0) s = { ...s, steps_today: 0 };
        this.log("midnight_skipped", { day: key, tz: m.tz });
        continue;
      }
      // The day being entered uses its own cached forecast, never today's. Missing = false.
      const max = m.weather_days[key];
      const burrowTomorrow = typeof max === "number" ? engine.shouldBurrow(max) : false;
      if (typeof max !== "number") this.log("catchup_weather_missing", { day: key, tz: m.tz });
      const wasDead = s.dead;
      s = engine.midnight(s, burrowTomorrow, this.favouriteMemory());
      if (!wasDead && s.dead) this.wipeMemory();
      m.last_midnight_key = key;
      ticks++;
      this.log("midnight", { day: key, burrowed: burrowTomorrow, energy: s.energy, zero_days: s.zero_days, dead: s.dead });
    }
    // Keep only recent weather days.
    const today = localDayKey(now, m.tz);
    for (const d of Object.keys(m.weather_days)) if (daysBetween(d, today) > 2) delete m.weather_days[d];
    return { s, ticks };
  }

  /**
   * Fetch Open-Meteo if the stored cache is stale. Works on the STORED row and
   * re-reads it after the fetch: other requests (a /feed) can run while we
   * await the network, and their writes must not be lost. Returns the fresh
   * row, or null if there is no Truffle or the fetch failed.
   */
  private async refreshWeather(now: number, force = false): Promise<{ s: TruffleState; m: Meta } | null> {
    const before = this.load();
    if (!before) return null;
    const w = before.m.weather_now;
    if (!force && w && now - w.fetched_ms < WEATHER_NOW_TTL_MS) return before;
    const json = await fetchForecast(before.m.lat, before.m.lon);
    const row = this.load();
    if (!row) return null;
    if (json === null) {
      this.log("weather", { ok: false });
      return null;
    }
    for (const day of forecastDays(json)) {
      const max = daytimeMax(json, day);
      if (max !== null) row.m.weather_days[day] = max;
    }
    row.m.weather_now = { ...parseForecast(json, localDayKey(now, row.m.tz)), fetched_ms: now };
    this.save(row.s, row.m);
    return row;
  }

  /** The local midnight that started the current day (at or before now). */
  private lastLocalMidnight(now: number, tz: string): number {
    const mids = missedMidnights(now - 2 * 86_400_000, now, tz, 4);
    return mids.length ? mids[mids.length - 1] : now - 86_400_000;
  }

  private burrowToday(m: Meta, now: number): boolean | null {
    const max = m.weather_days[localDayKey(now, m.tz)];
    return typeof max === "number" ? engine.shouldBurrow(max) : null;
  }

  private async schedule(m: Meta, now: number): Promise<void> {
    await this.ctx.storage.setAlarm(m.demo ? m.created_ms + DEMO_TTL_MS : nextLocalMidnight(now, m.tz));
  }

  private summary(s: TruffleState, m: Meta, now: number): StateSummary {
    const { energy_max } = engine.stageConfig(s.stage);
    const w = m.weather_now;
    return {
      state: s,
      mood: engine.moodOf(s),
      tier: engine.decideTier(s).tier,
      energy_max,
      energy_pct: Math.round((100 * s.energy) / energy_max),
      tz: m.tz,
      country: m.country,
      lang: m.lang,
      city: m.city,
      demo: m.demo,
      local_day: localDayKey(now, m.tz),
      next_midnight_ms: m.demo ? null : nextLocalMidnight(now, m.tz),
      weather: w
        ? {
            text: weatherText(w, m.city),
            apparent_c: w.current_apparent_c,
            daytime_max_c: m.weather_days[localDayKey(now, m.tz)] ?? w.daytime_max_c,
            precipitation_mm: w.precipitation_mm,
            wind_kmh: w.wind_kmh,
            is_day: w.is_day,
            weather_code: w.weather_code
          }
        : null,
      ...(m.demo ? { expires_ms: m.created_ms + DEMO_TTL_MS } : {})
    };
  }

  /** Load, check the secret, catch up on missed midnights. */
  private async open(secret: string | null, now: number) {
    const row = this.load();
    if (!row) return err(404, "no truffle with that phrase");
    if (!(await this.checkSecret(row.m, secret))) return err(401, "wrong secret");
    const { s } = this.catchUp(row.s, row.m, now);
    return ok({ s, m: row.m });
  }

  // ---------- RPC methods ----------

  async pair(input: PairInput): Promise<Result<StateSummary>> {
    const now = Date.now();
    if (this.load()) return err(409, "phrase taken");
    const m: Meta = {
      ...input,
      created_ms: now,
      last_tick_ms: now,
      last_midnight_key: localDayKey(now, input.tz),
      weather_days: {},
      weather_now: null,
      feed_window: { start_ms: now, count: 0 }
    };
    this.save(structuredClone(engine.DEFAULT_STATE), m);
    await this.schedule(m, now);
    await this.refreshWeather(now, true);
    const row = this.load()!;
    if (!row.m.demo) row.s = { ...row.s, burrowed: this.burrowToday(row.m, now) ?? false };
    this.save(row.s, row.m);
    this.log("pair", { demo: row.m.demo, tz: row.m.tz, country: row.m.country, burrowed: row.s.burrowed });
    return ok(this.summary(row.s, row.m, now));
  }

  async getState(secret: string): Promise<Result<StateSummary>> {
    const now = Date.now();
    const o = await this.open(secret, now);
    if (!o.ok) return o;
    this.save(o.value.s, o.value.m); // persist any catch-up before awaiting the network
    const row = (await this.refreshWeather(now)) ?? this.load()!;
    return ok(this.summary(row.s, row.m, now));
  }

  /** Reduced view for the phrase-only /feed: no facts, gravestones, history or meta. */
  private feedSummary(s: TruffleState): FeedSummary {
    return {
      energy: s.energy,
      energy_max: engine.stageConfig(s.stage).energy_max,
      stage: s.stage,
      mood: engine.moodOf(s),
      tier: engine.decideTier(s).tier,
      steps_today: s.steps_today,
      burrowed: s.burrowed
    };
  }

  async feed(
    input: FeedInput
  ): Promise<Result<FeedSummary & { ignored?: string; expected_day: string; active_tz: string }>> {
    const now = Date.now();
    const o = await this.open(null, now);
    if (!o.ok) return o;
    let { s } = o.value;
    const { m } = o.value;
    const rate = checkRate(m.feed_window, now);
    m.feed_window = rate.window;
    if (!rate.allowed) {
      this.save(s, m);
      return err(429, `rate limit: 60 feeds per hour, retry in ${rate.retry_after_s}s`);
    }
    // The timezone is pinned at /pair (S10-03). device_tz is recorded for
    // display and logs only. It never moves the midnight alarm.
    if (input.device_tz !== undefined && !isValidTimeZone(input.device_tz)) {
      this.log("tz_invalid", { value: String(input.device_tz).slice(0, 64) });
    } else if (input.device_tz && input.device_tz !== m.device_tz) {
      this.log("device_tz", { from: m.device_tz ?? null, to: input.device_tz, active_tz: m.tz });
      m.device_tz = input.device_tz;
    }
    if (input.lat !== undefined || input.lon !== undefined) {
      const valid =
        typeof input.lat === "number" && typeof input.lon === "number" &&
        Number.isFinite(input.lat) && Number.isFinite(input.lon) &&
        input.lat >= -90 && input.lat <= 90 && input.lon >= -180 && input.lon <= 180;
      if (!valid) {
        this.log("coords_invalid", { lat: String(input.lat).slice(0, 20), lon: String(input.lon).slice(0, 20) });
      } else {
        // Store one coarse point only (2 decimals, about 1 km). No trail.
        const lat = Math.round(input.lat! * 100) / 100;
        const lon = Math.round(input.lon! * 100) / 100;
        if (lat !== m.lat || lon !== m.lon) {
          // Logged so burrow spoofing via /feed (phrase only) is visible.
          this.log("coords", { from: [m.lat, m.lon], to: [lat, lon] });
          m.lat = lat;
          m.lon = lon;
          m.city = ""; // request.cf city no longer matches the point
          m.weather_now = null;
        }
      }
    }
    // S10-02: a total only counts for the Truffle's current local day.
    const today = localDayKey(now, m.tz);
    const envelope = { expected_day: today, active_tz: m.tz };
    const ignore = (why: string) => {
      this.save(s, m);
      this.log("feed_ignored", { why, day: input.day ?? null, total: input.total });
      return ok({ ...this.feedSummary(s), ...envelope, ignored: why });
    };
    if (input.day !== undefined && input.day !== today) {
      return ignore(input.day < today ? `day ${input.day} is already closed` : `day ${input.day} has not started here yet`);
    }
    // Without a day label, a replay of yesterday's total right after midnight
    // is caught by a walking-speed cap since local midnight.
    if (input.day === undefined && !m.demo && !plausibleTotal(input.total, now - this.lastLocalMidnight(now, m.tz))) {
      return ignore("total is too high for the time since local midnight; send the day field");
    }
    const before = s.steps_today;
    s = engine.feed(s, input.total);
    this.save(s, m);
    this.log("feed", { total: input.total, delta: Math.max(0, s.steps_today - before), energy: s.energy });
    return ok({ ...this.feedSummary(s), ...envelope });
  }

  async spore(secret: string): Promise<Result<StateSummary>> {
    const now = Date.now();
    const o = await this.open(secret, now);
    if (!o.ok) return o;
    const { s, m } = o.value;
    if (!s.dead) return err(409, "truffle is alive");
    let next = engine.newSpore(s);
    if (!m.demo) next = { ...next, burrowed: this.burrowToday(m, now) ?? false };
    this.wipeMemory();
    this.save(next, m);
    this.log("spore", { gravestones: next.gravestones.length });
    return ok(this.summary(next, m, now));
  }

  /**
   * One chat turn as an SSE byte stream:
   *   event: brain  {brain, half_awake}       once the brain answers
   *   event: token  {t}                        visible text deltas
   *   event: done   {tier, brain, half_awake, spent, summary}
   *   event: error  {error}                    nothing is charged
   */
  async chat(
    secret: string,
    message: string,
    requested: Tier | undefined,
    langIn: Lang | undefined
  ): Promise<Result<ReadableStream<Uint8Array>>> {
    const now = Date.now();
    const o = await this.open(secret, now);
    if (!o.ok) return o;
    const { s, m } = o.value;
    if (s.dead) return err(409, "truffle is dead; POST /spore to plant a new one");
    // S10-04: one chat in flight per Truffle, and a per-Truffle hourly cap
    // (real and demo alike). Both are checked before any model call.
    if ((m.chat_lock_until ?? 0) > now) {
      return err(429, "Truffle is still answering your last message. One at a time, please.");
    }
    const rate = checkRate(m.chat_window, now, CHAT_LIMIT_PER_HOUR);
    m.chat_window = rate.window;
    if (!rate.allowed) {
      this.save(s, m);
      return err(429, `Truffle needs a break: ${CHAT_LIMIT_PER_HOUR} messages per hour. Try again in ${Math.ceil(rate.retry_after_s / 60)} min.`);
    }
    m.chat_lock_until = now + CHAT_LOCK_MS;
    if (langIn && langIn !== m.lang) m.lang = langIn;
    this.save(s, m);

    const lang = m.lang;
    const decision = engine.decideTier(s, requested);
    const today = localDayKey(now, m.tz);
    const enc = new TextEncoder();
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    // A client that hangs up must not stop the charge for a reply that was
    // produced, so writes never throw.
    const send = (event: string, data: unknown) =>
      writer.write(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)).catch(() => {});

    // The only place a chat is charged. Runs at most once per chat.
    let charged = false;
    const finish = async (reply: string, brain: BrainName | "none", half_awake: boolean, partial = false) => {
      if (charged) return;
      charged = true;
      // Re-read: a /feed may have landed while the brain was talking.
      const cur = this.load()!;
      const after = engine.chargeChat(cur.s, decision);
      this.save(after, cur.m);
      this.sql.exec("INSERT INTO turns (ts, day, role, content) VALUES (?, ?, 'user', ?)", now, today, message);
      this.sql.exec("INSERT INTO turns (ts, day, role, content) VALUES (?, ?, 'assistant', ?)", Date.now(), today, reply);
      this.sql.exec(`DELETE FROM turns WHERE id NOT IN (SELECT id FROM turns ORDER BY id DESC LIMIT ${MAX_TURNS})`);
      this.log("chat", { tier: decision.tier, brain, half_awake, spent: decision.cost, chars: reply.length, partial });
      await send("done", {
        tier: decision.tier,
        brain,
        half_awake,
        partial,
        spent: decision.cost,
        summary: this.summary(after, cur.m, Date.now())
      });
    };

    let reply = "";
    let brainUsed: BrainName = "workers-ai";
    let halfAwake = true;
    const run = async () => {
      try {
        if (!decision.model_call) {
          const line = sleepyLine(message, lang);
          await send("brain", { brain: "none", half_awake: false });
          await send("token", { t: line });
          await finish(line, "none", false);
          return;
        }
        const weather = m.weather_now ? weatherText(m.weather_now, m.city) : weatherText(null, m.city);
        const system = buildSystemPrompt({
          stateBlock: engine.stateBlock(s, { lang, weather_text: weather }),
          facts: this.facts(),
          lang,
          tier: decision.tier,
          today
        });
        const res = await askBrain(this.env, {
          system,
          messages: [...this.recentTurns(decision.tier, today), { role: "user", content: message }],
          tier: decision.tier,
          thinking: decision.thinking,
          maxTokens: decision.max_tokens,
          lang
        });
        if (res.fallback_reason) this.log("brain_fallback", { reason: res.fallback_reason });
        brainUsed = res.brain;
        halfAwake = res.half_awake;
        await send("brain", { brain: res.brain, half_awake: res.half_awake });
        const reader = res.stream.getReader();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          reply += value;
          await send("token", { t: value });
        }
        await finish(reply, res.brain, res.half_awake);
        if (decision.tier === "medium" || decision.tier === "high") {
          this.ctx.waitUntil(this.rememberFrom(message, reply, today));
        }
      } catch (e) {
        this.log("chat_error", { error: e instanceof Error ? e.message : String(e), chars: reply.length });
        if (reply.length > 0) {
          // Failed mid-reply: the words were produced, so charge once and say it was cut short.
          await finish(reply, brainUsed, halfAwake, true).catch(() => {});
        } else {
          await send("error", { error: "Truffle could not answer right now. Nothing was charged." });
        }
      } finally {
        const cur = this.load();
        if (cur) this.save(cur.s, { ...cur.m, chat_lock_until: 0 });
        await writer.close().catch(() => {});
      }
    };
    this.ctx.waitUntil(run());
    return ok(readable);
  }

  /** Last few turns inside the tier's memory window, for conversational context. */
  private recentTurns(tier: Tier, today: string): ChatMessage[] {
    const days = TIERS[tier].memory_days;
    const rows = this.sql
      .exec<{ day: string; role: string; content: string }>(
        `SELECT day, role, content FROM turns ORDER BY id DESC LIMIT ${CONTEXT_TURNS}`
      )
      .toArray()
      .reverse();
    return rows
      .filter((r) => days === null || daysBetween(r.day, today) < days)
      .map((r) => ({ role: r.role === "assistant" ? "assistant" : "user", content: r.content }));
  }

  private async rememberFrom(message: string, reply: string, today: string): Promise<void> {
    const facts = await extractFacts(this.env, `human: ${message}\ntruffle: ${reply}`);
    if (!facts.length) return;
    const row = this.load();
    if (!row || row.s.dead) return;
    this.addFacts(facts, today, row.s.affection);
    this.log("facts", { added: facts.length });
  }

  // ---------- demo controls (demo Truffles only) ----------

  private async openDemo(secret: string, now: number) {
    const o = await this.open(secret, now);
    if (o.ok && !o.value.m.demo) return err(409, "not a demo truffle");
    return o;
  }

  /** Steps slider: feeds the absolute total for today. */
  async setSteps(secret: string, total: number): Promise<Result<StateSummary>> {
    const now = Date.now();
    const o = await this.openDemo(secret, now);
    if (!o.ok) return o;
    const s = engine.feed(o.value.s, total);
    this.save(s, o.value.m);
    this.log("demo_steps", { total });
    return ok(this.summary(s, o.value.m, now));
  }

  /** Time travel: one midnight now. The new day is not burrowed unless heat is toggled. */
  async forceMidnight(secret: string): Promise<Result<StateSummary>> {
    const now = Date.now();
    const o = await this.openDemo(secret, now);
    if (!o.ok) return o;
    const wasDead = o.value.s.dead;
    const s = engine.midnight(o.value.s, false, this.favouriteMemory());
    if (!wasDead && s.dead) this.wipeMemory();
    this.save(s, o.value.m);
    this.log("demo_midnight", { energy: s.energy, zero_days: s.zero_days, dead: s.dead });
    return ok(this.summary(s, o.value.m, now));
  }

  /** Heat toggle: today is (or is not) a burrowed day. */
  async setHeat(secret: string, on: boolean): Promise<Result<StateSummary>> {
    const now = Date.now();
    const o = await this.openDemo(secret, now);
    if (!o.ok) return o;
    const s = { ...o.value.s, burrowed: on };
    this.save(s, o.value.m);
    this.log("demo_heat", { on });
    return ok(this.summary(s, o.value.m, now));
  }

  async reset(secret: string): Promise<Result<StateSummary>> {
    const now = Date.now();
    const o = await this.openDemo(secret, now);
    if (!o.ok) return o;
    const s = structuredClone(engine.DEFAULT_STATE);
    this.wipeMemory();
    this.save(s, o.value.m);
    this.log("demo_reset", {});
    return ok(this.summary(s, o.value.m, now));
  }

  // ---------- alarm ----------

  async alarm(): Promise<void> {
    const now = Date.now();
    const row = this.load();
    if (!row) return;
    let { s } = row;
    const { m } = row;
    if (m.demo) {
      if (now >= m.created_ms + DEMO_TTL_MS) {
        await this.ctx.storage.deleteAlarm();
        await this.ctx.storage.deleteAll();
      } else {
        await this.schedule(m, now);
      }
      return;
    }
    try {
      const r = this.catchUp(s, m, now);
      s = r.s;
      this.save(s, m); // ticks are committed before any network await
      // More than 14 midnights missed: keep the debt, come back in a second.
      if (nextLocalMidnight(m.last_tick_ms, m.tz) <= now) {
        await this.ctx.storage.setAlarm(now + 1000);
        return;
      }
      if (r.ticks > 0) {
        const fresh = await this.refreshWeather(now, true);
        if (fresh) {
          // Fresh forecast for the new day overrides the cached guess.
          const b = this.burrowToday(fresh.m, now);
          if (b !== null && !fresh.s.dead && b !== fresh.s.burrowed) {
            this.save({ ...fresh.s, burrowed: b }, fresh.m);
          }
        }
      }
      await this.schedule(this.load()!.m, Date.now());
    } catch (e) {
      console.error("midnight_alarm_failed", e);
      await this.ctx.storage.setAlarm(Date.now() + 60_000);
    }
  }
}
