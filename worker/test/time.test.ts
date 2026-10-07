// Ported from fleet/outbox/S05/time.test.ts (node:test) to vitest.
import { it as test, vi } from "vitest";
import assert from "node:assert/strict";
import {
  isValidTimeZone,
  localDateParts,
  localDayKey,
  missedMidnights,
  nextLocalMidnight
} from "../src/time";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const ms = (iso: string): number => Date.parse(iso);
const isoList = (instants: number[]): string[] => instants.map(t => new Date(t).toISOString());

function expectBoundary(from: string, tz: string, expected: string, hour = 0): void {
  const result = nextLocalMidnight(ms(from), tz);
  assert.equal(result, ms(expected), `${from} in ${tz}`);
  assert.ok(result > ms(from), "The boundary must be strictly after the input");
  assert.notEqual(localDayKey(result - 1, tz), localDayKey(result, tz));
  const parts = localDateParts(result, tz);
  assert.equal(parts.hour, hour);
  assert.equal(parts.minute, 0);
  assert.equal(parts.second, 0);
}

test("Muscat local parts, weekday, and day key use UTC+4", () => {
  assert.deepEqual(localDateParts(ms("2026-10-07T19:59:58.999Z"), "Asia/Muscat"), {
    year: 2026, month: 10, day: 7, hour: 23, minute: 59, second: 58, weekday: 3
  });
  assert.deepEqual(localDateParts(ms("2026-10-07T20:00:00.000Z"), "Asia/Muscat"), {
    year: 2026, month: 10, day: 8, hour: 0, minute: 0, second: 0, weekday: 4
  });
  assert.equal(localDayKey(ms("2026-10-07T20:00:00Z"), "Asia/Muscat"), "2026-10-08");
});

test("Muscat midnight across ordinary dates, month ends, year ends, and leap day", () => {
  const cases = [
    ["2026-10-07T16:30:00Z", "2026-10-07T20:00:00Z"],
    ["2026-01-01T00:00:00Z", "2026-01-01T20:00:00Z"],
    ["2026-02-28T19:00:00Z", "2026-02-28T20:00:00Z"],
    ["2026-12-31T19:00:00Z", "2026-12-31T20:00:00Z"],
    ["2024-02-28T19:00:00Z", "2024-02-28T20:00:00Z"],
    ["2024-02-29T19:00:00Z", "2024-02-29T20:00:00Z"]
  ];
  for (const [from, expected] of cases) expectBoundary(from, "Asia/Muscat", expected);
  assert.equal(localDayKey(ms("2026-12-31T20:00:00Z"), "Asia/Muscat"), "2027-01-01");
});

test("Exact midnight is excluded, including millisecond-adjacent inputs", () => {
  expectBoundary("2026-10-07T19:59:59.999Z", "Asia/Muscat", "2026-10-07T20:00:00Z");
  expectBoundary("2026-10-07T20:00:00.000Z", "Asia/Muscat", "2026-10-08T20:00:00Z");
  expectBoundary("2026-10-07T20:00:00.001Z", "Asia/Muscat", "2026-10-08T20:00:00Z");
});

test("Berlin DST start on 2026-03-29 creates a 23-hour local day", () => {
  const start = ms("2026-03-28T23:00:00Z");
  const next = nextLocalMidnight(start, "Europe/Berlin");
  assert.equal(next, ms("2026-03-29T22:00:00Z"));
  assert.equal(next - start, 23 * HOUR_MS);
  expectBoundary("2026-03-28T12:00:00Z", "Europe/Berlin", "2026-03-28T23:00:00Z");
  expectBoundary("2026-03-29T00:59:59.999Z", "Europe/Berlin", "2026-03-29T22:00:00Z");
  expectBoundary("2026-03-29T01:00:00Z", "Europe/Berlin", "2026-03-29T22:00:00Z");
  expectBoundary("2026-03-30T12:00:00Z", "Europe/Berlin", "2026-03-30T22:00:00Z");
  assert.equal(localDateParts(ms("2026-03-29T00:59:59Z"), "Europe/Berlin").hour, 1);
  assert.equal(localDateParts(ms("2026-03-29T01:00:00Z"), "Europe/Berlin").hour, 3);
});

