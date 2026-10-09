import { describe, expect, it } from "vitest";
import { DEFAULT_STATE } from "../src/engine";
import {
  admitGift, cancelGift, generateGift, giftSummary, resetGifts, settleGift, validGift,
  type GiftContext, type GiftJob, type GiftLedger, type GiftRequest
} from "../src/gifts";

const start = Date.parse("2026-10-09T08:00:00Z");
const context = (now_ms = start, day = "2026-10-09", generation = 2): GiftContext => ({
  now_ms, day, generation, pet: { stage: "Sprout", dead: false }
});
const request = (id = "gift-a", seed = "a-fresh-random-seed"): GiftRequest => ({
  id, seed, intent: "rest", client_request_id: `request-${id}`
});
const empty = (): GiftLedger => ({ gifts: [] });
function started(ctx = context(), req = request(), ledger = empty()): GiftLedger {
  const result = admitGift(ledger, ctx, req);
  if (!result.ok) throw new Error(result.reason);
  return result.ledger;
}
function job(seed = "a-fresh-random-seed"): GiftJob {
  return started(context(), request("gift-a", seed)).job!;
}

describe("procedural keepsakes", () => {
  it("retries reproduce the stored drawing and bilingual authored note without changing the pet", () => {
    const pet = Object.freeze({ ...DEFAULT_STATE, stage: "Sprout" as const });
    const original = JSON.stringify(pet);
    const input = Object.freeze(job());
    const first = generateGift(input, pet, start + 600_001, "2026-10-09");
    expect(generateGift(input, pet, start + 600_001, "2026-10-09")).toEqual(first);
    expect(first).toMatchObject({
      id: "gift-a", generation: 2, day: "2026-10-09", created_ms: start + 600_001,
      provenance: { art: "procedural", note: "authored", version: 1 }
    });
    expect(first.text.en.name.length).toBeGreaterThan(3);
    expect(first.text.ar.name).toMatch(/[\u0600-\u06ff]/);
    expect(first.text.ar.note).toMatch(/[\u0600-\u06ff]/);
    expect(JSON.stringify(pet)).toBe(original);
    expect(JSON.stringify(first)).not.toContain(input.seed);
  });

  it("composes fresh, bounded ASCII geometry in all four craft families across many seeds", () => {
    const families = new Map<string, Set<string>>();
    for (let i = 0; i < 2_000; i++) {
      const gift = generateGift(job(`independent-admission-seed-${i}`), context().pet);
      const lines = gift.art.split("\n");
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(lines.length).toBeLessThanOrEqual(7);
      for (const line of lines) expect(line).toMatch(/^[\x20-\x7e]{1,12}$/);
      expect(gift.art.replace(/\s/g, "").length).toBeGreaterThan(12);
      expect(validGift(gift)).toBe(true);
      const drawings = families.get(gift.text.en.name) ?? new Set<string>();
      drawings.add(gift.art);
      families.set(gift.text.en.name, drawings);
    }
    expect(families.size).toBe(4);
    // A catalog or a token stamped on a fixed drawing cannot meet this bar.
    for (const drawings of families.values()) expect(drawings.size).toBeGreaterThan(350);
    expect([...families.values()].reduce((total, drawings) => total + drawings.size, 0)).toBeGreaterThan(1_850);
  });

  it("uses declared intent and stage without claiming sensed outdoor facts", () => {
    const base = job();
    for (const intent of ["walk", "errand", "rest"] as const) {
      const gift = generateGift({ ...base, intent }, { stage: "Elder", dead: false });
      expect(gift.text.en.note).toMatch(/(?:walk|errand|rest)/i);
      expect(gift.text.en.note).not.toMatch(/(?:you walked|you went|your steps|your route|sunshine|you feel|your health)/i);
      expect(gift.text.en.note.length).toBeLessThanOrEqual(280);
      expect(gift.text.ar.note.length).toBeLessThanOrEqual(280);
    }
    expect(generateGift(base, { stage: "Spore", dead: false }).text)
      .not.toEqual(generateGift(base, { stage: "Elder", dead: false }).text);
  });

  it("rejects malformed art and unsafe or oversized text", () => {
    const gift = generateGift(job(), context().pet);
    for (const art of ["", "1234567890123", "x\n".repeat(7) + "x", "x\tx", "x\rx", "🍄", "  "])
      expect(validGift({ ...gift, art })).toBe(false);
    for (const note of ["", "x".repeat(281), "hi\u0000there", "<script>alert(1)</script>"])
      expect(validGift({ ...gift, text: { ...gift.text, en: { name: "Garden", note } } })).toBe(false);
  });

  it("rejects unsupported generators and unbounded admission seed input", () => {
    expect(() => generateGift({ ...job(), generator_version: 999 } as unknown as GiftJob, context().pet)).toThrow();
    expect(() => generateGift({ ...job(), seed: "x".repeat(129) }, context().pet)).toThrow();
    expect(() => generateGift(job(), { stage: "Spore", dead: true })).toThrow();
  });
});

