import { describe, expect, it } from "vitest";
import { daysBetween, isValidTimeZone, localDayKey, localDateParts, missedMidnights, nextDayKey, nextLocalMidnight } from "../src/time";

const iso = (ms: number) => new Date(ms).toISOString();
const H = 3_600_000;

describe("localDayKey", () => {
  it("Muscat is UTC+4 all year", () => {
    expect(localDayKey(Date.parse("2026-10-07T19:59:59Z"), "Asia/Muscat")).toBe("2026-10-07");
    expect(localDayKey(Date.parse("2026-10-07T20:00:00Z"), "Asia/Muscat")).toBe("2026-10-08");
  });
  it("never reports hour 24", () => {
    const p = localDateParts(Date.parse("2026-10-07T20:00:00Z"), "Asia/Muscat");
    expect(p.hour).toBe(0);
  });
});

describe("nextLocalMidnight", () => {
  it("Asia/Muscat: 20:00Z the same or next UTC day", () => {
    expect(iso(nextLocalMidnight(Date.parse("2026-10-07T10:00:00Z"), "Asia/Muscat"))).toBe("2026-10-07T20:00:00.000Z");
    expect(iso(nextLocalMidnight(Date.parse("2026-10-07T20:00:00Z"), "Asia/Muscat"))).toBe("2026-10-08T20:00:00.000Z");
  });
  it("Asia/Muscat across 2026-10-25 and 2026-03-29 (no DST)", () => {
    expect(iso(nextLocalMidnight(Date.parse("2026-10-25T12:00:00Z"), "Asia/Muscat"))).toBe("2026-10-25T20:00:00.000Z");
    expect(iso(nextLocalMidnight(Date.parse("2026-03-29T12:00:00Z"), "Asia/Muscat"))).toBe("2026-03-29T20:00:00.000Z");
  });
  it("Europe/Berlin before and after DST end 2026-10-25", () => {
    // Oct 24 is CEST (+2): midnight Oct 25 = 22:00Z Oct 24.
    expect(iso(nextLocalMidnight(Date.parse("2026-10-24T12:00:00Z"), "Europe/Berlin"))).toBe("2026-10-24T22:00:00.000Z");
    // Oct 25 is the 25-hour day: midnight Oct 26 (CET, +1) = 23:00Z Oct 25.
    expect(iso(nextLocalMidnight(Date.parse("2026-10-25T12:00:00Z"), "Europe/Berlin"))).toBe("2026-10-25T23:00:00.000Z");
    // Inside the repeated hour (02:30 CEST then CET).
    expect(iso(nextLocalMidnight(Date.parse("2026-10-25T00:30:00Z"), "Europe/Berlin"))).toBe("2026-10-25T23:00:00.000Z");
    expect(iso(nextLocalMidnight(Date.parse("2026-10-25T01:30:00Z"), "Europe/Berlin"))).toBe("2026-10-25T23:00:00.000Z");
  });
  it("Europe/Berlin around DST start 2026-03-29", () => {
    // Mar 28 is CET (+1): midnight Mar 29 = 23:00Z Mar 28.
    expect(iso(nextLocalMidnight(Date.parse("2026-03-28T12:00:00Z"), "Europe/Berlin"))).toBe("2026-03-28T23:00:00.000Z");
    // Mar 29 is the 23-hour day: midnight Mar 30 (CEST, +2) = 22:00Z Mar 29.
    expect(iso(nextLocalMidnight(Date.parse("2026-03-29T12:00:00Z"), "Europe/Berlin"))).toBe("2026-03-29T22:00:00.000Z");
    expect(iso(nextLocalMidnight(Date.parse("2026-03-29T01:30:00Z"), "Europe/Berlin"))).toBe("2026-03-29T22:00:00.000Z");
  });
  it("is strictly after the input and lands on local 00:00", () => {
    for (const tz of ["Asia/Muscat", "Europe/Berlin", "America/New_York", "Australia/Lord_Howe", "Asia/Kolkata"]) {
      let t = Date.parse("2026-01-01T00:00:00Z");
      for (let i = 0; i < 400; i++) {
        const m = nextLocalMidnight(t, tz);
        expect(m).toBeGreaterThan(t);
        const p = localDateParts(m, tz);
        expect([p.hour, p.minute, p.second]).toEqual([0, 0, 0]);
        expect(localDayKey(m - 1, tz)).not.toBe(localDayKey(m, tz));
        t = m + 7 * H;
      }
    }
  });
  it("handles a zone whose midnight does not exist (America/Santiago DST start)", () => {
    // Chile springs forward at 00:00 local; the day starts at 01:00.
    const t = Date.parse("2026-09-05T12:00:00Z");
    const m = nextLocalMidnight(t, "America/Santiago");
    expect(localDayKey(m, "America/Santiago")).toBe("2026-09-06");
    expect(localDayKey(m - 1, "America/Santiago")).toBe("2026-09-05");
  });
});

describe("missedMidnights", () => {
  it("none when no midnight passed", () => {
    expect(missedMidnights(Date.parse("2026-10-07T10:00:00Z"), Date.parse("2026-10-07T19:00:00Z"), "Asia/Muscat")).toEqual([]);
  });
  it("counts every midnight in (last, now], oldest first", () => {
    const r = missedMidnights(Date.parse("2026-10-07T10:00:00Z"), Date.parse("2026-10-10T20:00:00Z"), "Asia/Muscat");
    expect(r.map(iso)).toEqual([
      "2026-10-07T20:00:00.000Z",
      "2026-10-08T20:00:00.000Z",
      "2026-10-09T20:00:00.000Z",
      "2026-10-10T20:00:00.000Z"
    ]);
  });
  it("caps at max", () => {
    const r = missedMidnights(Date.parse("2026-01-01T00:00:00Z"), Date.parse("2026-03-01T00:00:00Z"), "Asia/Muscat", 14);
    expect(r).toHaveLength(14);
  });
  it("Berlin across DST end gives 23:00Z after the switch", () => {
    const r = missedMidnights(Date.parse("2026-10-24T12:00:00Z"), Date.parse("2026-10-26T12:00:00Z"), "Europe/Berlin");
    expect(r.map(iso)).toEqual(["2026-10-24T22:00:00.000Z", "2026-10-25T23:00:00.000Z"]);
  });
  it("a double fire at the same instant is empty", () => {
    const mid = Date.parse("2026-10-07T20:00:00Z");
    expect(missedMidnights(mid, mid, "Asia/Muscat")).toEqual([]);
  });
});

describe("helpers", () => {
  it("day keys", () => {
    expect(nextDayKey("2026-12-31")).toBe("2027-01-01");
    expect(daysBetween("2026-10-01", "2026-10-08")).toBe(7);
    expect(daysBetween("2026-10-08", "2026-10-08")).toBe(0);
  });
  it("validates time zones", () => {
    expect(isValidTimeZone("Asia/Muscat")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });
});
