import { describe, expect, it } from "vitest";
import { FIRST_SIGHT_MS, LIST_MAX, MOMENT_KINDS, lastIdKey, momentsOf, pickNew, recent, type Moment, type MomentKind } from "../src/moments";
import { momentLine, momentNum } from "../src/copy";

const NOW = 1_760_000_000_000;
const m = (id: number, kind: MomentKind = "best_day", ago = 0, value = 7420): Moment => ({ id, kind, at_ms: NOW - ago, value });

describe("momentsOf", () => {
  it("treats a missing field as no moments (before B12 lands)", () => {
    expect(momentsOf({})).toEqual([]);
    expect(momentsOf(null)).toEqual([]);
    expect(momentsOf({ moments: "x" })).toEqual([]);
  });
  it("keeps valid known moments, ascending", () => {
    const got = momentsOf({ moments: [m(3), m(1), { id: 2, kind: "party", at_ms: NOW, value: 1 }, { id: 4.5, kind: "streak", at_ms: NOW, value: 3 }] });
    expect(got.map((x) => x.id)).toEqual([1, 3]);
  });
});

describe("pickNew", () => {
  it("shows everything above the last id, in order, and remembers the top", () => {
    const r = pickNew([m(1), m(2), m(3)], 1, NOW);
    expect(r.show.map((x) => x.id)).toEqual([2, 3]);
    expect(r.lastId).toBe(3);
  });
  it("shows at most the newest three after a long absence", () => {
    const r = pickNew([1, 2, 3, 4, 5, 6].map((i) => m(i)), 0, NOW);
    expect(r.show.map((x) => x.id)).toEqual([4, 5, 6]);
    expect(r.lastId).toBe(6);
  });
  it("shows nothing new twice", () => {
    expect(pickNew([m(1), m(2)], 2, NOW)).toEqual({ show: [], lastId: 2 });
  });
  it("no moments keeps the remembered id", () => {
    expect(pickNew([], 7, NOW)).toEqual({ show: [], lastId: 7 });
  });
  it("a Truffle first seen with no moments shows every later one, in order", () => {
    const first = pickNew([], null, NOW);
    expect(first).toEqual({ show: [], lastId: 0 });
    expect(pickNew([m(1, "stage_up"), m(2, "day_10k"), m(3, "lifetime")], first.lastId, NOW).show.map((x) => x.kind)).toEqual(["stage_up", "day_10k", "lifetime"]);
  });
  it("first sight shows only the newest, and only when fresh", () => {
    expect(pickNew([m(1, "streak", 1000), m(2, "best_day", 1000)], null, NOW).show.map((x) => x.id)).toEqual([2]);
    expect(pickNew([m(1), m(2, "best_day", FIRST_SIGHT_MS + 1)], null, NOW)).toEqual({ show: [], lastId: 2 });
  });
  it("a reset Truffle (ids went backwards) starts over like first sight", () => {
    expect(pickNew([m(1)], 9, NOW)).toEqual({ show: [m(1)], lastId: 1 });
  });
  it("keys the last id per phrase", () => {
    expect(lastIdKey("sand-moon-fig")).not.toBe(lastIdKey("olive-kite-reef"));
  });
});

describe("recent", () => {
  it("is newest first, at most five", () => {
    const all = [1, 2, 3, 4, 5, 6, 7].map((i) => m(i));
    expect(recent(all).map((x) => x.id)).toEqual([7, 6, 5, 4, 3]);
    expect(LIST_MAX).toBe(5);
  });
});

describe("moment lines: fixed copy in Truffle's quiet voice", () => {
  const VALUES: Record<MomentKind, number> = { stage_up: 1, best_day: 7420, beat_avg7: 6100, day_10k: 10240, streak: 7, lifetime: 50000, heat_day_indoor: 2300 };
  it("matches the packet's example in both languages", () => {
    expect(momentLine("en", "best_day", 7420)).toBe("best day this week. 7,420 steps.");
    expect(momentLine("ar", "best_day", 7420)).toBe("أفضل يوم هالأسبوع. ٧٬٤٢٠ خطوة.");
  });
  it("uses Arabic-Indic digits in Arabic and Latin digits in English", () => {
    expect(momentNum("ar", 50000)).toBe("٥٠٬٠٠٠");
    expect(momentNum("en", 50000)).toBe("50,000");
  });
  it("names the stage on stage_up", () => {
    expect(momentLine("en", "stage_up", 1)).toBe("it grew. sprout now.");
    expect(momentLine("en", "stage_up", 3)).toBe("it grew. elder now.");
    expect(momentLine("ar", "stage_up", 2)).toBe("كبر. صار فقعة.");
  });
  for (const lang of ["en", "ar"] as const) {
    for (const kind of MOMENT_KINDS) {
      it(`${lang} ${kind}: no dashes, no exclamation, no emoji, no uppercase, has its number`, () => {
        const line = momentLine(lang, kind, VALUES[kind]);
        expect(line.length).toBeGreaterThan(5);
        expect(line).not.toMatch(/[\u2013\u2014!\u00a1]/);
        expect(line).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(line).toBe(line.toLowerCase());
        expect(line.endsWith(".")).toBe(true);
        if (kind !== "stage_up") expect(line).toContain(momentNum(lang, VALUES[kind]));
      });
    }
  }
});