test("Berlin DST end on 2026-10-25 creates a 25-hour local day", () => {
  const start = ms("2026-10-24T22:00:00Z");
  const next = nextLocalMidnight(start, "Europe/Berlin");
  assert.equal(next, ms("2026-10-25T23:00:00Z"));
  assert.equal(next - start, 25 * HOUR_MS);
  expectBoundary("2026-10-24T12:00:00Z", "Europe/Berlin", "2026-10-24T22:00:00Z");
  expectBoundary("2026-10-25T00:59:59.999Z", "Europe/Berlin", "2026-10-25T23:00:00Z");
  expectBoundary("2026-10-25T01:00:00Z", "Europe/Berlin", "2026-10-25T23:00:00Z");
  expectBoundary("2026-10-26T12:00:00Z", "Europe/Berlin", "2026-10-26T23:00:00Z");
  assert.equal(localDateParts(ms("2026-10-25T00:59:59Z"), "Europe/Berlin").hour, 2);
  assert.equal(localDateParts(ms("2026-10-25T01:00:00Z"), "Europe/Berlin").hour, 2);
});

test("New York DST end on 2026-11-01 creates a 25-hour day", () => {
  const start = ms("2026-11-01T04:00:00Z");
  const next = nextLocalMidnight(start, "America/New_York");
  assert.equal(next, ms("2026-11-02T05:00:00Z"));
  assert.equal(next - start, 25 * HOUR_MS);
  expectBoundary("2026-10-31T12:00:00Z", "America/New_York", "2026-11-01T04:00:00Z");
  expectBoundary("2026-11-01T05:30:00Z", "America/New_York", "2026-11-02T05:00:00Z");
  expectBoundary("2026-11-01T06:30:00Z", "America/New_York", "2026-11-02T05:00:00Z");
});

test("Kolkata uses a 30-minute UTC offset", () => {
  expectBoundary("2026-10-07T12:00:00Z", "Asia/Kolkata", "2026-10-07T18:30:00Z");
  expectBoundary("2026-10-07T18:30:00Z", "Asia/Kolkata", "2026-10-08T18:30:00Z");
  const parts = localDateParts(ms("2026-10-07T00:00:00Z"), "Asia/Kolkata");
  assert.equal(parts.hour, 5);
  assert.equal(parts.minute, 30);
});

test("Kathmandu uses a 45-minute UTC offset", () => {
  expectBoundary("2026-10-07T12:00:00Z", "Asia/Kathmandu", "2026-10-07T18:15:00Z");
  expectBoundary("2026-10-07T18:15:00Z", "Asia/Kathmandu", "2026-10-08T18:15:00Z");
  const parts = localDateParts(ms("2026-10-07T00:00:00Z"), "Asia/Kathmandu");
  assert.equal(parts.hour, 5);
  assert.equal(parts.minute, 45);
});

test("Lord Howe handles 30-minute DST shifts", () => {
  expectBoundary("2026-04-04T13:00:00Z", "Australia/Lord_Howe", "2026-04-05T13:30:00Z");
  expectBoundary("2026-10-03T13:30:00Z", "Australia/Lord_Howe", "2026-10-04T13:00:00Z");
  assert.equal(nextLocalMidnight(ms("2026-04-04T13:00:00Z"), "Australia/Lord_Howe")
    - ms("2026-04-04T13:00:00Z"), 24.5 * HOUR_MS);
  assert.equal(nextLocalMidnight(ms("2026-10-03T13:30:00Z"), "Australia/Lord_Howe")
    - ms("2026-10-03T13:30:00Z"), 23.5 * HOUR_MS);
});

