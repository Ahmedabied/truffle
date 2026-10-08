import { describe, expect, it } from "vitest";
import { AWAY_MS, KEEPSAKES, giftText, readShelf, returnToShelf, shelfKey } from "../src/keepsakes";

const now = Date.UTC(2026, 9, 9, 12);
const day = "2026-10-09";
describe("away keepsakes", () => {
  it("does not invent an absence for a first visit", () => {
    expect(returnToShelf(null, now, day, "pet", true).gift).toBeUndefined();
  });
  it("requires ten minutes away, including on a rest day with no steps", () => {
    const shelf = { version: 1, seen: now, gifts: [] };
    expect(returnToShelf(shelf, now + AWAY_MS - 1, day, "pet", true).gift).toBeUndefined();
    expect(returnToShelf(shelf, now + AWAY_MS, day, "pet", true).gift).toBeDefined();
  });
  it("never awards another on the same day, on rollback, or for a dead pet", () => {
    const result = returnToShelf({ version: 1, seen: now - AWAY_MS, gifts: [] }, now, day, "pet", true);
    expect(returnToShelf(result.shelf, now + AWAY_MS, day, "pet", true).gift).toBeUndefined();
    expect(returnToShelf(result.shelf, now - 1, "2026-10-08", "pet", true).gift).toBeUndefined();
    expect(returnToShelf(result.shelf, now + 86400_000, "2026-10-10", "pet", false).gift).toBeUndefined();
  });
  it("varies consecutive gifts and bounds persistent history", () => {
    let shelf = readShelf(null);
    shelf.seen = now - AWAY_MS;
    let previous: string | undefined;
    for (let n = 0; n < 30; n++) {
      const stamp = now + n * 86400_000;
      const r = returnToShelf(shelf, stamp, new Date(stamp).toISOString().slice(0, 10), "pet", true);
      expect(r.gift).toBeDefined();
      expect(r.gift!.kind).not.toBe(previous);
      previous = r.gift!.kind;
      shelf = r.shelf;
    }
    expect(shelf.gifts).toHaveLength(12);
  });
  it("isolates origins, pets and demonstrations", () => {
    expect(new Set([shelfKey("https://one.test", "a", false), shelfKey("https://one.test", "a", true), shelfKey("https://one.test", "b", false), shelfKey("https://two.test", "a", false)]).size).toBe(4);
  });
  it("rejects corrupted storage and has both languages for every gift", () => {
    expect(readShelf({ version: 1, seen: "yesterday", gifts: [null, { kind: "bad", day, at: now }] })).toEqual({ version: 1, seen: 0, gifts: [] });
    for (const k of KEEPSAKES) for (const lang of ["en", "ar"] as const) {
      const text = giftText({ kind: k.id, day, at: now }, lang);
      expect(text.name.length).toBeGreaterThan(0);
      expect(text.note.length).toBeGreaterThan(0);
      expect(text.art.length).toBeGreaterThan(0);
    }
  });
});
