// Route admission rules (S10-07, S10-08, S10-09). Pure functions, so they are
// unit tested without a Worker. A request that fails here never reaches a
// Truffle: no state change, no weather call, no brain call.

export const MAX_BODY_BYTES = 8192;
/** Abuse ceiling for one local day, not a health target. */
export const MAX_DAILY_STEPS = 50_000;
export const MAX_MESSAGE_CHARS = 2048;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** A request body must be a JSON object of at most 8 KiB. Empty means {}. */
export function parseBodyText(text: string): Parsed<Record<string, unknown>> {
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { ok: false, error: `The request body is too large. The limit is ${MAX_BODY_BYTES} bytes.` };
  }
  if (text.trim() === "") return { ok: true, value: {} };
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    return { ok: false, error: "The request body is not valid JSON." };
  }
  if (!j || typeof j !== "object" || Array.isArray(j)) {
    return { ok: false, error: "The request body must be a JSON object." };
  }
  return { ok: true, value: j as Record<string, unknown> };
}

/**
 * null when v is a valid daily total: a nonnegative safe integer, at most
 * 50,000. Strings, null, booleans, fractions and non-finite numbers are refused,
 * never coerced.
 */
export function stepTotalError(v: unknown, field = "steps_today_total"): string | null {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) {
    return `${field} must be a whole number of steps, 0 or more.`;
  }
  if (v > MAX_DAILY_STEPS) return `${field} is above the daily limit of ${MAX_DAILY_STEPS} steps.`;
  return null;
}

/** Trimmed chat message, 1 to 2048 characters (code points, not UTF-16 units). */
export function parseMessage(v: unknown): Parsed<string> {
  const m = typeof v === "string" ? v.trim() : "";
  const n = [...m].length;
  if (n === 0 || n > MAX_MESSAGE_CHARS) {
    return { ok: false, error: `message must be 1 to ${MAX_MESSAGE_CHARS} characters.` };
  }
  return { ok: true, value: m };
}

/**
 * Optional coordinates. Both or neither, finite, in range. Rounded to two
 * decimals (about 1 km), so only a coarse current point is ever stored.
 */
export function parseCoords(lat: unknown, lon: unknown): Parsed<{ lat: number; lon: number } | null> {
  const hasLat = lat !== undefined && lat !== null;
  const hasLon = lon !== undefined && lon !== null;
  if (!hasLat && !hasLon) return { ok: true, value: null };
  const inRange = (v: unknown, max: number): v is number =>
    typeof v === "number" && Number.isFinite(v) && v >= -max && v <= max;
  if (!hasLat || !hasLon || !inRange(lat, 90) || !inRange(lon, 180)) {
    return { ok: false, error: "lat and lon must come together, as numbers in range." };
  }
  return { ok: true, value: { lat: round2(lat), lon: round2(lon) } };
}

function round2(v: number): number {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}
