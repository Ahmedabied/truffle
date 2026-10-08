// Shared types for the Worker, the Durable Object and the brain router.
import type { Tier } from "./config";
import type { Mood, TruffleState } from "./engine";
import type { ParsedForecast } from "./weather";

export interface Env {
  TRUFFLE: DurableObjectNamespace<import("./do").TruffleDO>;
  LIMITER: DurableObjectNamespace<import("./limiter").LimiterDO>;
  AI: Ai;
  BRAIN_TIMEOUT_MS?: string;
  MODAL_URL?: string;
  MODAL_TOKEN?: string;
  /** Extra CORS origins, comma separated (for example the Pages URL). */
  ALLOWED_ORIGINS?: string;
}

export type Lang = "ar" | "en";

export interface RateWindow {
  start_ms: number;
  count: number;
}

/** Everything about a Truffle that is not engine state. Stored as one JSON column. */
export interface Meta {
  tz: string;
  country: string;
  lang: Lang;
  lat: number;
  lon: number;
  city: string;
  secret_hash: string;
  demo: boolean;
  created_ms: number;
  /** Instant of the last processed local midnight (or created_ms). */
  last_tick_ms: number;
  /** Local day key that the last processed midnight opened. Idempotency guard. */
  last_midnight_key: string;
  /** Daytime max apparent temperature per local day, from the last forecast. */
  weather_days: Record<string, number>;
  /** Latest current conditions and when they were fetched. */
  weather_now: (ParsedForecast & { fetched_ms: number }) | null;
  feed_window: RateWindow;
  /** Chats per hour, same limit for real and demo Truffles. */
  chat_window?: RateWindow;
  /** The one admitted chat in flight (S11-01). Only its id may finish, charge or release it. */
  chat?: ChatTicket;
  /** Last device_tz the feeder reported. Display and logs only: the alarm uses tz, pinned at /pair. */
  device_tz?: string;
  /** Last accepted increasing feed: the start of the jump-cap window (S10-07). */
  feed_accept?: import("./ratelimit").FeedAccept;
  /** Last time new coordinates forced a weather refresh (S10-09). At most once an hour. */
  coords_refresh_ms?: number;
  /** Demo Truffles: model replies in the current 24 h window (S10-05). */
  demo_replies?: RateWindow;
  /** Bumped at death, new spore and demo reset. Late completions and fact extraction from an older life are dropped. */
  generation?: number;
  /** Bumped whenever the stored point moves. A forecast for an older point is discarded (S11-11). */
  coords_rev?: number;
  /** Forecast failure backoff (S11-11). Unset after a good fetch. */
  weather_fail?: { until_ms: number; backoff_ms: number };
  /** Proud moments (decision 0017): the last 20, ascending id. Never cleared on read. */
  moments?: import("./moments").Moment[];
  /** Id the next moment gets. Only grows. */
  next_moment_id?: number;
  /** Once-per-day moment kinds already fired today. Cleared at local midnight and at a new spore. */
  moments_today?: import("./moments").MomentKind[];
  /** Completed days in a row at or above the streak floor. Kept here because history7 holds only 7. */
  streak_days?: number;
}

export interface ChatTicket {
  id: string;
  /** Pet generation at admission. A completion for another generation is discarded. */
  generation: number;
  /** Deadline. After it, the next chat request aborts this one and takes the slot. */
  until: number;
  /** Demo Truffles: start of the reply window this chat reserved a slot in. */
  demo_window?: number;
}

export interface PairInput {
  tz: string;
  country: string;
  lang: Lang;
  lat: number;
  lon: number;
  city: string;
  secret_hash: string;
  demo: boolean;
}

/** What /state, /feed and the chat done event return. */
export interface StateSummary {
  state: TruffleState;
  mood: Mood;
  tier: Tier;
  energy_max: number;
  energy_pct: number;
  tz: string;
  country: string;
  lang: Lang;
  city: string;
  demo: boolean;
  local_day: string;
  next_midnight_ms: number | null;
  weather: {
    text: string;
    apparent_c: number | null;
    daytime_max_c: number | null;
    precipitation_mm: number;
    wind_kmh: number;
    is_day: boolean;
    weather_code: number;
  } | null;
  /** Demo Truffles only: when the DO deletes itself. */
  expires_ms?: number;
  /** Proud moments, the last 20, ascending id (decision 0017). */
  moments: import("./moments").Moment[];
}

/** Reduced view returned by the phrase-only /feed. */
export interface FeedSummary {
  energy: number;
  energy_max: number;
  stage: import("./config").Stage;
  mood: Mood;
  tier: Tier;
  steps_today: number;
  burrowed: boolean;
}

/** RPC results never throw across the stub. */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 401 | 404 | 409 | 429; error: string; hint?: string; retry_after_s?: number };
