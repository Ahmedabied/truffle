import { describe, expect, it } from "vitest";
import { explainChat } from "../src/copy";

describe("chat cost provenance", () => {
  it.each([20, 60, 200])("labels sample cost %i as simulated, without claiming inference", spent => {
    const options = { pct: 50, tier: "high" as const, spent, thinking: true, brain: "sample" };
    const en = explainChat("en", options);
    expect(en).toContain("Simulated sample reply");
    expect(en).toContain("No AI model call");
    expect(en).toContain(`Simulated cost: ${spent}`);
    expect(en).not.toMatch(/Actual cost|Thinking on/);
    const ar = explainChat("ar", options);
    expect(ar).toContain("رد تجريبي بمحاكاة");
    expect(ar).toContain("بدون نداء لنموذج ذكاء اصطناعي");
    expect(ar).toContain("تكلفة الطعام في المحاكاة");
    expect(ar).not.toMatch(/التكلفة الفعلية|التفكير شغّال/);
  });

  it("preserves live and no-model sleepy reply explanations", () => {
    expect(explainChat("en", { pct: 50, tier: "medium", spent: 60, thinking: false, brain: "gemma" })).toContain("Actual cost 60");
    expect(explainChat("en", { pct: 0, tier: "asleep", spent: 0, thinking: false, brain: "none" })).toContain("No model call. Cost 0");
    expect(explainChat("ar", { pct: 0, tier: "asleep", spent: 0, thinking: false, brain: "none" })).toContain("التكلفة ٠ طعام");
  });
});