describe("pure gift lifecycle", () => {
  it("admits only one pending job and keeps the original due time on retries", () => {
    const ledger = started();
    expect(ledger.job).toMatchObject({ state: "scheduled", created_ms: start, due_ms: start + 600_000, expires_ms: start + 86_400_000 });
    for (const req of [request(), request("another")]) {
      const retry = admitGift(ledger, context(start + 100_000), req);
      expect(retry.ok).toBe(true);
      if (retry.ok) expect(retry.job).toEqual(ledger.job);
    }
  });

  it("creates after ten minutes in background and repeated settlement preserves exact bytes", () => {
    const pending = started();
    expect(settleGift(pending, context(start + 599_999)).gifts).toHaveLength(0);
    const ready = settleGift(pending, context(start + 600_000));
    expect(ready.job?.state).toBe("ready");
    expect(ready.gifts).toHaveLength(1);
    expect(ready.gifts[0].created_ms).toBe(start + 600_000);
    expect(ready.last_gift_day).toBe("2026-10-09");
    expect(settleGift(ready, context(start + 900_000))).toEqual(ready);
    expect(cancelGift(ready)).toEqual(ready);
  });

  it("cancels an early return and permits a later fresh ten-minute wait", () => {
    const cancelled = cancelGift(started());
    expect(cancelled.job?.state).toBe("cancelled");
    expect(settleGift(cancelled, context(start + 600_000)).gifts).toHaveLength(0);
    const later = started(context(start + 100_000), request("later"), cancelled);
    expect(later.job?.due_ms).toBe(start + 700_000);
    expect(settleGift(later, context(start + 600_000)).gifts).toHaveLength(0);
    expect(settleGift(later, context(start + 700_000)).gifts).toHaveLength(1);
  });

  it("replays a terminal request id without reopening its cancelled job", () => {
    const cancelled = cancelGift(started());
    const retry = admitGift(cancelled, context(start + 100), request());
    expect(retry.ok).toBe(true);
    if (retry.ok) expect(retry.job.state).toBe("cancelled");
  });

  it("pins the completion day and blocks another gift that day after reset", () => {
    const late = context(Date.parse("2026-10-09T23:55:00Z"));
    const ready = settleGift(started(late), context(late.now_ms + 600_000, "2026-10-10"));
    expect(ready.gifts[0].day).toBe("2026-10-10");
    const reset = resetGifts(ready);
    expect(reset.gifts).toEqual([]);
    expect(reset.job).toBeUndefined();
    expect(reset.last_gift_day).toBe("2026-10-10");
    const denied = admitGift(reset, context(late.now_ms + 700_000, "2026-10-10", 3), request("new-life"));
    expect(denied).toMatchObject({ ok: false, reason: "daily_limit" });
  });

  it("fences clock rollback, including after reset and retention pruning", () => {
    const ready = settleGift(started(), context(start + 600_000));
    const reset = resetGifts(ready);
    expect(admitGift(reset, context(start - 1, "2026-10-08", 3), request("backwards")))
      .toMatchObject({ ok: false, reason: "clock_rollback" });
    expect(admitGift(reset, context(start + 700_000, "2026-10-08", 3), request("old-day")))
      .toMatchObject({ ok: false, reason: "daily_limit" });
  });

  it("expires unstarted jobs at 24 hours and does not catch up historical gifts", () => {
    const expired = settleGift(started(), context(start + 86_400_000, "2026-10-10"));
    expect(expired.job?.state).toBe("expired");
    expect(expired.gifts).toEqual([]);
    expect(settleGift(expired, context(start + 172_800_000, "2026-10-11")).gifts).toEqual([]);
    expect(started(context(start + 86_400_001, "2026-10-10"), request("tomorrow"), expired).job?.state).toBe("scheduled");
  });

  it("cancels dead or stale-generation work while allowing zero-food and sheltered living pets", () => {
    const pending = started();
    for (const ctx of [context(start + 600_000, "2026-10-09", 3), { ...context(start + 600_000), pet: { stage: "Sprout" as const, dead: true } }]) {
      const result = settleGift(pending, ctx);
      expect(result.job?.state).toBe("cancelled");
      expect(result.gifts).toEqual([]);
    }
    const pet = { ...DEFAULT_STATE, energy: 0, burrowed: true };
    expect(settleGift(started(), { ...context(start + 600_000), pet }).gifts).toHaveLength(1);
    expect(admitGift(empty(), { ...context(), pet: { ...pet, dead: true } }, request()))
      .toMatchObject({ ok: false, reason: "dead" });
    expect(pet.energy).toBe(0);
  });

  it("rechecks the completion slot before creating and fails a bad generator terminally", () => {
    const pending = started();
    const occupied = settleGift({ ...pending, last_gift_day: "2026-10-09" }, context(start + 600_000));
    expect(occupied.gifts).toEqual([]);
    expect(occupied.job?.state).toBe("cancelled");
    const broken = settleGift({ ...pending, job: { ...pending.job!, seed: "" } }, context(start + 600_000));
    expect(broken.gifts).toEqual([]);
    expect(broken.job?.state).toBe("cancelled");
    expect(settleGift(broken, context(start + 700_000))).toEqual(broken);
  });

  it("keeps twelve gifts while the daily fence survives collection retention", () => {
    let ledger = empty();
    for (let i = 0; i < 15; i++) {
      const day = `2026-10-${String(i + 10).padStart(2, "0")}`;
      const now = start + i * 86_400_000;
      ledger = started(context(now, day), request(`gift-${i}`), ledger);
      ledger = settleGift(ledger, context(now + 600_000, day));
    }
    expect(ledger.gifts).toHaveLength(12);
    expect(ledger.gifts[0].id).toBe("gift-3");
    expect(ledger.gifts[11].id).toBe("gift-14");
    expect(ledger.last_gift_day).toBe("2026-10-24");
    expect(giftSummary(ledger, 2).gifts).toEqual(ledger.gifts);
    expect(giftSummary(ledger, 3)).toEqual({ generation: 3, pending: null, gifts: [] });
  });

  it("limits cancel/restart loops to 30 admissions per hour and reset preserves the rate", () => {
    let ledger = empty();
    for (let i = 0; i < 30; i++) ledger = cancelGift(started(context(start + i), request(`loop-${i}`), ledger));
    const denied = admitGift(resetGifts(ledger), context(start + 30), request("too-many"));
    expect(denied).toMatchObject({ ok: false, reason: "rate_limited", retry_after_s: 3600 });
    expect(started(context(start + 3_600_000), request("after-window"), ledger).job?.state).toBe("scheduled");
  });

  it("exposes only current-generation gifts and the small pending receipt", () => {
    const ledger = started();
    expect(giftSummary(ledger, 2)).toEqual({
      generation: 2, pending: { id: "gift-a", intent: "rest", due_ms: start + 600_000 }, gifts: []
    });
    expect(JSON.stringify(giftSummary(ledger, 2))).not.toContain("seed");
    expect(JSON.stringify(giftSummary(ledger, 2))).not.toContain("client_request_id");
  });
});