test("Sao Paulo 2018-11-04 has no midnight, so use its first instant at 01:00", () => {
  // IANA tzdb: Rule Brazil 2018 only - Nov Sun>=1 0:00 1:00 -
  // https://github.com/eggert/tz/blob/main/southamerica
  expectBoundary("2018-11-03T12:00:00Z", "America/Sao_Paulo", "2018-11-04T03:00:00Z", 1);
  expectBoundary("2018-11-04T02:59:59.999Z", "America/Sao_Paulo", "2018-11-04T03:00:00Z", 1);
  assert.deepEqual(localDateParts(ms("2018-11-04T03:00:00Z"), "America/Sao_Paulo"), {
    year: 2018, month: 11, day: 4, hour: 1, minute: 0, second: 0, weekday: 0
  });
  expectBoundary("2018-11-04T03:00:00Z", "America/Sao_Paulo", "2018-11-05T02:00:00Z");
});

test("Kathmandu's 1986 midnight gap starts at 00:15, not a whole hour", () => {
  const next = nextLocalMidnight(ms("1985-12-31T12:00:00Z"), "Asia/Kathmandu");
  assert.equal(next, ms("1985-12-31T18:30:00Z"));
  assert.equal(localDayKey(next - 1, "Asia/Kathmandu"), "1985-12-31");
  assert.deepEqual(localDateParts(next, "Asia/Kathmandu"), {
    year: 1986, month: 1, day: 1, hour: 0, minute: 15, second: 0, weekday: 3
  });
  assert.equal(nextLocalMidnight(next - 1, "Asia/Kathmandu"), next);
  assert.equal(nextLocalMidnight(next, "Asia/Kathmandu"), ms("1986-01-01T18:15:00Z"));
});

test("Havana's repeated midnight is processed once, at its first occurrence", () => {
  expectBoundary("2026-10-31T12:00:00Z", "America/Havana", "2026-11-01T04:00:00Z");
  expectBoundary("2026-11-01T04:00:00Z", "America/Havana", "2026-11-02T05:00:00Z");
  expectBoundary("2026-11-01T04:30:00Z", "America/Havana", "2026-11-02T05:00:00Z");
  assert.equal(localDateParts(ms("2026-11-01T05:00:00Z"), "America/Havana").hour, 0);
});

test("Apia's wholly skipped 2011-12-30 does not invent a midnight", () => {
  // https://www.timeanddate.com/time/change/samoa/apia?year=2011
  expectBoundary("2011-12-29T12:00:00Z", "Pacific/Apia", "2011-12-30T10:00:00Z");
  assert.equal(localDayKey(ms("2011-12-30T09:59:59.999Z"), "Pacific/Apia"), "2011-12-29");
  assert.equal(localDayKey(ms("2011-12-30T10:00:00Z"), "Pacific/Apia"), "2011-12-31");
  expectBoundary("2011-12-30T10:00:00Z", "Pacific/Apia", "2011-12-31T10:00:00Z");
});

test("Catch-up returns exactly three elapsed boundaries, oldest first", () => {
  assert.deepEqual(isoList(missedMidnights(
    ms("2026-10-04T20:00:00Z"), ms("2026-10-07T22:00:00Z"), "Asia/Muscat"
  )), [
    "2026-10-05T20:00:00.000Z",
    "2026-10-06T20:00:00.000Z",
    "2026-10-07T20:00:00.000Z"
  ]);
});

test("A 30-day catch-up returns the oldest 14 and retains debt for later batches", () => {
  const start = ms("2026-08-31T20:00:00Z");
  const end = ms("2026-09-30T20:00:00Z");
  const first = missedMidnights(start, end, "Asia/Muscat");
  assert.equal(first.length, 14);
  assert.deepEqual(first, Array.from({ length: 14 }, (_, i) => start + (i + 1) * DAY_MS));
  const second = missedMidnights(first[first.length - 1], end, "Asia/Muscat");
  const third = missedMidnights(second[second.length - 1], end, "Asia/Muscat");
  assert.equal(second.length, 14);
  assert.equal(third.length, 2);
  assert.deepEqual([...first, ...second, ...third],
    Array.from({ length: 30 }, (_, i) => start + (i + 1) * DAY_MS));
});

test("Catch-up crosses Berlin's long day without adding fixed 24-hour periods", () => {
  assert.deepEqual(isoList(missedMidnights(
    ms("2026-10-23T22:00:00Z"), ms("2026-10-26T23:00:00Z"), "Europe/Berlin"
  )), [
    "2026-10-24T22:00:00.000Z",
    "2026-10-25T23:00:00.000Z",
    "2026-10-26T23:00:00.000Z"
  ]);
});

