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
  /** One chat in flight per Truffle: no new chat before this instant. */
  chat_lock_until?: number;
  /** Last device_tz the feeder reported. Display and logs only: the alarm uses tz, pinned at /pair. */
  device_tz?: string;
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
export type Result<T> = { ok: true; value: T } | { ok: false; status: 400 | 401 | 404 | 409 | 429; error: string };
