import assert from "node:assert/strict";
import { localDateParts, localDayKey, nextLocalMidnight, missedMidnights, isValidTimeZone } from "./time.js";

// Extra smoke coverage in the installed workerd runtime. The copy-ready Node
// suite remains time.test.ts. No network services or persistent storage used.
export default {
  test() {
    const cases = [
      ["Asia/Muscat", "2026-10-07T19:00:00Z", "2026-10-07T20:00:00Z"],
      ["Europe/Berlin", "2026-10-07T19:00:00Z", "2026-10-07T22:00:00Z"],
      ["Europe/Berlin", "2026-03-28T23:00:00Z", "2026-03-29T22:00:00Z"],
      ["Europe/Berlin", "2026-10-24T22:00:00Z", "2026-10-25T23:00:00Z"],
      ["America/New_York", "2026-11-01T04:00:00Z", "2026-11-02T05:00:00Z"],
      ["Asia/Kolkata", "2026-10-07T12:00:00Z", "2026-10-07T18:30:00Z"],
      ["Asia/Kathmandu", "2026-10-07T12:00:00Z", "2026-10-07T18:15:00Z"],
      ["Australia/Lord_Howe", "2026-04-04T13:00:00Z", "2026-04-05T13:30:00Z"],
      ["Australia/Lord_Howe", "2026-10-03T13:30:00Z", "2026-10-04T13:00:00Z"],
      ["America/Sao_Paulo", "2018-11-03T12:00:00Z", "2018-11-04T03:00:00Z"],
      ["America/Sao_Paulo", "2018-11-04T03:00:00Z", "2018-11-05T02:00:00Z"],
      ["America/Havana", "2026-10-31T12:00:00Z", "2026-11-01T04:00:00Z"],
      ["America/Havana", "2026-11-01T04:00:00Z", "2026-11-02T05:00:00Z"],
      ["Pacific/Apia", "2011-12-29T12:00:00Z", "2011-12-30T10:00:00Z"],
      ["UTC", "0099-12-31T23:59:59.999Z", "0100-01-01T00:00:00Z"]
    ];
    for (const [tz, from, expected] of cases) {
      const next = nextLocalMidnight(Date.parse(from), tz);
      assert.equal(next, Date.parse(expected), `${tz}: ${from}`);
      assert.notEqual(localDayKey(next - 1, tz), localDayKey(next, tz));
      assert.equal(nextLocalMidnight(next - 1, tz), next);
    }
    assert.equal(localDateParts(Date.parse("2018-11-04T03:00:00Z"), "America/Sao_Paulo").hour, 1);
    assert.equal(localDateParts(Date.parse("2026-10-07T20:00:00Z"), "Asia/Muscat").hour, 0);
    assert.equal(localDateParts(Date.parse("2026-10-07T20:00:00Z"), "Asia/Muscat").weekday, 4);
    assert.equal(isValidTimeZone("Europe/Berlin"), true);
    assert.equal(isValidTimeZone("Mars/Olympus"), false);
    assert.equal(isValidTimeZone("+04:00"), false);
    const start = Date.parse("2026-08-31T20:00:00Z");
    const debt = missedMidnights(start, Date.parse("2026-09-30T20:00:00Z"), "Asia/Muscat");
    assert.deepEqual(debt, Array.from({ length: 14 }, (_, i) => start + (i + 1) * 86_400_000));
    assert.deepEqual(missedMidnights(
      Date.parse("2026-10-23T22:00:00Z"), Date.parse("2026-10-26T23:00:00Z"), "Europe/Berlin"
    ), ["2026-10-24T22:00:00Z", "2026-10-25T23:00:00Z", "2026-10-26T23:00:00Z"].map(Date.parse));
    let boundaries = 0;
    for (const tz of ["Asia/Muscat", "Europe/Berlin", "America/New_York", "Asia/Kolkata", "Asia/Kathmandu", "Australia/Lord_Howe", "America/Sao_Paulo"]) {
      let cursor = nextLocalMidnight(Date.parse("2025-12-30T12:00:00Z"), tz);
      for (let i = 0; i < 367; i += 1) {
        const p = localDateParts(cursor, tz);
        const expected = new Date(Date.UTC(p.year, p.month - 1, p.day + 1)).toISOString().slice(0, 10);
        const next = nextLocalMidnight(cursor, tz);
        assert.equal(localDayKey(next, tz), expected, tz);
        assert.equal(nextLocalMidnight(next - 1, tz), next, tz);
        assert.equal(localDateParts(next, tz).hour, 0, tz);
        cursor = next;
        boundaries += 1;
      }
    }
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Muscat", hour: "2-digit", hourCycle: "h23"
    });
    const midnightHour = formatter.formatToParts(Date.parse("2026-10-07T20:00:00Z"))
      .find(part => part.type === "hour").value;
    console.log(`PASS: ${cases.length} exact fixtures, catch-up checks, ${boundaries} calendar boundaries; h23 midnight=${midnightHour}`);
  }
};
