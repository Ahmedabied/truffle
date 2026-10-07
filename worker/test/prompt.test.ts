import { describe, expect, it } from "vitest";
import { buildSystemPrompt, factsForTier, sleepyLine, SLEEPY_LINES, type Fact } from "../src/prompt";

const today = "2026-10-08";
const facts: Fact[] = [
  { text: "name is Ahmed", day_written: "2026-09-01" },
  { text: "likes wadis", day_written: "2026-10-02" }, // 6 days ago: inside 7
  { text: "sister visits Fridays", day_written: "2026-10-01" }, // 7 days ago: outside 7
  { text: "walked to the corniche", day_written: "2026-10-08" }
];
const block = '[truffle stage=Sprout energy=63% tier=high mood=content zero_days=0 burrowed=no weather="34C clear, Muscat" lang=en steps_today=6120 avg7=4800 age_days=3]';

describe("memory window per tier", () => {
  it("asleep sees nothing", () => expect(factsForTier(facts, "asleep", today)).toEqual([]));
  it("low sees today only", () =>
    expect(factsForTier(facts, "low", today).map((f) => f.text)).toEqual(["walked to the corniche"]));
  it("medium sees the last 7 local days", () =>
    expect(factsForTier(facts, "medium", today).map((f) => f.text)).toEqual(["likes wadis", "walked to the corniche"]));
  it("high sees everything", () => expect(factsForTier(facts, "high", today)).toHaveLength(4));
  it("future-dated facts (tz change) are not shown to windowed tiers", () =>
    expect(factsForTier([{ text: "x", day_written: "2026-10-09" }], "low", today)).toEqual([]));
});

describe("buildSystemPrompt", () => {
  const p = buildSystemPrompt({ stateBlock: block, facts, lang: "ar", tier: "low", today });
  it("carries the state block verbatim on its own line", () => {
    expect(p.split("\n")).toContain(block);
  });
  it("includes only the allowed facts", () => {
    expect(p).toContain("memory: walked to the corniche");
    expect(p).not.toContain("name is Ahmed");
  });
  it("has the language and safety lines", () => {
    expect(p).toContain("Reply in the language given by lang. Keep to the effort your energy allows.");
    expect(p).toContain("lang=ar means Arabic");
    expect(p).toContain("Never shame");
    expect(p).toContain("evening walk or walking indoors");
  });
  it("tells the model the status line is private", () => {
    expect(p).toContain("The bracketed status line is private. Never quote it or its field names.");
  });
  it("starts with the canonical header, state block and language line (finetune/data/schema.md)", () => {
    const lines = p.split("\n");
    expect(lines[0]).toBe("You are Truffle, a desert truffle (faqa) that lives as a small creature in a phone.");
    expect(lines[1]).toBe("You only have the energy your person's steps give you.");
    expect(lines[2]).toBe(block);
    expect(lines[3]).toMatch(/^memory: /);
    expect(lines[4]).toBe("Reply in the language given by lang. Keep to the effort your energy allows.");
  });
  it("says so when there is nothing to remember", () => {
    expect(buildSystemPrompt({ stateBlock: block, facts: [], lang: "en", tier: "high", today })).not.toContain("memory:");
  });
});

describe("sleepy lines", () => {
  it("six per language, deterministic per message", () => {
    expect(SLEEPY_LINES.en).toHaveLength(6);
    expect(SLEEPY_LINES.ar).toHaveLength(6);
    expect(sleepyLine("hello", "en")).toBe(sleepyLine("hello", "en"));
    expect(SLEEPY_LINES.ar).toContain(sleepyLine("hello", "ar"));
    const seen = new Set(Array.from({ length: 60 }, (_, i) => sleepyLine(`msg ${i}`, "en")));
    expect(seen.size).toBeGreaterThan(3);
  });
});
