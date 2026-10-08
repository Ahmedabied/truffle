// TruffleDO: one Durable Object per Truffle. SQLite storage, one alarm.
// Thin on purpose: the engine decides every rule, this file stores, schedules,
// fetches weather and calls the brain.

import { DurableObject } from "cloudflare:workers";
import { MAX_MEMORY_FACTS, TIERS, type Tier } from "./config";
import * as engine from "./engine";
import type { TruffleState } from "./engine";
import { askBrain, extractFacts, hasVisibleText, type BrainName, type ChatMessage } from "./brain";
import { isInstructionLike, roomForFacts } from "./facts";
import { BlockGuard, heatLine, heatTemp, voiceHits } from "./guards";
import { buildSystemPrompt, sleepyLine, type Fact } from "./prompt";
import {
  CHAT_LIMIT_PER_HOUR,
  CHAT_LOCK_MS,
  checkRate,
  coordRefreshAllowed,
  DAY_MS,
  DEMO_REPLIES_PER_DAY,
  feedBaseline,
  jumpCheck,
  MAX_JUMP_STEPS_PER_SECOND,
  nextWeatherBackoff,
  unreserve
} from "./ratelimit";
import { markToday, momentsFor, nextStreak, pushMoments, trailingStreak } from "./moments";
import { AUTH_FAILED, ownerMatches } from "./pairing";
import { daysBetween, isValidTimeZone, localDayKey, missedMidnights, nextLocalMidnight } from "./time";
import type { ChatTicket, Env, FeedSummary, Lang, Meta, PairInput, Result, StateSummary } from "./types";
import { isCalendarDay } from "./validate";
import { daytimeMax, fetchForecast, forecastDays, parseForecast, stateWeather } from "./weather";

export const DEMO_TTL_MS = 24 * 3_600_000;
const WEATHER_NOW_TTL_MS = 30 * 60_000;
const MAX_LOG_ROWS = 200;
const MAX_TURNS = 20;
const CONTEXT_TURNS = 6;
const NOT_CHARGED = "Truffle could not answer right now. Nothing was charged.";
const FENCED = "Truffle lost the thread of that reply. Nothing was charged.";

type Row = { s: TruffleState; m: Meta };

export interface FeedInput {
  total: number;
  lat?: number;
  lon?: number;
  device_tz?: string;
  day?: string;
  day_tz?: string;
}

const err = (status: 400 | 401 | 404 | 409 | 429, error: string, retry_after_s?: number) =>
  ({ ok: false, status, error, ...(retry_after_s !== undefined ? { retry_after_s } : {}) }) as const;
const ok = <T>(value: T) => ({ ok: true, value }) as const;

export class TruffleDO extends DurableObject<Env> {
  private sql: SqlStorage;

