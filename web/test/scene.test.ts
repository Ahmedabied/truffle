import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene, World, composeAll, EMPTY_VIEW, LAYERS, paintsFor, type View } from "../src/scene/world";
import { Layer, RAMP, glyph, glyphIndex } from "../src/scene/raster";
import { DURATION, MOMENT_KINDS } from "../src/scene/fx";
import { Surface } from "../src/scene/surface";

const date = new Date("2026-10-08T08:00:00Z");
const base: View = { ...EMPTY_VIEW, stage: "Truffle", mood: "content", ageDays: 12 };
const text = (s: Scene, v = base, t = 0, reduced = false) => {
  const f = s.compose(v, t, t / 12, 12, date, reduced);
  return paintsFor(f).map(p => p.layer.text(p.inkLight, p.ramp, p.mask));
};

// Recording canvas: tests verify reconstruction and submission without pretending
// that a mocked context proves browser raster speed or visual font quality.
function browser() {
  const contexts: ReturnType<typeof context>[] = [];
  function context() {
    return {
      clearRect: vi.fn(), drawImage: vi.fn(), fillText: vi.fn(), save: vi.fn(),
      restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
      measureText: () => ({ fontBoundingBoxAscent: 10, fontBoundingBoxDescent: 3 })
    };
  }
  class Canvas {
    style: Record<string, string> = {};
    dataset: Record<string, string> = {};
    width = 0;
    height = 0;
    context = context();
    constructor() { contexts.push(this.context); }
    getContext() { return this.context; }
    setAttribute() {}
  }
  vi.stubGlobal("document", { createElement: () => new Canvas(), hidden: false,
    addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("window", { devicePixelRatio: 2 });
  vi.stubGlobal("getComputedStyle", () => ({ fontFamily: "monospace" }));
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const root = { style: { fontSize: "6.666666px" }, clientWidth: 400, appendChild: vi.fn(), textContent: "" };
  return { root: root as unknown as HTMLElement, contexts };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("scene contract", () => {
  it("keeps every stage, mood and weather as 100 by 68 ASCII layers", () => {
    const moods = ["content", "affectionate", "tired", "wilting", "just_woke", "burrowed", "asleep", "dead"] as const;
    for (const stage of ["Spore", "Sprout", "Truffle", "Elder"] as const) {
      for (const mood of moods) {
        const f = composeAll({ ...base, stage, mood }, 13, 2, 22, date, false);
        expect(Object.keys(f.layers)).toEqual([...LAYERS]);
        for (const layer of Object.values(f.layers)) {
          const rows = layer.split("\n");
          expect(rows).toHaveLength(68);
          expect(rows.every(row => row.length === 100)).toBe(true);
          expect(layer).toMatch(/^[ .:+*#%@\n]*$/);
        }
        expect(f.layers.pet.trim().length).toBeGreaterThan(0);
      }
    }
    for (const code of [45, 71, 95]) {
      const f = composeAll({ ...base, weatherCode: code, country: "GB", rain: true, windKmh: 45 }, 18, 2, 15, date, false);
      expect(f.layers.weather.trim().length).toBeGreaterThan(0);
    }
  });

  it("freezes every moving layer in reduced motion", () => {
    const scene = new Scene();
    for (const mood of ["affectionate", "burrowed", "dead"] as const) {
      const v = { ...base, mood, rain: true, weatherCode: 95, country: "GB", windKmh: 45 };
      expect(text(scene, v, 919, true)).toEqual(text(scene, v, 0, true));
    }
  });

  it("caches static geometry through motion and refreshes on environment changes", () => {
    const scene = new Scene();
    const first = text(scene);
    for (let i = 1; i <= 30; i++) text(scene, base, i);
    expect(scene.builds.static).toBe(1);
    expect(text(scene, base, 13)).not.toEqual(first);
    text(scene, { ...base, weatherCode: 95, rain: true }, 31);
    expect(scene.builds.static).toBe(2);
    text(scene, { ...base, country: "GB" }, 32);
    expect(scene.builds.static).toBe(3);
  });

  it("does not contaminate another world or a repeated frame", () => {
    const one = new Scene();
    const two = new Scene();
    const first = text(one, base, 7);
    text(two, { ...base, mood: "dead", country: "GB", weatherCode: 95 }, 100);
    expect(text(one, base, 7)).toEqual(first);
    // Phase buckets have canonical samples, independent of previous calls.
    const a = composeAll(base, 7, 2.01, 12, date, false);
    composeAll(base, 8, 8, 12, date, false);
    expect(composeAll(base, 7, 2.09, 12, date, false)).toEqual(a);
  });

  it("gives all seven moments a visible effect without changing pet or ground", () => {
    const before = composeAll(base, 0, 0, 12, date, false);
    for (const kind of MOMENT_KINDS) {
      expect(DURATION[kind]).toBeGreaterThanOrEqual(2);
      expect(DURATION[kind]).toBeLessThanOrEqual(4);
      const after = composeAll(base, 0, 0, 12, date, false, { moment: { kind, value: 7, progress: 0.45 } });
      expect(after.layers.pet).toBe(before.layers.pet);
      expect(after.layers.ground).toBe(before.layers.ground);
      expect(after.layers.fx + after.layers.weather).not.toBe(before.layers.fx + before.layers.weather);
    }
  });

  it("pushes a reborn spore through the ground and clips its buried part", () => {
    const scene = new Scene();
    const v = { ...base, stage: "Spore" as const };
    const hidden = scene.compose(v, 0, 0, 12, date, false, { rise: 0 }).mask.slice();
    const middle = scene.compose(v, 0, 0, 12, date, false, { rise: 0.5 }).mask.slice();
    const risen = scene.compose(v, 0, 0, 12, date, false, { rise: 1 }).mask.slice();
    const count = (a: Uint8Array) => a.reduce((n, v) => n + v, 0);
    expect(count(hidden)).toBeLessThan(count(middle));
    expect(count(middle)).toBeLessThan(count(risen));
    expect(middle.slice(59 * 100).some(Boolean)).toBe(false);
  });
});

describe("atlas damage and lifecycle", () => {
  it("uses the same ordered dither as text across luminances and both ink directions", () => {
    for (const ink of [false, true]) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      for (let i = -2; i <= 12; i++) expect(RAMP[glyphIndex(i / 10, x, y, ink, 7)]).toBe(glyph(i / 10, x, y, ink));
    }
  });

  it("redraws no unchanged cells and restores underlying ink when a glyph disappears", () => {
    const { root, contexts } = browser();
    const surface = new Surface(root);
    surface.fit();
    surface.inks([{ colour: "#112233", alpha: 1 }, { colour: "#ffffff", alpha: 1 }]);
    const back = new Layer();
    const front = new Layer();
    back.set(2, 3, 1);
    front.set(2, 3, 1);
    const paints = [back, front].map((layer, ink) => ({ layer, ink, ramp: RAMP, inkLight: true }));
    surface.paint(paints);
    expect(surface.stats.glyphDraws).toBe(2);
    surface.paint(paints);
    expect(surface.stats.changedCells).toBe(0);
    expect(surface.stats.glyphDraws).toBe(0);
    contexts[0].drawImage.mockClear();
    front.clear();
    surface.paint(paints);
    expect(surface.stats.changedCells).toBe(1);
    expect(surface.stats.glyphDraws).toBe(1);
    // The surviving layer is ink row zero, restored in the same damaged cell.
    expect(contexts[0].drawImage.mock.calls[0].slice(1)).toEqual([7 * surface.cw, 0, surface.cw, surface.ch, 2 * surface.cw, 3 * surface.ch, surface.cw, surface.ch]);
    surface.inks([{ colour: "#334455", alpha: 1 }, { colour: "#ffffff", alpha: 1 }]);
    surface.paint(paints);
    expect(surface.stats.changedCells).toBe(6800);
  });

  it("restores the world when the moving pet mask leaves a cell", () => {
    const { root } = browser();
    const surface = new Surface(root);
    surface.fit();
    surface.inks([{ colour: "#123456", alpha: 1 }]);
    const layer = new Layer();
    const mask = new Uint8Array(6800);
    layer.set(4, 5, 1);
    mask[504] = 1;
    const p = [{ layer, ink: 0, ramp: RAMP, inkLight: true, mask }];
    surface.paint(p);
    expect(surface.stats.glyphDraws).toBe(0);
    mask[504] = 0;
    surface.paint(p);
    expect(surface.stats.changedCells).toBe(1);
    expect(surface.stats.glyphDraws).toBe(1);
  });

  it("expires a reduced-motion celebration at two seconds without advancing the scene", () => {
    vi.useFakeTimers();
    const { root, contexts } = browser();
    const world = new World(root);
    world.set(base);
    world.setReduced(true);
    world.draw();
    world.celebrate("stage_up", 2);
    const started = world.frames;
    contexts[0].drawImage.mockClear();
    world.draw();
    expect(contexts[0].drawImage).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1999);
    expect(world.frames).toBe(started + 1);
    vi.advanceTimersByTime(1);
    expect(world.frames).toBe(started + 2);
    expect(contexts[0].drawImage).toHaveBeenCalled();
    world.stop();
  });

  it("starts only one animation loop and cancels it on stop", () => {
    const { root } = browser();
    const world = new World(root);
    world.start();
    world.start();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    world.stop();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});
