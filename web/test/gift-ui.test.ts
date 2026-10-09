import { describe, expect, it } from "vitest";
import { generateGift, type GiftJob } from "../../worker/src/gifts";
import { activeGifts, giftProvenance, mergeGifts, previewGift, readGiftDisplayState, readShelf, updateGiftDisplayState } from "../src/keepsakes";
import { COPY, explainChat, explainMidnight, foodSummary, replyFoodEstimate } from "../src/copy";

const at = Date.UTC(2026, 9, 9, 12);
const day = "2026-10-09";
const job: GiftJob = {
  id: "a-real-job", seed: "fresh-seed", generation: 3, day, intent: "rest",
  created_ms: at, due_ms: at + 600_000, expires_ms: at + 86_400_000,
  generator_version: 1, state: "ready"
};
const serverGift = generateGift(job, { stage: "Spore", dead: false });
const shelf = readShelf({ version: 1, seen: at, gifts: [{ kind: "fern", day, at }] });
const display = { serverCapable: true, generation: 3, legacyAfter: 0 };

describe("gift display adapters", () => {
  it("preserves a legacy gift and a server gift even on the same day and timestamp", () => {
    const gifts = mergeGifts(shelf, [{ ...serverGift, created_ms: at }], display);
    expect(gifts).toHaveLength(2);
    expect(new Set(gifts.map(gift => gift.id)).size).toBe(2);
    expect(gifts.find(gift => gift.source === "legacy")?.archived).toBe(true);
    expect(activeGifts(gifts).map(gift => gift.source)).toEqual(["server"]);
    expect(shelf.gifts).toHaveLength(1);
  });

  it("uses the pinned gift day and stable identities across order, translation and retries", () => {
    const nextDay = { ...serverGift, id: "second-job", day: "2026-10-10" };
    const first = mergeGifts(shelf, [serverGift, nextDay, serverGift], display);
    const retried = mergeGifts(shelf, [nextDay, serverGift], display);
    expect(first.map(gift => gift.id)).toEqual(retried.map(gift => gift.id));
    expect(first.filter(gift => gift.source === "server").map(gift => gift.day)).toContain("2026-10-10");
    expect(first.find(gift => gift.source === "server")?.text.ar.note).toBe(serverGift.text.ar.note);
  });

  it("does not merge stale generations or unvalidated server drawings", () => {
    const stale = { ...serverGift, generation: 2 };
    const invalid = { ...serverGift, art: "\u202eunsafe" };
    expect(mergeGifts(shelf, [stale, invalid], display).map(gift => gift.source)).toEqual(["legacy"]);
    expect(mergeGifts(shelf, [serverGift], { ...display, generation: undefined }).map(gift => gift.source)).toEqual(["legacy"]);
  });

  it("keeps the full archive while placing only the newest three current gifts", () => {
    const old = readShelf({ version: 1, seen: at, gifts: Array.from({ length: 12 }, (_, i) => ({ kind: "fern", day: `2026-09-${String(i + 1).padStart(2, "0")}`, at: at - (12 - i) })) });
    const server = Array.from({ length: 12 }, (_, i) => ({ ...serverGift, id: `job-${i}`, created_ms: at + i }));
    const gifts = mergeGifts(old, server, display);
    expect(gifts).toHaveLength(24);
    expect(activeGifts(gifts).map(gift => gift.id)).toEqual(["server:3:job-9", "server:3:job-10", "server:3:job-11"]);
  });

  it("archives old local keepsakes on a new life and retains the capability through reload", () => {
    const next = updateGiftDisplayState({ ...display, serverCapable: false }, 4, false, at + 1000);
    expect(activeGifts(mergeGifts(shelf, [serverGift], next))).toEqual([]);
    expect(mergeGifts(shelf, [serverGift], next)).toHaveLength(1);
    const upgraded = updateGiftDisplayState(next, 4, true, at + 1001);
    const reloaded = updateGiftDisplayState(JSON.parse(JSON.stringify(upgraded)), 4, false, at + 2000);
    expect(reloaded.serverCapable).toBe(true);
    expect(reloaded.legacyAfter).toBe(at + 1000);
    expect(readGiftDisplayState({ generation: "wrong", legacyAfter: -5 }).generation).toBeUndefined();
  });

  it("labels procedural creation, authored archives and same-generator previews honestly in both languages", () => {
    const gifts = mergeGifts(shelf, [serverGift], display);
    const preview = previewGift(job.seed, day, job.generation, "Spore", job.due_ms);
    expect(preview.art).toBe(serverGift.art);
    expect(preview.source).toBe("preview");
    expect(giftProvenance(preview, "en")).toContain("Demo preview");
    expect(giftProvenance(gifts[0], "en")).toContain("archive");
    expect(giftProvenance(gifts[1], "en")).toContain("No AI model or food cost");
    for (const gift of [...gifts, preview]) expect(giftProvenance(gift, "ar").length).toBeGreaterThan(20);
  });
});

describe("continuous food presentation", () => {
  it("shows reserve from conserved food rather than stage capacity or survival time", () => {
    expect(foodSummary("en", 3600, 12000)).toEqual({ amount: "3,600 of 12,000 food points", reserve: "About 3.6 days of quiet use." });
    expect(foodSummary("en", 3600, 42000).reserve).toBe(foodSummary("en", 3600, 12000).reserve);
    expect(foodSummary("en", 0, 12000).reserve).not.toMatch(/die|death|96|countdown/);
    expect(foodSummary("ar", 3600, 12000).amount).toContain("٣٬٦٠٠");
  });

  it("caps visible prices to current effort and defaults ordinary conversation to medium", () => {
    expect(replyFoodEstimate("en", "high")).toContain("up to 60");
    expect(replyFoodEstimate("en", "high", "high")).toContain("up to 200");
    expect(replyFoodEstimate("en", "medium", "high")).toContain("up to 60");
    expect(replyFoodEstimate("en", "low", "high")).toContain("up to 20");
    expect(replyFoodEstimate("en", "asleep", "high")).toContain("up to 0");
    expect(replyFoodEstimate("ar", "high", "low")).toContain("٢٠");
  });

  it("does not attribute reply effort to fullness or a v2 charge to midnight", () => {
    const chat = explainChat("en", { pct: 30, tier: "high", spent: 200, thinking: true, brain: "test" });
    expect(chat).toContain("Actual cost 200");
    expect(chat).not.toContain("30% so");
    const nextDay = explainMidnight("en", { burned: 1000, pct: 20, zero_days: 0, dead: false, wasBurrowed: false, affectionUp: false, continuous: true });
    expect(nextDay).toContain("Midnight adds no extra charge");
    expect(nextDay).not.toMatch(/Burned|empty midnights/);
    for (const lang of ["en", "ar"] as const) {
      expect(COPY[lang].energyNote.length).toBeGreaterThan(80);
      expect(COPY[lang].giftPending.length).toBeGreaterThan(20);
    }
  });
});