  private hasSchema = false;
  /** Abort handles for admitted chats, by ticket id (S11-01). In memory only. */
  private inflight = new Map<string, AbortController>();
  /** The one forecast fetch in flight, for one coordinate revision (S11-11). */
  private weatherFlight: { rev: number; p: Promise<Row | null> } | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    // No writes here. A guessed phrase reaches an object with no tables and
    // leaves it that way: nothing is stored for an unknown phrase (S10-01).
  }

  // ---------- storage helpers ----------

  /** Tables are created only when a Truffle is paired. */
  private ensureSchema(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK (id = 1), engine TEXT NOT NULL, meta TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS facts (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, day_written TEXT NOT NULL, affection INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS turns (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, day TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL);
    `);
    this.hasSchema = true;
  }

  /** Read only. True once this object holds a Truffle's tables. */
  private schemaExists(): boolean {
    if (!this.hasSchema) {
      this.hasSchema =
        this.sql.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'state'").toArray().length > 0;
    }
    return this.hasSchema;
  }

  private load(): { s: TruffleState; m: Meta } | null {
    if (!this.schemaExists()) return null;
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
    // A demo can expire while a chat is still running: never recreate storage to log.
    if (!this.schemaExists()) return;
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
    const rows = this.sql
      .exec<{ text: string }>("SELECT text FROM facts ORDER BY affection DESC, id DESC")
      .toArray();
    return rows.find((r) => !isInstructionLike(r.text))?.text ?? null;
  }

  /**
   * Store new facts. Rolling memory (docs/01, S11-08): at most 60 are kept, and
   * a new distinct fact pushes out the oldest one. A duplicate is skipped and
   * evicts nothing. Death still clears everything.
   */
  private addFacts(texts: string[], day: string, affection: number): number {
    let added = 0;
    for (const t of texts) {
      const dup = this.sql.exec("SELECT 1 FROM facts WHERE lower(text) = lower(?)", t).toArray();
      if (dup.length) continue;
      const stored = this.sql.exec<{ n: number }>("SELECT count(*) AS n FROM facts").one().n;
      if (roomForFacts(stored) <= 0) {
        this.sql.exec("DELETE FROM facts WHERE id IN (SELECT id FROM facts ORDER BY id LIMIT ?)", stored - MAX_MEMORY_FACTS + 1);
      }
      this.sql.exec("INSERT INTO facts (text, day_written, affection) VALUES (?, ?, ?)", t, day, affection);
      added++;
    }
    return added;
  }

  /**
   * Death, new spore and demo reset: every fact and the whole conversation go.
   * Only the favourite memory survives, on the gravestone. The generation bump
   * fences out any chat or fact extraction still running for the old life.
   */
  private wipeMemory(m: Meta): void {
    this.sql.exec("DELETE FROM facts");
    this.sql.exec("DELETE FROM turns");
    m.generation = (m.generation ?? 0) + 1;
  }

  /** Demo Truffles stop existing after 24 h, even before the alarm runs. */
  private expired(m: Meta, now: number): boolean {
    return m.demo && now >= m.created_ms + DEMO_TTL_MS;
  }

  // ---------- proud moments (decision 0017) ----------

  /** Moments from one feed. Demo slider and real feeds both come through here. */
  private feedMoments(m: Meta, before: TruffleState, after: TruffleState, now: number): void {
    this.keepMoments(m, momentsFor(before, after, this.momentCtx(m, before, "feed", now)));
  }

  /** Moments from one midnight. Also clears the day's once-per-day list and moves the streak. */
  private midnightMoments(m: Meta, before: TruffleState, after: TruffleState, at: number): void {
    if (before.dead) return; // a dead Truffle's midnight changes nothing
    const ctx = this.momentCtx(m, before, "midnight", at);
    this.keepMoments(m, momentsFor(before, after, ctx));
    m.streak_days = nextStreak(ctx.streak_before ?? 0, before.steps_today);
    m.moments_today = [];
  }

  /** New life: the once-per-day list and the streak start over. The ring is kept. */
  private resetMomentDay(m: Meta): void {
    m.moments_today = [];
    m.streak_days = 0;
  }

  private momentCtx(m: Meta, before: TruffleState, event: "feed" | "midnight", now: number) {
    return {
      now_ms: now,
      event,
      next_id: m.next_moment_id ?? 1,
      already_today: m.moments_today ?? [],
      streak_before: m.streak_days ?? trailingStreak(before.history7)
    };
  }

  private keepMoments(m: Meta, fired: ReturnType<typeof momentsFor>): void {
    if (!fired.length) return;
    m.moments = pushMoments(m.moments ?? [], fired);
    m.next_moment_id = fired[fired.length - 1].id + 1;
    m.moments_today = markToday(m.moments_today ?? [], fired);
    this.log("moments", fired.map((x) => ({ kind: x.kind, value: x.value })));
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
      // The new day uses its forecast. An outage preserves the previous heat protection (0019).
      const max = m.weather_days[key];
      const burrowTomorrow = typeof max === "number" ? engine.shouldBurrow(max) : s.burrowed;
      if (typeof max !== "number") this.log("catchup_weather_missing", { day: key, tz: m.tz });
      const wasDead = s.dead;
      const before = s;
      s = engine.midnight(s, burrowTomorrow, this.favouriteMemory());
      this.midnightMoments(m, before, s, mid);
      if (!wasDead && s.dead) this.wipeMemory(m);
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
   * Fetch Open-Meteo if the stored cache is stale (S11-11):
   * - one fetch in flight per object: concurrent callers share it;
   * - after a failure, owner reads wait out a backoff (5 minutes, doubling to
   *   1 hour) and keep the old data; forced refreshes (pairing, midnight) skip it;
   * - a forecast for an older point is discarded if the point moved meanwhile.
   * Works on the STORED row and re-reads it after the fetch: other requests (a
   * /feed) can run while we await the network, and their writes must not be
   * lost. Returns the fresh row, the unchanged row when no fetch is due, or
   * null if there is no Truffle or the fetch failed or was discarded.
   */
  private async refreshWeather(now: number, force = false): Promise<Row | null> {
    const before = this.load();
    if (!before) return null;
    const w = before.m.weather_now;
    if (!force && w && now - w.fetched_ms < WEATHER_NOW_TTL_MS) return before;
    if (!force && (before.m.weather_fail?.until_ms ?? 0) > now) return before;
    const rev = before.m.coords_rev ?? 0;
    if (this.weatherFlight && this.weatherFlight.rev === rev) return this.weatherFlight.p;
    const p: Promise<Row | null> = this.fetchWeather(before.m.lat, before.m.lon, rev, now).finally(() => {
      if (this.weatherFlight?.p === p) this.weatherFlight = null;
    });
    this.weatherFlight = { rev, p };
    return p;
  }

  private async fetchWeather(lat: number, lon: number, rev: number, now: number): Promise<Row | null> {
    const json = await fetchForecast(lat, lon);
    const row = this.load();
    if (!row) return null;
    if ((row.m.coords_rev ?? 0) !== rev) {
      // The point moved while we waited. This forecast is for the old one.
      this.log("weather", { ok: false, discarded: "point moved" });
      return null;
    }
    if (json === null) {
      const backoff_ms = nextWeatherBackoff(row.m.weather_fail?.backoff_ms);
      row.m.weather_fail = { until_ms: now + backoff_ms, backoff_ms };
      this.save(row.s, row.m);
      this.log("weather", { ok: false, backoff_s: backoff_ms / 1000 });
      return null;
    }
    for (const day of forecastDays(json)) {
      const max = daytimeMax(json, day);
      if (max !== null) row.m.weather_days[day] = max;
    }
    row.m.weather_now = { ...parseForecast(json, localDayKey(now, row.m.tz)), fetched_ms: now };
    delete row.m.weather_fail;
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
    const weatherShown = w ? stateWeather(w, m.city, "en") : null; // decision 0012: English in the block
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
            text: weatherShown!,
            apparent_c: w.current_apparent_c,
            daytime_max_c: m.weather_days[localDayKey(now, m.tz)] ?? w.daytime_max_c,
            precipitation_mm: w.precipitation_mm,
            wind_kmh: w.wind_kmh,
            is_day: w.is_day,
            weather_code: w.weather_code
          }
        : null,
      ...(m.demo ? { expires_ms: m.created_ms + DEMO_TTL_MS } : {}),
      moments: m.moments ?? []
    };
  }

  /**
   * Load, check the secret, catch up on missed midnights. With a secret (owner
   * routes), an unknown phrase, an expired demo and a wrong secret all get the
   * same 401 body (S10-01). The response time is not equal across these cases
   * (S11-05), so the route also rate-limits failed lookups per IP. Nothing is
   * written for an unknown phrase and no weather is fetched.
   */
  private async open(secret: string | null, now: number) {
    let row = this.load();
    if (row && this.expired(row.m, now)) row = null;
    if (secret !== null) {
      if (!(await ownerMatches(row?.m.secret_hash, secret)) || !row) return err(401, AUTH_FAILED);
    } else if (!row) {
      return err(404, "no truffle with that phrase");
    }
    const { s } = this.catchUp(row.s, row.m, now);
    return ok({ s, m: row.m });
  }

  // ---------- RPC methods ----------

  async pair(input: PairInput): Promise<Result<StateSummary>> {
    const now = Date.now();
    if (this.load()) return err(409, "phrase taken");
    this.ensureSchema();
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
    if (!isCalendarDay(input.day) || !isValidTimeZone(input.day_tz)) {
      return err(400, "A valid day and day_tz are required. Read steps again for the Truffle's day.");
    }
    const now = Date.now();
    const o = await this.open(null, now);
    if (!o.ok) return o;
    let { s } = o.value;
    const { m } = o.value;
    const rate = checkRate(m.feed_window, now);
    m.feed_window = rate.window;
    if (!rate.allowed) {
      this.save(s, m);
      return err(429, `rate limit: 60 feeds per hour, retry in ${rate.retry_after_s}s`, rate.retry_after_s);
    }
    // Defense in depth: the route already refused these with 400.
    if (!Number.isSafeInteger(input.total) || input.total < 0) {
      this.save(s, m);
      return err(400, "steps_today_total must be a whole number of steps, 0 or more.");
    }
    // The timezone is pinned at /pair (S10-03). device_tz is recorded for
    // display and logs only. It never moves the midnight alarm.
    if (input.device_tz !== undefined && !isValidTimeZone(input.device_tz)) {
      this.log("tz_invalid", { value: String(input.device_tz).slice(0, 64) });
    } else if (input.device_tz && input.device_tz !== m.device_tz) {
      this.log("device_tz", { from: m.device_tz ?? null, to: input.device_tz, active_tz: m.tz });
      m.device_tz = input.device_tz;
    }
    // S10-02: a total only counts for the Truffle's current local day.
    const today = localDayKey(now, m.tz);
    const envelope = { expected_day: today, active_tz: m.tz };
    const ignore = (why: string) => {
      this.save(s, m);
      this.log("feed_ignored", { why, day: input.day ?? null, total: input.total });
      return ok({ ...this.feedSummary(s), ...envelope, ignored: why });
    };
    if (input.day_tz !== m.tz) {
      return ignore("day_tz does not match the Truffle's active zone; read steps again in active_tz");
    }
    if (input.day !== today) {
      return ignore(input.day < today ? `day ${input.day} is already closed` : `day ${input.day} has not started here yet`);
    }
    const midnight = this.lastLocalMidnight(now, m.tz);
    // S10-07: an increase may imply at most 20 steps a second since the last
    // accepted feed today (or local midnight). A rejection changes nothing:
    // not the day, not the baseline, no weather call.
    const delta = input.total - s.steps_today;
    if (delta > 0 && !s.dead && !m.demo) {
      const jump = jumpCheck(delta, now - feedBaseline(m.feed_accept, today, midnight));
      if (!jump.allowed) {
        this.save(s, m);
        this.log("feed_rejected", { why: "jump", delta, total: input.total });
        return err(
          400,
          `That is ${delta} new steps since the last sync, more than ${MAX_JUMP_STEPS_PER_SECOND} a second. ` +
            `Nothing changed. Sync again in ${jump.retry_after_s} s.`,
          jump.retry_after_s
        );
      }
    }
    if (input.lat !== undefined || input.lon !== undefined) this.moveTo(m, input, now);
    const before = s.steps_today;
    const prev = s;
    s = engine.feed(s, input.total);
    if (s.steps_today > before) m.feed_accept = { day: today, ms: now };
    this.feedMoments(m, prev, s, now);
    this.save(s, m);
    this.log("feed", { total: input.total, delta: Math.max(0, s.steps_today - before), energy: s.energy });
    return ok({ ...this.feedSummary(s), ...envelope });
  }

  /**
   * S10-09: keep one coarse current point (two decimals, about 1 km), never a
   * trail, not even in the log. A move may force a weather refresh at most once
   * an hour; otherwise the cached forecast stays until its normal refresh.
   * Today's burrow decision is not changed here.
   */
  private moveTo(m: Meta, input: FeedInput, now: number): void {
    const valid =
      typeof input.lat === "number" && typeof input.lon === "number" &&
      Number.isFinite(input.lat) && Number.isFinite(input.lon) &&
      input.lat >= -90 && input.lat <= 90 && input.lon >= -180 && input.lon <= 180;
    if (!valid) {
      this.log("coords_invalid", {});
      return;
    }
    const lat = Math.round(input.lat! * 100) / 100;
    const lon = Math.round(input.lon! * 100) / 100;
    if (lat === m.lat && lon === m.lon) return;
    m.lat = lat;
    m.lon = lon;
    m.coords_rev = (m.coords_rev ?? 0) + 1; // a forecast already in flight is for the old point
    m.city = ""; // request.cf city no longer matches the point
    const refresh = coordRefreshAllowed(m.coords_refresh_ms, now);
    if (refresh) {
      m.coords_refresh_ms = now;
      // Mark the cache stale. The next owner /state fetches once, through the daily cache.
      if (m.weather_now) m.weather_now = { ...m.weather_now, fetched_ms: 0 };
    }
    this.log("coords", { moved: true, refresh });
  }

  async spore(secret: string): Promise<Result<StateSummary>> {
    const now = Date.now();
    const o = await this.open(secret, now);
    if (!o.ok) return o;
    const { s, m } = o.value;
    // S10-11: a living Truffle cannot be replaced. Only death opens the way.
    if (!s.dead) return err(409, "This Truffle is still alive. A new spore can only be planted after it dies.");
    let next = engine.newSpore(s);
    if (!m.demo) next = { ...next, burrowed: this.burrowToday(m, now) ?? false };
    this.wipeMemory(m);
    this.resetMomentDay(m); // a new spore emits nothing
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
   *
   * S11-01, S11-02: every admitted chat gets a ticket (an id and the pet
   * generation) and reserves its quota at admission. Only the ticket holder
   * may charge, write the transcript, start fact extraction or release the
   * slot. After the deadline the next request aborts the old inference and
   * takes the slot. A completion for an older generation (death, new spore,
   * demo reset) is discarded: no charge, no transcript, no facts.
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
    const held = m.chat;
    if (held && held.until > now) {
      return err(429, "Truffle is still answering your last message. One at a time, please.");
    }
    if (held) {
      // Past its deadline. Cancel the old inference before a new slot opens.
      // Clearing its ticket fences it: it can no longer charge or release.
      const running = this.inflight.get(held.id);
      if (running) {
        running.abort(new Error("chat deadline"));
      } else if (held.demo_window !== undefined) {
        // Its run died with an earlier instance of this object: no reply came.
        m.demo_replies = unreserve(m.demo_replies, held.demo_window);
      }
      delete m.chat;
      this.log("chat_deadline", {});
    }
    const decision = engine.decideTier(s, requested);
    // S10-05: a demo Truffle gets at most 30 model replies a day. The slot is
    // reserved here, before the model call, and given back only if no visible
    // text comes out (S11-01, S11-06).
    const quota = m.demo && decision.model_call ? checkRate(m.demo_replies, now, DEMO_REPLIES_PER_DAY, DAY_MS) : null;
    if (quota && !quota.allowed) {
      this.save(s, m);
      return err(
        429,
        `This demo Truffle has used its ${DEMO_REPLIES_PER_DAY} replies for today. Try again in ${Math.ceil(quota.retry_after_s / 3600)} h.`,
        quota.retry_after_s
      );
    }
    const rate = checkRate(m.chat_window, now, CHAT_LIMIT_PER_HOUR);
    m.chat_window = rate.window;
    if (!rate.allowed) {
      this.save(s, m);
      return err(
        429,
        `Truffle needs a break: ${CHAT_LIMIT_PER_HOUR} messages per hour. Try again in ${Math.ceil(rate.retry_after_s / 60)} min.`,
        rate.retry_after_s
      );
    }
    if (quota) m.demo_replies = quota.window;
    const ticket: ChatTicket = {
      id: crypto.randomUUID(),
      generation: m.generation ?? 0,
      until: now + CHAT_LOCK_MS,
      ...(quota ? { demo_window: quota.window.start_ms } : {})
    };
    m.chat = ticket;
    if (langIn && langIn !== m.lang) m.lang = langIn;
    this.save(s, m);

    const ctrl = new AbortController();
    this.inflight.set(ticket.id, ctrl);
    // The whole reply, not just the first token, must end by the deadline.
    const deadline = setTimeout(() => ctrl.abort(new Error("chat deadline")), CHAT_LOCK_MS);

    const lang = m.lang;
    const today = localDayKey(now, m.tz);
    const enc = new TextEncoder();
    let output: ReadableStreamDefaultController<Uint8Array> | null = null;
    const readable = new ReadableStream<Uint8Array>({
      start(controller) { output = controller; },
      cancel() { output = null; }
    });
    // A client that hangs up must not stop the charge for a reply that was
    // produced. Queue this finite, token-capped reply without awaiting client
    // reads: TransformStream backpressure can otherwise trap even the deadline
    // cleanup in writer.write/close when a tab stops reading but stays open.
    const send = async (event: string, data: unknown) => {
      try {
        output?.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      } catch {
        output = null; // delivery never prevents accounting or cleanup
      }
    };

    /** Why this chat no longer owns its slot or its life, or null if it still does. */
    const fenced = (row: Row | null): string | null => {
      if (!row) return "gone";
      if (row.m.chat?.id !== ticket.id) return "deadline";
      if ((row.m.generation ?? 0) !== ticket.generation || row.s.dead) return "new life";
      return null;
    };

    /** Give back the demo reply slot. Only for a chat that showed no visible text. */
    let unreserved = false;
    const giveBackSlot = () => {
      if (unreserved || ticket.demo_window === undefined) return;
      unreserved = true;
      const cur = this.load();
      if (cur) this.save(cur.s, { ...cur.m, demo_replies: unreserve(cur.m.demo_replies, ticket.demo_window) });
    };

    // The only place a chat is charged. Runs at most once per chat. True if charged.
    let settled = false;
    const finish = async (
      reply: string,
      brain: BrainName | "none",
      half_awake: boolean,
      partial = false,
      retried = false
    ): Promise<boolean> => {
      if (settled) return false;
      settled = true;
      // Re-read: a /feed may have landed while the brain was talking.
      const cur = this.load();
      const why = fenced(cur);
      if (why !== null || !cur) {
        // S11-02: not this chat's slot or not this life any more. Nothing is
        // charged and nothing is written. A reply that showed text keeps its
        // demo slot: the words did reach the client.
        if (!hasVisibleText(reply)) giveBackSlot();
        this.log("chat_stale", { tier: decision.tier, why, chars: reply.length });
        await send("error", { error: FENCED });
        return false;
      }
      const after = engine.chargeChat(cur.s, decision);
      this.save(after, cur.m); // the demo reply was counted at admission
      this.sql.exec("INSERT INTO turns (ts, day, role, content) VALUES (?, ?, 'user', ?)", now, today, message);
      this.sql.exec("INSERT INTO turns (ts, day, role, content) VALUES (?, ?, 'assistant', ?)", Date.now(), today, reply);
      this.sql.exec(`DELETE FROM turns WHERE id NOT IN (SELECT id FROM turns ORDER BY id DESC LIMIT ${MAX_TURNS})`);
      // One charge per chat, retry or not. The retry is counted here (S03).
      this.log("chat", { tier: decision.tier, brain, half_awake, spent: decision.cost, chars: reply.length, partial, retried });
      await send("done", {
        tier: decision.tier,
        brain,
        half_awake,
        partial,
        spent: decision.cost,
        summary: this.summary(after, cur.m, Date.now())
      });
      return true;
    };

    // B10: when burrowed, the heat notice comes from code, not from the model.
    // Validated numbers and fixed words only. It is shown, never stored as a turn.
    // A demo Truffle's heat is a toggle, not a forecast: the line carries no number.
    const heatNow = m.demo ? undefined : m.weather_now?.current_apparent_c;
    const heatMax = m.demo ? undefined : m.weather_days?.[today];
    const heat = s.burrowed ? heatLine(heatNow, heatMax, lang) : null;
    let heatShown = false;
    const showHeat = async () => {
      if (!heat || heatShown) return;
      heatShown = true;
      const h = heatTemp(heatNow, heatMax);
      this.log("heat_line", { lang, temp: h ? h.t : null });
      await send("token", { t: `${heat}\n` });
    };

    // B10: the visible stream goes through the status block guard. `reply` is
    // what the client saw (minus the heat line), and that is what is charged for
    // and stored, so a leaked block never re-enters the context either.
    const guard = new BlockGuard(lang);
    let lead = ""; // whitespace held until the heat line is out
    const show = async (text: string) => {
      if (!text) return;
      reply += text;
      if (heat && !heatShown) {
        if (!hasVisibleText(text)) {
          lead += text;
          return;
        }
        await showHeat();
        text = lead + text;
        lead = "";
      }
      await send("token", { t: text });
    };
    /** End of the model stream: release held text, then count leaks and voice slips. */
    let audited = false;
    const endStream = async (brain: BrainName) => {
      if (audited) return;
      audited = true;
      await show(guard.flush());
      if (lead) await send("token", { t: lead });
      lead = "";
      if (guard.leaks > 0) this.log("block_leak", { count: guard.leaks, tier: decision.tier, brain });
      // Counted, never altered: honest before and after numbers for the eval.
      const terms = voiceHits(reply);
      if (terms.length) this.log("voice_flag", { terms, tier: decision.tier, brain });
    };

    let reply = "";
    let brainUsed: BrainName = "workers-ai";
    let halfAwake = true;
    let retry = { retried: false };
    const run = async () => {
      try {
        if (!decision.model_call) {
          const line = sleepyLine(message, lang);
          await send("brain", { brain: "none", half_awake: false });
          await showHeat();
          await send("token", { t: line });
          await finish(line, "none", false);
          return;
        }
        // S10-10: weather in the state block comes only from validated numbers
        // and fixed words. Anything else is "unavailable".
        const weather = stateWeather(m.weather_now, m.city, "en"); // decision 0012: English for every lang
        const system = buildSystemPrompt({
          // Decision 0013: the block shows the tier that is charged and capped.
          stateBlock: engine.stateBlock(s, { lang, weather_text: weather, tier: decision.tier }),
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
          lang,
          signal: ctrl.signal
        });
        if (res.fallback_reason) this.log("brain_fallback", { reason: res.fallback_reason });
        brainUsed = res.brain;
        halfAwake = res.half_awake;
        retry = res.retry;
        await send("brain", { brain: res.brain, half_awake: res.half_awake });
        const reader = res.stream.getReader();
        // A provider may ignore the signal once it streams: cancel our side too.
        const stop = () => void reader.cancel(ctrl.signal.reason).catch(() => {});
        if (ctrl.signal.aborted) stop();
        else ctrl.signal.addEventListener("abort", stop, { once: true });
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            await show(guard.push(value));
          }
        } finally {
          ctrl.signal.removeEventListener("abort", stop);
          reader.releaseLock();
        }
        ctrl.signal.throwIfAborted();
        await endStream(res.brain);
        if (!hasVisibleText(reply)) {
          // Empty even after the one retry: nothing to charge for (S11-06).
          giveBackSlot();
          this.log("chat_empty", { tier: decision.tier, brain: res.brain, retried: retry.retried });
          await send("error", { error: NOT_CHARGED });
          return;
        }
        const charged = await finish(reply, res.brain, res.half_awake, false, retry.retried);
        if (charged && (decision.tier === "medium" || decision.tier === "high")) {
          this.ctx.waitUntil(this.rememberFrom(message, reply, today, ticket.generation));
        }
      } catch (e) {
        await endStream(brainUsed);
        this.log("chat_error", { error: e instanceof Error ? e.message : String(e), chars: reply.length });
        if (hasVisibleText(reply)) {
          // Failed mid-reply: the words were produced, so charge once and say it was cut short.
          await finish(reply, brainUsed, halfAwake, true, retry.retried).catch(() => {});
        } else {
          giveBackSlot();
          await send("error", { error: NOT_CHARGED });
        }
      } finally {
        clearTimeout(deadline);
        this.inflight.delete(ticket.id);
        // Release only our own slot. A newer chat's ticket is left alone.
        const cur = this.load();
        if (cur && cur.m.chat?.id === ticket.id) {
          delete cur.m.chat;
          this.save(cur.s, cur.m);
        }
        output?.close();
        output = null;
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

  private async rememberFrom(message: string, reply: string, today: string, generation: number): Promise<void> {
    const facts = await extractFacts(this.env, `human: ${message}\ntruffle: ${reply}`, (error) =>
      this.log("facts_failed", { error })
    );
    if (!facts.length) return;
    const row = this.load();
    // Generation fence (S10-11, S11-02): a Truffle that died, was replanted or
    // reset while this ran must not get the old life's facts back.
    if (!row || row.s.dead || (row.m.generation ?? 0) !== generation) {
      this.log("facts_dropped", { reason: "new life" });
      return;
    }
    const added = this.addFacts(facts, today, row.s.affection);
    this.log("facts", { added, offered: facts.length });
  }

  // ---------- demo controls (demo Truffles only) ----------

  /**
   * Every demo control checks the flag stored at /demo/spawn (S10-05). No
   * request field can make a real Truffle a demo one.
   */
  private async openDemo(secret: string, now: number) {
    const o = await this.open(secret, now);
    if (o.ok && o.value.m.demo !== true) return err(409, "not a demo truffle");
    return o;
  }

  /** Steps slider: feeds the absolute total for today. */
  async setSteps(secret: string, total: number): Promise<Result<StateSummary>> {
    const now = Date.now();
    const o = await this.openDemo(secret, now);
    if (!o.ok) return o;
    const s = engine.feed(o.value.s, total);
    this.feedMoments(o.value.m, o.value.s, s, now);
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
    this.midnightMoments(o.value.m, o.value.s, s, now);
    if (!wasDead && s.dead) this.wipeMemory(o.value.m);
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
    this.wipeMemory(o.value.m);
    this.resetMomentDay(o.value.m);
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
        this.hasSchema = false; // a chat still running must not write to the deleted Truffle
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
