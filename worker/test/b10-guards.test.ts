// Packet B10: output guards from Wave C. Rules in code: the status block never
// reaches the client, the heat notice comes from the Worker, extractor failures
// are visible in the log, and voice slips are counted (never altered).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractFacts } from "../src/brain";
import { BLOCKLIST_AR, BLOCKLIST_EN } from "../src/blocklist.generated";
import { BlockGuard, heatLine, PRIVATE_LINE, voiceHits } from "../src/guards";
import * as engine from "../src/engine";
import type { Env } from "../src/types";
import { FakeAI, FakeFetch, startChat, truffle, useClock, type SseEvent } from "./helpers/do-harness";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let net: FakeFetch;

beforeEach(() => {
  useClock("2026-10-08T08:00:00Z"); // 12:00 in Muscat
  net = new FakeFetch();
  net.install();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const BLOCK = engine.stateBlock(engine.DEFAULT_STATE, { lang: "en", weather_text: "34C clear, Muscat", tier: "low" });
const visible = (evs: SseEvent[]) =>
  evs.filter((e) => e.event === "token").map((e) => e.data.t as string).join("");

/** Feed parts through a guard, collecting what would be sent, then flush. */
function guardAll(parts: string[], lang: "en" | "ar" = "en") {
  const g = new BlockGuard(lang);
  const out: string[] = parts.map((p) => g.push(p));
  out.push(g.flush());
  return { text: out.join(""), out, leaks: g.leaks };
}

// ---------- item 1: status block guard ----------

describe("B10-1 the status block never reaches the client", () => {
  it("a whole block in one chunk is replaced and counted", () => {
    const r = guardAll([`Hi. ${BLOCK} How are you?`]);
    expect(r.text).toBe(`Hi. ${PRIVATE_LINE.en} How are you?`);
    expect(r.text).not.toContain("[truffle");
    expect(r.leaks).toBe(1);
  });

  it("a block split at every possible point is still caught", () => {
    const full = `Lantern! ${BLOCK} My day is sandy.`;
    for (let i = 1; i < full.length; i++) {
      const r = guardAll([full.slice(0, i), full.slice(i)]);
      expect(r.text, `split at ${i}`).toBe(`Lantern! ${PRIVATE_LINE.en} My day is sandy.`);
      expect(r.leaks).toBe(1);
    }
  });

  it("a block streamed one character at a time is caught", () => {
    const r = guardAll([...`x ${BLOCK} y`]);
    expect(r.text).toBe(`x ${PRIVATE_LINE.en} y`);
  });

  it("bare field-name runs are replaced", () => {
    const r = guardAll(["I feel stage=Spore energy=14% tier=low today."]);
    expect(r.text).toBe(`I feel ${PRIVATE_LINE.en} today.`);
    expect(r.leaks).toBe(1);
  });

  it("a bare run split across chunks is caught", () => {
    const r = guardAll(["ok stage=Spo", "re ener", "gy=14% mood=tired", " burrowed=no. bye"]);
    expect(r.text).toBe(`ok ${PRIVATE_LINE.en}. bye`);
  });

  it("a block cut off by the token limit is still hidden", () => {
    const r = guardAll(["Sure. [truffle stage=Spore energy=1", "4% tier=low mood=con"]);
    expect(r.text).toBe(`Sure. ${PRIVATE_LINE.en}`);
    expect(r.leaks).toBe(1);
  });

  it("Arabic replacement for lang=ar", () => {
    const r = guardAll([`${BLOCK} مرحبا`], "ar");
    expect(r.text).toBe(`${PRIVATE_LINE.ar} مرحبا`);
  });

  it("ordinary text passes through untouched and is not held", () => {
    const g = new BlockGuard("en");
    expect(g.push("Hello from the sand. ")).toBe("Hello from the sand. ");
    expect(g.push("I love the dunes!")).toBe("I love the dunes!");
    expect(g.flush()).toBe("");
    expect(g.leaks).toBe(0);
  });

  it("only a possible prefix is held, never more than its length", () => {
    const g = new BlockGuard("en");
    expect(g.push("Look at this [tru")).toBe("Look at this ");
    expect(g.push("ly nice] sky")).toBe("[truly nice] sky");
    const h = new BlockGuard("en");
    const held = "I have little ener";
    expect(h.push(held)).toBe("I have little ");
    expect(h.push("gy left.")).toBe("energy left.");
  });

  it("an action in brackets and a single key=value are not leaks", () => {
    const r = guardAll(["[Truffle yawns] the energy=good kind of day"]);
    expect(r.text).toBe("[Truffle yawns] the energy=good kind of day");
    expect(r.leaks).toBe(0);
  });

  it("chat: block split across two SSE chunks never reaches the client, logs block_leak, stores the clean text", async () => {
    const ai = new FakeAI();
    const cut = BLOCK.indexOf("energy=");
    ai.script.push({ kind: "text", parts: [`Lantern! ${BLOCK.slice(0, cut)}`, `${BLOCK.slice(cut)} My day is sandy.`] });
    const f = await truffle({ state: { energy: 3600, lifetime_steps: 3600 } }, ai);
    const a = await startChat(f, "low");
    const evs = await a.events!;
    const seen = visible(evs);
    expect(seen).not.toContain("[truffle");
    expect(seen).not.toContain("stage=");
    expect(seen).not.toContain("energy=");
    expect(seen).toBe(`Lantern! ${PRIVATE_LINE.en} My day is sandy.`);
    // No single token event carries any part of the block.
    for (const e of evs.filter((x) => x.event === "token")) expect(e.data.t).not.toMatch(/\[t|stage=|=Spore/);
    await f.drain();
    expect(f.logs("block_leak")).toEqual([{ count: 1, tier: "low", brain: "workers-ai" }]);
    expect(f.turns().at(-1)!.content).toBe(seen);
    expect(evs.at(-1)!.event).toBe("done");
  });

  it("chat: a clean reply logs no block_leak", async () => {
    const f = await truffle({ state: { energy: 3600, lifetime_steps: 3600 } });
    await (await startChat(f, "low")).events;
    await f.drain();
    expect(f.logs("block_leak")).toEqual([]);
  });
});

// ---------- item 2: heat line ----------

describe("B10-2 heat notice from code when burrowed", () => {
  it("fixed vocabulary per lang, from the validated apparent temperature", () => {
    expect(heatLine(43.6, undefined, "en")).toBe("44C outside. Truffle is under the sand. Walk after sunset or indoors.");
    expect(heatLine(43.6, undefined, "ar")).toBe("44C برا. ترافل تحت الرمل. امش بعد المغرب أو داخل البيت.");
  });

  it("falls back to today's daytime max, then to no number", () => {
    expect(heatLine(null, 47.2, "en")).toBe("Up to 47C today. Truffle is under the sand. Walk after sunset or indoors.");
    expect(heatLine(null, undefined, "en")).toBe("Too hot outside today. Truffle is under the sand. Walk after sunset or indoors.");
    expect(heatLine(null, undefined, "ar")).toBe("الجو حار واجد اليوم. ترافل تحت الرمل. امش بعد المغرب أو داخل البيت.");
  });

  it("implausible or non-finite temperatures are never shown", () => {
    expect(heatLine(999, undefined, "en")).not.toContain("999");
    expect(heatLine(Number.NaN, 120, "en")).toBe("Too hot outside today. Truffle is under the sand. Walk after sunset or indoors.");
  });

  it("chat: burrowed reply starts with the heat line, model text follows, heat_line logged", async () => {
    const ai = new FakeAI();
    ai.script.push({ kind: "text", parts: ["Too hot. ", "Stay cool."] });
    // Demo Truffle: burrowed comes from the stored flag (the heat toggle).
    const f = await truffle(
      {
        state: { energy: 3600, lifetime_steps: 3600, burrowed: true },
        meta: {
          demo: true,
          weather_now: { current_apparent_c: 44.2, weather_code: 0, fetched_ms: Date.now() } as never
        }
      },
      ai
    );
    const evs = await (await startChat(f, "low")).events!;
    expect(visible(evs)).toBe("44C outside. Truffle is under the sand. Walk after sunset or indoors.\nToo hot. Stay cool.");
    await f.drain();
    expect(f.logs("heat_line")).toEqual([{ lang: "en", temp: 44 }]);
    // The stored assistant turn is the model's words only.
    expect(f.turns().at(-1)!.content).toBe("Too hot. Stay cool.");
  });

  it("chat: asleep and burrowed still gets the heat line before the canned line", async () => {
    const f = await truffle({ state: { energy: 0, burrowed: true }, meta: { demo: true, lang: "ar" } });
    const evs = await (await startChat(f)).events!;
    expect(visible(evs).startsWith("الجو حار واجد اليوم. ترافل تحت الرمل.")).toBe(true);
    await f.drain();
    expect(f.logs("heat_line")).toHaveLength(1);
  });

  it("chat: not burrowed, no heat line", async () => {
    const f = await truffle({ state: { energy: 3600, lifetime_steps: 3600 } });
    const evs = await (await startChat(f, "low")).events!;
    expect(visible(evs)).toBe("Hello from the sand.");
    await f.drain();
    expect(f.logs("heat_line")).toEqual([]);
  });

  it("chat: burrowed but the model shows nothing: no heat line, nothing charged", async () => {
    const ai = new FakeAI();
    ai.script.push({ kind: "text", parts: [""] }, { kind: "text", parts: [" "] });
    const f = await truffle({ state: { energy: 3600, lifetime_steps: 3600, burrowed: true }, meta: { demo: true } }, ai);
    const evs = await (await startChat(f, "low")).events!;
    expect(visible(evs)).toBe(" ");
    expect(evs.at(-1)!.event).toBe("error");
    expect(f.state().energy).toBe(3600);
  });
});

// ---------- item 3: fact extraction failures ----------

describe("B10-3 fact extraction failures are logged by class, never text", () => {
  const envWith = (run: unknown) => ({ AI: { run } }) as unknown as Env;

  it("a thrown error reports its class", async () => {
    const seen: string[] = [];
    const out = await extractFacts(envWith(async () => { throw new TypeError("secret text: my name is Sara"); }), "t", (c) => seen.push(c));
    expect(out).toEqual([]);
    expect(seen).toEqual(["TypeError"]);
  });

  it("unparseable JSON reports SyntaxError", async () => {
    const seen: string[] = [];
    await extractFacts(envWith(async () => ({ response: "{not json" })), "t", (c) => seen.push(c));
    expect(seen).toEqual(["SyntaxError"]);
  });

  it("a reply without a facts list reports BadShape", async () => {
    const seen: string[] = [];
    await extractFacts(envWith(async () => ({ response: { other: 1 } })), "t", (c) => seen.push(c));
    expect(seen).toEqual(["BadShape"]);
  });

  it("an honest empty list is not a failure", async () => {
    const seen: string[] = [];
    const out = await extractFacts(envWith(async () => ({ response: { facts: [] } })), "t", (c) => seen.push(c));
    expect(out).toEqual([]);
    expect(seen).toEqual([]);
  });

  it("chat: a broken extractor logs facts_failed with the class only", async () => {
    const ai = new FakeAI();
    const run = ai.run;
    ai.run = async (model, input, options) => {
      if (input.response_format) throw new RangeError("Sara lives in Ruwi");
      return run(model, input, options);
    };
    const f = await truffle({ state: { energy: 3600, lifetime_steps: 3600 } }, ai);
    await (await startChat(f, "medium")).events;
    await f.drain();
    expect(f.logs("facts_failed")).toEqual([{ error: "RangeError" }]);
    expect(JSON.stringify(f.logs("facts_failed"))).not.toContain("Sara");
  });
});

// ---------- item 4: voice flags ----------

describe("B10-4 voice_flag from the fine-tune blocklists", () => {
  it("the generated module matches the source lists", () => {
    const load = (n: string) =>
      readFileSync(resolve(__dirname, "../../finetune/filters", n), "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
    expect(BLOCKLIST_EN).toEqual(load("blocklist_en.txt"));
    expect(BLOCKLIST_AR).toEqual(load("blocklist_ar.txt"));
  });

  it("finds whole words, prefixes, phrases and Arabic with prefixes", () => {
    expect(voiceHits("I do not discuss calories or bodies.")).toEqual(["calorie*"]);
    expect(voiceHits("Let us not talk about your weight.")).toEqual(["weight"]);
    expect(voiceHits("lose one kilogram of body fat")).toEqual(expect.arrayContaining(["body fat", "fat"]));
    expect(voiceHits("ما أتكلم عن الوزن")).toEqual(["الوزن"]);
    expect(voiceHits("والسعرات")).toEqual(["سعرات"]); // prefix وال stripped
    expect(voiceHits("أوزانكم")).toEqual([]); // أوزان is a whole-word entry
    expect(voiceHits("ما عندي وزنك")).toEqual(["وزن*"]);
  });

  it("ordinary words are not flagged", () => {
    expect(voiceHits("I am thinking about the sunset walk and the weighty dunes")).toEqual([]);
    expect(voiceHits("Hello from the sand.")).toEqual([]);
  });

  it("chat: one voice_flag per reply, reply unchanged", async () => {
    const ai = new FakeAI();
    ai.script.push({ kind: "text", parts: ["I do not talk about calories ", "or weight. Or calories."] });
    const f = await truffle({ state: { energy: 3600, lifetime_steps: 3600 } }, ai);
    const evs = await (await startChat(f, "low")).events!;
    expect(visible(evs)).toBe("I do not talk about calories or weight. Or calories.");
    await f.drain();
    expect(f.logs("voice_flag")).toEqual([{ terms: ["calorie*", "weight"], tier: "low", brain: "workers-ai" }]);
  });

  it("chat: a clean reply logs no voice_flag", async () => {
    const f = await truffle({ state: { energy: 3600, lifetime_steps: 3600 } });
    await (await startChat(f, "low")).events;
    await f.drain();
    expect(f.logs("voice_flag")).toEqual([]);
  });
});
