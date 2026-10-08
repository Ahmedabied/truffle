// B06 item 1 and 5: route admission rules, as pure functions.
import { describe, expect, it } from "vitest";
import {
  MAX_BODY_BYTES,
  MAX_DAILY_STEPS,
  MAX_MESSAGE_CHARS,
  parseBodyText,
  parseCoords,
  parseMessage,
  stepTotalError
} from "../src/validate";

describe("body admission", () => {
  it("accepts a JSON object", () => {
    expect(parseBodyText('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });
  it("treats an empty body as an empty object", () => {
    expect(parseBodyText("")).toEqual({ ok: true, value: {} });
  });
  for (const raw of ["[1,2]", "null", "42", '"text"', "true", "{not json"]) {
    it(`rejects a non-object body: ${raw}`, () => {
      const r = parseBodyText(raw);
      expect(r.ok).toBe(false);
    });
  }
  it("rejects a body over 8 KiB, counted in bytes", () => {
    expect(MAX_BODY_BYTES).toBe(8192);
    const ok = `{"m":"${"a".repeat(MAX_BODY_BYTES - 8)}"}`;
    expect(new TextEncoder().encode(ok).length).toBe(MAX_BODY_BYTES);
    expect(parseBodyText(ok).ok).toBe(true);
    const tooBig = `{"m":"${"a".repeat(MAX_BODY_BYTES - 7)}"}`;
    expect(parseBodyText(tooBig).ok).toBe(false);
    // Arabic letters are 2 bytes each in UTF-8.
    const arabic = `{"m":"${"م".repeat(4100)}"}`;
    expect(parseBodyText(arabic).ok).toBe(false);
  });
});

describe("step totals", () => {
  it("accepts nonnegative safe integers up to the daily cap", () => {
    expect(MAX_DAILY_STEPS).toBe(50_000);
    for (const v of [0, 1, 2500, 50_000]) expect(stepTotalError(v), String(v)).toBeNull();
  });
  const badValues: [string, unknown][] = [
    ["string", "2500"],
    ["null", null],
    ["missing", undefined],
    ["fraction", 1001.5],
    ["true", true],
    ["false", false],
    ["array", [2500]],
    ["object", { n: 2500 }],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["exponent overflow 1e309", JSON.parse("1e309")],
    ["negative", -1],
    ["negative fraction", -0.5],
    ["unsafe integer", 9007199254740992],
    ["over the daily cap", 50_001]
  ];
  for (const [name, v] of badValues) {
    it(`rejects ${name}`, () => expect(stepTotalError(v)).toMatch(/steps_today_total/));
  }
});

describe("chat message", () => {
  it("trims and accepts up to 2048 characters", () => {
    expect(MAX_MESSAGE_CHARS).toBe(2048);
    expect(parseMessage("  hi  ")).toEqual({ ok: true, value: "hi" });
    expect(parseMessage("a".repeat(2048)).ok).toBe(true);
  });
  it("counts characters, not UTF-16 units", () => {
    // Each emoji is two UTF-16 units but one character.
    expect(parseMessage("\u{1F344}".repeat(2048)).ok).toBe(true);
    expect(parseMessage("\u{1F344}".repeat(2049)).ok).toBe(false);
  });
  for (const v of ["", "   ", "a".repeat(2049), 5, null, ["hi"]]) {
    it(`rejects ${JSON.stringify(v)?.slice(0, 20)}`, () => expect(parseMessage(v).ok).toBe(false));
  }
});

describe("coordinates", () => {
  it("absent is fine", () => {
    expect(parseCoords(undefined, undefined)).toEqual({ ok: true, value: null });
    expect(parseCoords(null, null)).toEqual({ ok: true, value: null });
  });
  it("rounds to two decimals", () => {
    expect(parseCoords(23.58812, 58.38291)).toEqual({ ok: true, value: { lat: 23.59, lon: 58.38 } });
    expect(parseCoords(-90, 180)).toEqual({ ok: true, value: { lat: -90, lon: 180 } });
  });
  const bad: [unknown, unknown][] = [
    [23.5, undefined],
    [undefined, 58.4],
    [91, 0],
    [0, -180.01],
    ["23.5", 58.4],
    [Number.NaN, 0],
    [0, Number.POSITIVE_INFINITY],
    [true, false]
  ];
  for (const [lat, lon] of bad) {
    it(`rejects lat=${String(lat)} lon=${String(lon)}`, () => expect(parseCoords(lat, lon).ok).toBe(false));
  }
});

import { readBounded } from "../src/validate";

describe("readBounded", () => {
  const stream = (parts: string[]) =>
    new ReadableStream<Uint8Array>({
      start(ctl) {
        for (const p of parts) ctl.enqueue(new TextEncoder().encode(p));
        ctl.close();
      }
    });

  it("returns the text when it fits", async () => {
    expect(await readBounded(stream(['{"a":', "1}"]), 16)).toBe('{"a":1}');
  });

  it("throws before buffering a body over the cap, even without content-length", async () => {
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(ctl) {
        pulled++;
        ctl.enqueue(new Uint8Array(1024));
      }
    });
    await expect(readBounded(endless, 8192)).rejects.toThrow();
    expect(pulled).toBeLessThan(12);
  });

  it("empty body is empty text", async () => {
    expect(await readBounded(null, 8)).toBe("");
  });
});
