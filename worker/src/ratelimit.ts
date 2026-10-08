// Fixed-window rate limit. Pure: the DO stores the window in its meta.
import type { RateWindow } from "./types";

export const FEED_LIMIT_PER_HOUR = 60;
export const HOUR_MS = 3_600_000;

export function checkRate(
  w: RateWindow | undefined,
  now: number,
  limit = FEED_LIMIT_PER_HOUR,
  windowMs = HOUR_MS
): { allowed: boolean; window: RateWindow; retry_after_s: number } {
  const fresh = !w || now - w.start_ms >= windowMs || now < w.start_ms;
  const cur: RateWindow = fresh ? { start_ms: now, count: 0 } : { ...w! };
  if (cur.count >= limit) {
    return { allowed: false, window: cur, retry_after_s: Math.ceil((cur.start_ms + windowMs - now) / 1000) };
  }
  cur.count += 1;
  return { allowed: true, window: cur, retry_after_s: 0 };
}

export const CHAT_LIMIT_PER_HOUR = 60;
/** A chat holds the lock at most this long, even if the stream never finishes. */
export const CHAT_LOCK_MS = 60_000;
export const DEMO_SPAWNS_PER_HOUR = 5;
export const DEMO_SPAWNS_PER_DAY = 20;
export const DAY_MS = 86_400_000;
/**
 * Plausibility cap for /feed: nobody walks more than 4 steps a second on
 * average since local midnight. Stops yesterday's total, replayed just after
 * midnight without a `day` field, from being counted again.
 */
export const MAX_STEPS_PER_SECOND = 4;

export function plausibleTotal(total: number, msSinceMidnight: number): boolean {
  return total <= Math.max(0, msSinceMidnight / 1000) * MAX_STEPS_PER_SECOND;
}

/** Same as checkRate but does not count. For quotas charged only on success. */
export function peekRate(
  w: RateWindow | undefined,
  now: number,
  limit: number,
  windowMs: number
): { allowed: boolean; retry_after_s: number } {
  const fresh = !w || now - w.start_ms >= windowMs || now < w.start_ms;
  if (fresh || w!.count < limit) return { allowed: true, retry_after_s: 0 };
  return { allowed: false, retry_after_s: Math.ceil((w!.start_ms + windowMs - now) / 1000) };
}

/**
 * Feed jump cap (S10-07): an increase may imply at most 20 steps a second
 * since the last accepted feed of the same local day. A coarse guard against
 * invented totals, well above any real walking or running pace.
 */
export const MAX_JUMP_STEPS_PER_SECOND = 20;

export function jumpCheck(delta: number, elapsedMs: number): { allowed: boolean; retry_after_s: number } {
  if (delta <= 0) return { allowed: true, retry_after_s: 0 };
  const elapsedS = Math.max(0, elapsedMs) / 1000;
  if (delta <= Math.floor(MAX_JUMP_STEPS_PER_SECOND * elapsedS)) return { allowed: true, retry_after_s: 0 };
  return { allowed: false, retry_after_s: Math.max(1, Math.ceil(delta / MAX_JUMP_STEPS_PER_SECOND - elapsedS)) };
}

/** Last accepted increasing feed. Rejected, equal and lower feeds never move it. */
export interface FeedAccept {
  day: string;
  ms: number;
}

/** Start of the jump window: the last accepted feed today, else local midnight. */
export function feedBaseline(last: FeedAccept | undefined, today: string, midnightMs: number): number {
  return last && last.day === today ? Math.max(last.ms, midnightMs) : midnightMs;
}

/** Demo Truffles: at most 30 model replies a day (S10-05). */
export const DEMO_REPLIES_PER_DAY = 30;

/** Coordinates may force a weather refresh at most once an hour per Truffle (S10-09). */
export const COORD_REFRESH_MS = HOUR_MS;

export function coordRefreshAllowed(lastMs: number | undefined, now: number): boolean {
  return lastMs === undefined || now - lastMs >= COORD_REFRESH_MS || now < lastMs;
}

/**
 * Give back one quota slot reserved at admission (S11-01), but only in the
 * window it was taken from. A reply that never showed text is not a reply.
 */
export function unreserve(w: RateWindow | undefined, windowStartMs: number): RateWindow | undefined {
  if (!w || w.start_ms !== windowStartMs || w.count <= 0) return w;
  return { ...w, count: w.count - 1 };
}

/**
 * Failed owner lookups per client IP (S11-05): unknown phrase, wrong or
 * missing secret. Checked before any Truffle object is touched.
 */
export const AUTH_FAILS_PER_MINUTE = 30;
export const MINUTE_MS = 60_000;

/** Forecast failure backoff (S11-11): 5 minutes, doubling, at most 1 hour. */
export const WEATHER_BACKOFF_START_MS = 5 * MINUTE_MS;
export const WEATHER_BACKOFF_MAX_MS = HOUR_MS;

export function nextWeatherBackoff(previousMs: number | undefined): number {
  return previousMs ? Math.min(previousMs * 2, WEATHER_BACKOFF_MAX_MS) : WEATHER_BACKOFF_START_MS;
}