test("Catch-up crosses Berlin's short day", () => {
  assert.deepEqual(isoList(missedMidnights(
    ms("2026-03-27T23:00:00Z"), ms("2026-03-30T22:00:00Z"), "Europe/Berlin"
  )), [
    "2026-03-28T23:00:00.000Z",
    "2026-03-29T22:00:00.000Z",
    "2026-03-30T22:00:00.000Z"
  ]);
});

test("Catch-up includes the first instant of a day without midnight", () => {
  assert.deepEqual(isoList(missedMidnights(
    ms("2018-11-03T03:00:00Z"), ms("2018-11-05T02:00:00Z"), "America/Sao_Paulo"
  )), ["2018-11-04T03:00:00.000Z", "2018-11-05T02:00:00.000Z"]);
});

test("Catch-up skips absent dates and repeated midnight hours", () => {
  assert.deepEqual(isoList(missedMidnights(
    ms("2011-12-29T10:00:00Z"), ms("2011-12-31T10:00:00Z"), "Pacific/Apia"
  )), ["2011-12-30T10:00:00.000Z", "2011-12-31T10:00:00.000Z"]);
  assert.deepEqual(isoList(missedMidnights(
    ms("2026-10-31T04:00:00Z"), ms("2026-11-02T05:00:00Z"), "America/Havana"
  )), ["2026-11-01T04:00:00.000Z", "2026-11-02T05:00:00.000Z"]);
});

test("Catch-up interval is open on lastTickMs and closed on nowMs", () => {
  const start = ms("2026-10-07T20:00:00Z");
  assert.deepEqual(missedMidnights(start, start, "Asia/Muscat"), []);
  assert.deepEqual(missedMidnights(start, start - 1, "Asia/Muscat"), []);
  assert.deepEqual(missedMidnights(start, start + DAY_MS - 1, "Asia/Muscat"), []);
  assert.deepEqual(missedMidnights(start, start + DAY_MS, "Asia/Muscat"), [start + DAY_MS]);
  assert.deepEqual(missedMidnights(start + DAY_MS, start + DAY_MS, "Asia/Muscat"), []);
  assert.deepEqual(missedMidnights(start + 123, start + DAY_MS, "Asia/Muscat"), [start + DAY_MS]);
  assert.deepEqual(missedMidnights(start, start + DAY_MS, "Asia/Muscat", 0), []);
  assert.deepEqual(missedMidnights(start, start + 3 * DAY_MS, "Asia/Muscat", 1), [start + DAY_MS]);
});

test("Changing from Muscat to Berlin recomputes the alarm in the new zone", () => {
  const now = ms("2026-10-07T19:00:00Z");
  assert.equal(nextLocalMidnight(now, "Asia/Muscat"), ms("2026-10-07T20:00:00Z"));
  assert.equal(nextLocalMidnight(now, "Europe/Berlin"), ms("2026-10-07T22:00:00Z"));
  const duringTransition = ms("2026-10-25T00:30:00Z");
  assert.equal(nextLocalMidnight(duringTransition, "Asia/Muscat"), ms("2026-10-25T20:00:00Z"));
  assert.equal(nextLocalMidnight(duringTransition, "Europe/Berlin"), ms("2026-10-25T23:00:00Z"));
});

test("Timezone-change day-key guard suppresses a repeated day after westward travel", () => {
  const lastMidnightKey = localDayKey(ms("2026-10-07T20:00:00Z"), "Asia/Muscat");
  const newAlarm = nextLocalMidnight(ms("2026-10-07T21:00:00Z"), "Europe/Berlin");
  assert.equal(newAlarm, ms("2026-10-07T22:00:00Z"));
  assert.equal(localDayKey(newAlarm, "Europe/Berlin"), lastMidnightKey);
  assert.ok(localDayKey(nextLocalMidnight(newAlarm, "Europe/Berlin"), "Europe/Berlin") > lastMidnightKey);
});

