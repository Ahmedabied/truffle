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
