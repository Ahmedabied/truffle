import { describe, expect, it } from "vitest";
import { CARD_H, CARD_W, PUBLIC_HOST, cardHost, fileName, parseGradient } from "../src/share";
import { COPY } from "../src/copy";

describe("share card helpers", () => {
  it("is 1080 x 1350", () => {
    expect([CARD_W, CARD_H]).toEqual([1080, 1350]);
  });
  it("reads the world's gradient as set by the scene (hex)", () => {
    expect(parseGradient("linear-gradient(to bottom, #86bce6 0%, #d8eaf3 57.143%, #e8dcad 57.143%, #d6c791 100%)")).toEqual([
      { color: "#86bce6", at: 0 },
      { color: "#d8eaf3", at: 0.57143 },
      { color: "#e8dcad", at: 0.57143 },
      { color: "#d6c791", at: 1 }
    ]);
  });
  it("reads the gradient as computed style reports it (rgb)", () => {
    const got = parseGradient("linear-gradient(rgb(134, 188, 230) 0%, rgba(216, 234, 243, 0.5) 57.143%, rgb(214, 199, 145) 100%)");
    expect(got.map((s) => s.color)).toEqual(["rgb(134, 188, 230)", "rgba(216, 234, 243, 0.5)", "rgb(214, 199, 145)"]);
  });
  it("returns no stops for no gradient", () => {
    expect(parseGradient("none")).toEqual([]);
  });
  it("shows the public host when running locally", () => {
    expect(cardHost("localhost:5173")).toBe(PUBLIC_HOST);
    expect(cardHost("192.168.1.4:5173")).toBe(PUBLIC_HOST);
    expect(cardHost("truffle.example.org")).toBe("truffle.example.org");
  });
  it("names the file by date", () => {
    expect(fileName(new Date(2026, 9, 8))).toBe("truffle-2026-10-08.png");
  });
  it("has the tagline, with no dashes", () => {
    expect(COPY.en.shareTag).toBe("truffle, a pet that eats steps");
    for (const l of ["en", "ar"] as const) {
      for (const k of ["shareTag", "share", "openApp", "getApp", "moments", "momentsEmpty", "shareFailed"] as const) {
        expect(COPY[l][k]).not.toMatch(/[\u2013\u2014!]/);
      }
    }
  });
});
