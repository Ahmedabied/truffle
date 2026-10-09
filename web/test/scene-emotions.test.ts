import { describe, expect, it } from "vitest";
import { EMPTY_VIEW, Scene, paintsFor, presentationFace, type SceneOptions, type View } from "../src/scene/world";

const date = new Date("2026-10-09T08:00:00Z");
const base: View = { ...EMPTY_VIEW, stage: "Truffle", mood: "content", tier: "high", ageDays: 12 };
const snapshot = (view: View, options: SceneOptions = {}, reduced = false) => {
  const frame = new Scene().compose(view, (options.sec ?? 0) * 12, options.sec ?? 0, 12, date, reduced, options);
  return paintsFor(frame).map(paint => paint.layer.text(paint.inkLight, paint.ramp, paint.mask));
};

describe("companion expressions in the ASCII world", () => {
  it("makes anticipation attentive and distinct from both contentment and happiness", () => {
    const scene = new Scene();
    const faces = ([null, "anticipating", "happy"] as const).map(reaction => {
      const frame = scene.compose({ ...base, reaction }, 0, 0, 12, date, true);
      expect(frame.layers.cap.lum.filter(value => value >= 0).length).toBeGreaterThan(30);
      return frame.layers.pet.text(false);
    });
    expect(faces[0].match(/\(o\)/g)).toHaveLength(2);
    expect(faces[1].match(/\(O\)/g)).toHaveLength(2);
    expect(faces[1]).toContain("\\_/");
    expect(new Set(faces).size).toBe(3);
    expect(presentationFace({ ...base, reaction: "anticipating" })).toBe("anticipating");
    expect(scene.builds.static).toBe(1);
  });

  it.each(["asleep", "tired", "wilting", "burrowed", "dead"] as const)(
    "keeps authoritative %s presentation despite either reaction or a yawn",
    mood => {
      const expected = snapshot({ ...base, mood }, {}, true);
      for (const reaction of ["happy", "anticipating"] as const) {
        expect(presentationFace({ ...base, mood, reaction, yawn: true })).toBe(mood);
        expect(snapshot({ ...base, mood, reaction }, {}, true)).toEqual(expected);
        expect(snapshot({ ...base, mood, reaction, yawn: true }, { sec: 1 }))
          .toEqual(snapshot({ ...base, mood }, { sec: 1 }));
      }
    }
  );

  it("eases into and out of anticipation through intermediate geometry", () => {
    const waiting = { ...base, reaction: "anticipating" as const };
    const content = snapshot(base);
    const start = snapshot(waiting, { fromFace: "content", transition: 0 });
    const middle = snapshot(waiting, { fromFace: "content", transition: .5 });
    const end = snapshot(waiting, { fromFace: "content", transition: 1 });
    expect(start).toEqual(content);
    expect(middle).not.toEqual(start);
    expect(middle).not.toEqual(end);
    expect(snapshot(base, { fromFace: "anticipating", transition: 0 })).toEqual(end);
    expect(snapshot(base, { fromFace: "anticipating", transition: 1 })).toEqual(content);
  });

  it("keeps anticipation grounded and the full mushroom silhouette through breathing", () => {
    const scene = new Scene();
    for (const stage of ["Spore", "Sprout", "Truffle", "Elder"] as const) {
      const bottoms = [];
      for (let sec = 0; sec < 6; sec += .25) {
        const frame = scene.compose({ ...base, stage, reaction: "anticipating" }, sec * 12, sec, 12, date, false, { sec });
        bottoms.push(frame.pet.y1);
        expect(frame.layers.cap.lum.filter(value => value >= 0).length).toBeGreaterThan(30);
        expect(frame.pet.y1 - frame.pet.y0).toBeGreaterThan(14);
      }
      expect(new Set(bottoms).size).toBe(1);
    }
  });

  it("freezes anticipating geometry, blink and weather under reduced motion", () => {
    const view: View = { ...base, reaction: "anticipating", country: "GB", rain: true, weatherCode: 95, windKmh: 40, precipMm: 5 };
    expect(snapshot(view, { sec: 50, fromFace: "affectionate", transition: .1 }, true))
      .toEqual(snapshot(view, { sec: 0, fromFace: "content", transition: 1 }, true));
  });
});
