// Pure local-calendar helpers. No I/O, host timezone, or wall-clock reads.
// Intl uses the runtime's IANA timezone data. All returned instants are epoch ms.

export interface LocalDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** Sunday = 0, Monday = 1, ..., Saturday = 6. */
  weekday: number;
}

const DAY_MS = 86_400_000;
const WEEKDAYS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
};

function assertTimestamp(ms: number): void {
  if (!Number.isFinite(ms) || !Number.isFinite(new Date(ms).getTime())) {
    throw new RangeError("Expected a finite epoch timestamp within the Date range");
  }
}

function formatterFor(tz: string): Intl.DateTimeFormat {
  // Do not silently use the host zone for undefined. Reject numeric offset zones,
  // which newer Intl versions accept but which are not IANA timezone names.
  if (typeof tz !== "string" || tz.length === 0 || /^[+-]/.test(tz)) {
    throw new RangeError("Expected an IANA timezone name");
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23"
  });
}

function readParts(ms: number, formatter: Intl.DateTimeFormat): LocalDateParts {
  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(ms)) values[part.type] = part.value;
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    // Some Intl engines emit 24 at the START of the printed date. Do not
    // increment the day. hourCycle h23 normally prevents this behavior.
    hour: Number(values.hour) % 24,
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: WEEKDAYS[values.weekday]
  };
}

/** Numeric Gregorian parts in tz, with a 0..23 hour and a 0..6 weekday. */
export function localDateParts(ms: number, tz: string): LocalDateParts {
  assertTimestamp(ms);
  return readParts(ms, formatterFor(tz));
}

/** Gregorian YYYY-MM-DD in tz. Never derived by slicing a UTC ISO string. */
export function localDayKey(ms: number, tz: string): string {
  const { year, month, day } = localDateParts(ms, tz);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Serialize wall-clock fields as UTC solely for calendar arithmetic. This is
// not their real UTC instant. setUTCFullYear avoids Date.UTC's year 0..99 remap.
function wallMs(
  year: number, month: number, day: number,
  hour = 0, minute = 0, second = 0
): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  const result = date.getTime();
  assertTimestamp(result);
  return result;
}

function nextMidnight(ms: number, formatter: Intl.DateTimeFormat): number {
  const current = readParts(ms, formatter);
  // Increment the calendar date, never the elapsed UTC duration.
  const target = wallMs(current.year, current.month, current.day + 1);
  const currentWall = wallMs(
    current.year, current.month, current.day,
    current.hour, current.minute, current.second
  );
  // formatToParts omits milliseconds. Drop them before estimating the offset.
  const wholeSecond = Math.floor(new Date(ms).getTime() / 1000) * 1000;
  let guess = target - (currentWall - wholeSecond);
  let before = Math.floor(ms);
  let after: number | undefined;

  // Usually one correction is enough. A midnight gap oscillates between its
  // two offsets instead of converging. Save that bracket for the fallback.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = readParts(guess, formatter);
    const actualWall = wallMs(
      parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second
    );
    const correction = target - actualWall;
    if (correction === 0 && guess > ms) return guess;
    const actualDay = wallMs(parts.year, parts.month, parts.day);
    if (actualDay < target) before = Math.max(before, guess);
    else after = after === undefined ? guess : Math.min(after, guess);
    guess += correction;
  }

  // No 00:00 exists. Find the first millisecond with a date at least target.
  // This also skips wholly missing dates, such as Apia's 2011-12-30.
  // IANA UTC offsets fit within a day, so target + two days is a safe upper
  // bound if the correction loop did not already provide one.
  let high = after ?? target + 2 * DAY_MS;
  assertTimestamp(high);
  while (high - before > 1) {
    const middle = before + Math.floor((high - before) / 2);
    const parts = readParts(middle, formatter);
    if (wallMs(parts.year, parts.month, parts.day) >= target) high = middle;
    else before = middle;
  }
  if (high <= ms) throw new RangeError("No next local day within the Date range");
  return high;
}

/**
 * Start of the next local calendar date, strictly after ms.
 * A midnight gap uses that day's first instant. A wholly skipped date uses
 * the next existing date. Repeated midnight hours count once per local date.
 */
export function nextLocalMidnight(ms: number, tz: string): number {
  assertTimestamp(ms);
  return nextMidnight(ms, formatterFor(tz));
}

/**
 * Day boundaries in (lastTickMs, nowMs], oldest first, at most max entries.
 * lastTickMs may also be a pairing or timezone-change baseline. A cap never
 * discards debt: resume with the final returned instant in the next batch.
 */
export function missedMidnights(
  lastTickMs: number, nowMs: number, tz: string, max = 14
): number[] {
  assertTimestamp(lastTickMs);
  assertTimestamp(nowMs);
  if (!Number.isSafeInteger(max) || max < 0) {
    throw new RangeError("max must be a nonnegative safe integer");
  }
  const formatter = formatterFor(tz);
  const result: number[] = [];
  let cursor = lastTickMs;
  while (cursor < nowMs && result.length < max) {
    const next = nextMidnight(cursor, formatter);
    if (next > nowMs) break;
    result.push(next);
    cursor = next;
  }
  return result;
}

/** True for IANA names and aliases understood by this runtime, including UTC. */
export function isValidTimeZone(tz: string): boolean {
  try {
    formatterFor(tz);
    return true;
  } catch {
    return false;
  }
}