test("IANA validation accepts named zones and aliases, rejects bad or default zones", () => {
  for (const tz of ["Asia/Muscat", "Europe/Berlin", "Asia/Kathmandu", "UTC", "Etc/GMT+4", "US/Eastern"]) {
    assert.equal(isValidTimeZone(tz), true, tz);
  }
  for (const tz of ["", "Mars/Olympus", "Europe/Berln", " Europe/Berlin", "+04:00", "-0530"]) {
    assert.equal(isValidTimeZone(tz), false, tz);
    assert.throws(() => nextLocalMidnight(0, tz), RangeError);
  }
  assert.equal(isValidTimeZone(undefined as unknown as string), false);
  assert.equal(isValidTimeZone(null as unknown as string), false);
});

test("Invalid instants and catch-up limits fail explicitly", () => {
  for (const invalid of [NaN, Infinity, -Infinity, 8.64e15 + 1]) {
    assert.throws(() => localDateParts(invalid, "UTC"), RangeError);
    assert.throws(() => localDayKey(invalid, "UTC"), RangeError);
    assert.throws(() => nextLocalMidnight(invalid, "UTC"), RangeError);
    assert.throws(() => missedMidnights(invalid, 0, "UTC"), RangeError);
    assert.throws(() => missedMidnights(0, invalid, "UTC"), RangeError);
  }
  for (const invalid of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => missedMidnights(0, DAY_MS, "UTC", invalid), RangeError);
  }
});

test("Intl hour 24 is normalized without incrementing its printed date", () => {
  const original = Intl.DateTimeFormat.prototype.formatToParts;
  const spy = vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts").mockImplementation(function (
    this: Intl.DateTimeFormat, value?: number | Date
  ) {
    return original.call(this, value).map(part =>
      part.type === "hour" && part.value === "00" ? { ...part, value: "24" } : part
    );
  });
  try {
  const boundary = ms("2026-10-07T20:00:00Z");
  assert.equal(localDateParts(boundary, "Asia/Muscat").hour, 0);
  assert.equal(localDayKey(boundary, "Asia/Muscat"), "2026-10-08");
  assert.equal(nextLocalMidnight(boundary - 1, "Asia/Muscat"), boundary);
  assert.equal(nextLocalMidnight(boundary, "Asia/Muscat"), boundary + DAY_MS);
  } finally {
    spy.mockRestore();
  }
});

test("Calendar arithmetic avoids the Date.UTC year 0..99 remap", () => {
  expectBoundary("0099-12-31T23:59:59.999Z", "UTC", "0100-01-01T00:00:00Z");
  assert.equal(localDayKey(ms("0001-01-01T12:00:00Z"), "UTC"), "0001-01-01");
});

test("Negative epoch timestamps preserve the millisecond boundary", () => {
  expectBoundary("1969-12-31T23:59:59.999Z", "UTC", "1970-01-01T00:00:00Z");
});

test("Every 2026 boundary matches the next calendar date in seven representative zones", () => {
  const zones = [
    "Asia/Muscat", "Europe/Berlin", "America/New_York", "Asia/Kolkata",
    "Asia/Kathmandu", "Australia/Lord_Howe", "America/Sao_Paulo"
  ];
  for (const tz of zones) {
    let cursor = nextLocalMidnight(ms("2025-12-30T12:00:00Z"), tz);
    for (let i = 0; i < 367; i += 1) {
      const currentParts = localDateParts(cursor, tz);
      const expectedDate = new Date(Date.UTC(currentParts.year, currentParts.month - 1, currentParts.day + 1));
      const next = nextLocalMidnight(cursor, tz);
      assert.equal(localDayKey(next, tz), expectedDate.toISOString().slice(0, 10), tz);
      assert.equal(localDateParts(next, tz).hour, 0, tz);
      assert.equal(nextLocalMidnight(next - 1, tz), next, tz);
      assert.equal(localDayKey(next - 1, tz), localDayKey(cursor, tz), tz);
      assert.ok(next > cursor, tz);
      cursor = next;
    }
  }
});
