import { describe, expect, it } from "vitest";
import { conversationEffort } from "../src/effort";

describe("ordinary conversation effort, decision 0023", () => {
  const v2 = { energy_version: 2 as const };
  it.each(["hi!", " Hello. ", "السلام عليكم", "صباح الخير!", "Thank you", "شكرا"])("uses a small answer for %s", message => {
    expect(conversationEffort(v2, message)).toBe("low");
  });
  it.each(["Hello, explain how seasons work", "I'm going for groceries", "ساعدني أخطط لبكرة", "Write a kind note for a friend", "If I say hello, what do you say?"])("keeps a useful answer for %s", message => {
    expect(conversationEffort(v2, message)).toBe("medium");
  });
  it("honors an explicit deeper or lower choice even on a greeting", () => {
    expect(conversationEffort(v2, "Hello", "high")).toBe("high");
    expect(conversationEffort(v2, "Explain seasons", "low")).toBe("low");
    expect(conversationEffort(v2, "Hello", "asleep")).toBe("asleep");
  });
  it("preserves legacy request policy before migration", () => {
    expect(conversationEffort({}, "Hello")).toBeUndefined();
    expect(conversationEffort({}, "Explain seasons", "high")).toBe("high");
  });
});
