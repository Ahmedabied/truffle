import { describe, expect, it } from "vitest";
import { FpsMeter, fpsEnabled, fpsText } from "../src/fps";

describe("fps flag", () => {
  it("is off by default and on only for fps=1", () => {
    expect(fpsEnabled(new URLSearchParams(""))).toBe(false);
    expect(fpsEnabled(new URLSearchParams("fps=0"))).toBe(false);
    expect(fpsEnabled(new URLSearchParams("fps=1"))).toBe(true);
    expect(fpsEnabled(new URLSearchParams("mock=1&fps=1"))).toBe(true);
  });
});

describe("FpsMeter", () => {
  it("averages compose and paint over the last second", () => {
    let now = 0;
    const m = new FpsMeter(() => now);
    m.add(1, 3);
    m.add(2, 5);
    m.add(3, 4);
    now = 500;
    expect(m.flush()).toBeNull(); // under a second: nothing yet
    now = 1000;
    expect(m.flush()).toEqual({ fps: 3, compose: 2, paint: 4 });
    // window resets
    now = 2000;
    expect(m.flush()).toEqual({ fps: 0, compose: 0, paint: 0 });
  });

  it("scales the count when the window ran long", () => {
    let now = 0;
    const m = new FpsMeter(() => now);
    for (let i = 0; i < 24; i++) m.add(1, 1);
    now = 2000;
    expect(m.flush()?.fps).toBe(12);
  });
});

describe("fpsText", () => {
  it("is one short line with no dashes", () => {
    const s = fpsText({ fps: 12, compose: 1.94, paint: 3.25 });
    expect(s).toBe("12 fps · compose 1.9 ms · paint 3.3 ms");
    expect(s).not.toMatch(/[\u2013\u2014]/);
  });
});
