// The ASCII world. Nine stacked <pre> layers, each in its own colour, composed
// back to front from a 40 x 28 character buffer each. A layer is written only
// when its text changed. 12 fps. Everything that moves is keyed to the frame
// clock `t`, which freezes under reduced motion.

import type { Stage, Tier } from "../../../worker/src/config";
import type { Gravestone, Mood } from "../../../worker/src/engine";
import { gravestone, mound, spriteFor, type Face } from "../sprites";
import { arc, moonPhase, starField, sunHeight, sunTimes } from "./astro";
import { COLS, ROWS } from "./grid";
import { canonicalHour, paletteAt, type Conditions, type Palette } from "./palette";
import { cloudRows, lightFrom, luma, moonRows, normalize, shadeDomes, toChar, type CloudKind, type Vec3 } from "./shade";
import { localHour } from "./sky";

const PERIOD = 1000 / 12;
export const HORIZON = 16; // first ground row
const GROUND_END = 25;
const ANCHOR = 24; // bottom row of the Truffle sprite
const HUD_ROW = 27;

export const GULF = new Set(["OM", "AE", "SA", "QA", "KW", "BH", "YE", "IQ", "JO", "EG", "LY"]);

export const LAYERS = ["stars", "sun", "cloudsFar", "cloudsNear", "weather", "ground", "pet", "fx", "hud"] as const;
export type LayerName = (typeof LAYERS)[number];

export interface View {
  stage: Stage;
  mood: Mood;
  tier: Tier;
  energyPct: number;
  stepsToday: number;
  gravestones: Gravestone[];
  ageDays: number;
  lifetimeSteps: number;
  country: string;
  tz: string;
  rain: boolean;
  precipMm: number;
  windKmh: number;
  weatherCode: number;
  apparentC: number;
  yawn: boolean;
  /** Debug: force a local hour (?hour=). */
  hourOverride: number | null;
  /** Debug: force a moon phase 0..1 (?moon=). */
  moonOverride: number | null;
}

export const EMPTY_VIEW: View = {
  stage: "Spore",
  mood: "content",
  tier: "asleep",
  energyPct: 0,
  stepsToday: 0,
  gravestones: [],
  ageDays: 0,
  lifetimeSteps: 0,
  country: "OM",
  tz: "Asia/Muscat",
  rain: false,
  precipMm: 0,
  windKmh: 10,
  weatherCode: 1,
  apparentC: 30,
  yawn: false,
  hourOverride: null,
  moonOverride: null
};

const mod = (n: number, d: number) => ((n % d) + d) % d;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const hash = (n: number) => {
  let x = (n | 0) * 2654435761;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
};

type Grid = string[][];
const blank = (): Grid => Array.from({ length: ROWS }, () => Array<string>(COLS).fill(" "));
const text = (g: Grid) => g.map((r) => r.join("")).join("\n");

function put(g: Grid, x: number, y: number, s: string, opaque = true): void {
  if (y < 0 || y >= ROWS) return;
  let dx = 0;
  for (const ch of s) {
    const cx = x + dx++;
    if (cx < 0 || cx >= COLS) continue;
    if (!opaque && ch === " ") continue;
    g[y][cx] = ch;
  }
}
const stamp = (g: Grid, x: number, y: number, rows: string[], opaque = true) => rows.forEach((r, i) => put(g, x, y + i, r, opaque));

/** Weather code families from Open-Meteo. */
const wx = (code: number) => ({
  fog: code === 45 || code === 48,
  snow: (code >= 71 && code <= 77) || code === 85 || code === 86,
  storm: code >= 95,
  cloud: code >= 3 ? 1 : code === 2 ? 0.55 : code === 1 ? 0.22 : 0
});

export interface Env {
  hour: number;
  rise: number;
  set: number;
  sunH: number;
  canonical: number;
  pal: Palette;
  sand: boolean;
  cond: Conditions & { storm: boolean };
  sun: { x: number; y: number; up: boolean; p: number };
  moon: { x: number; y: number; up: boolean; phase: number };
  /** Light direction at the Truffle. */
  light: Vec3;
  /** Which side of the scene the light sits on: -1 left .. 1 right. */
  lightSide: number;
  hot: boolean;
  night: boolean;
}

export function envFor(v: View, hour: number, now: Date): Env {
  const { rise, set } = sunTimes(now);
  const sunH = sunHeight(hour, rise, set);
  const canonical = canonicalHour(hour, rise, set);
  const w = wx(v.weatherCode);
  const sand = GULF.has(v.country) || v.mood === "burrowed";
  const hot = v.mood === "burrowed" || v.apparentC >= 38;
  const cond = { cloud: v.rain ? Math.max(w.cloud, 0.9) : w.cloud, rain: v.rain && !w.snow, fog: w.fog, snow: w.snow && v.rain, hot, sand, mood: v.mood, storm: w.storm };
  const pal = paletteAt(canonical, cond);

  const sunP = clamp((hour - rise) / (set - rise), -0.1, 1.1);
  const sunPos = arc(sunP);
  const phase = v.moonOverride ?? moonPhase(now);
  // The moon trails the sun by its phase: full moon is up all night, new moon rides with the sun.
  const moonHour = mod(hour - phase * 24, 24);
  const moonP = (moonHour - rise) / (set - rise);
  const moonUp = moonP > -0.05 && moonP < 1.05 && sunH < 0.25;
  const moonPos = arc(clamp(moonP, -0.05, 1.05));

  const petX = COLS / 2;
  const petY = ANCHOR - 3;
  let light: Vec3;
  let lightSide: number;
  if (sunH > 0.02) {
    light = lightFrom(sunPos.x, sunPos.y, petX, petY, 0.75);
    lightSide = (sunPos.x - petX) / (COLS / 2);
  } else if (moonUp) {
    light = lightFrom(moonPos.x, moonPos.y, petX, petY, 0.9);
    lightSide = (moonPos.x - petX) / (COLS / 2);
  } else {
    light = normalize([-0.3, -0.7, 0.8]);
    lightSide = -0.3;
  }
  if (cond.cloud > 0.6 || cond.fog) light = normalize([light[0] * 0.3, light[1] * 0.5, 1]);

  return {
    hour,
    rise,
    set,
    sunH,
    canonical,
    pal,
    sand,
    cond,
    sun: { ...sunPos, up: sunH > -0.08, p: sunP },
    moon: { ...moonPos, up: moonUp, phase },
    light,
    lightSide,
    hot,
    night: sunH < 0
  };
}

// ---------- layers ----------

const STARS = starField();

function starsLayer(v: View, t: number, e: Env): Grid {
  const g = blank();
  const dark = clamp((0.08 - e.sunH) / 0.5, 0, 1);
  const inkLight = true;
  if (dark > 0) {
    const n = Math.floor(STARS.length * dark);
    for (const s of STARS) {
      if (s.rank >= n) continue;
      const k = Math.floor(t / (s.bright ? 5 : 9) + s.phase) % 4;
      const ch = s.bright ? "*+*." [k] : ".'.. "[k] ?? ".";
      if (ch !== " ") put(g, s.x, s.y, ch);
    }
    // Shooting star, once in a while, only at full dark.
    if (dark > 0.9) {
      const cycle = 520;
      const k = t % cycle;
      if (k < 9) {
        const row = 1 + Math.floor(hash(Math.floor(t / cycle)) * 7);
        const x0 = 4 + Math.floor(hash(Math.floor(t / cycle) + 99) * 24);
        put(g, x0 + k * 2, row + Math.floor(k / 3), "*", false);
        put(g, x0 + k * 2 - 2, row + Math.floor((k - 1) / 3), "-", false);
        put(g, x0 + k * 2 - 4, row + Math.floor((k - 2) / 3), ".", false);
      }
    }
  }
  if (e.moon.up && e.moon.phase > 0.04 && e.moon.phase < 0.96) {
    const m = moonRows(e.moon.phase, 7, 4, inkLight);
    stamp(g, e.moon.x - 3, e.moon.y - 2, m, false);
  }
  for (let cx = 0; cx < COLS; cx++) for (let cy = ridgeTop(cx, e.sand); cy < ROWS; cy++) g[cy][cx] = " ";
  // A soft halo around a low sun.
  if (e.sun.up && e.sunH < 0.2 && e.cond.cloud < 0.7) {
    const { x, y } = e.sun;
    put(g, x - 7, y, ".", false);
    put(g, x + 7, y, ".", false);
    put(g, x - 5, y - 2, ".", false);
    put(g, x + 5, y - 2, ".", false);
    put(g, x - 2, y - 3, ". .", false);
  }
  return g;
}

function sunLayer(v: View, t: number, e: Env): Grid {
  const g = blank();
  if (!e.sun.up || e.cond.cloud >= 0.95 || e.cond.fog) return g;
  const { x, y } = e.sun;
  if (e.sunH < 0.16) {
    // Big and low: a half disk resting on the horizon.
    const rows = shadeDomes(13, 3, [{ cx: 6.5, cy: 3.4, rx: 6.5, ry: 3.4, z: 0.6 }], {
      light: [0, 0, 1],
      inkLight: true,
      ambient: 0.5,
      rim: 2,
      ramp: " .:=*#%@",
      outline: true,
      range: [0.3, 1]
    });
    const base = Math.min(ridgeTop(x, e.sand), ridgeTop(x - 3, e.sand), ridgeTop(x + 3, e.sand));
    stamp(g, x - 6, Math.min(base - 3, y - 1), rows, false);
    for (let cx = 0; cx < COLS; cx++) for (let cy = ridgeTop(cx, e.sand); cy < ROWS; cy++) g[cy][cx] = " ";
  } else {
    const rows = shadeDomes(7, 3, [{ cx: 3.5, cy: 1.5, rx: 3.5, ry: 1.5 }], {
      light: [0, 0, 1],
      inkLight: true,
      ambient: 0.6,
      rim: 2,
      ramp: " .:=*#%@",
      range: [0.4, 1]
    });
    stamp(g, x - 3, y - 1, rows, false);
    const long = t % 24 < 12;
    put(g, x - 6, y, long ? "-" : " ", false);
    put(g, x + 6, y, long ? "-" : " ", false);
    put(g, x, y - 3, long ? "'" : " ", false);
    put(g, x - 5, y - 2, long ? "`" : ".", false);
    put(g, x + 5, y - 2, long ? "'" : ".", false);
    put(g, x - 5, y + 2, long ? "." : " ", false);
    put(g, x + 5, y + 2, long ? "." : " ", false);
  }
  return g;
}

interface CloudSpec {
  kind: CloudKind;
  row: number;
  base: number;
  speed: number;
}
const FAR: CloudSpec[] = [
  { kind: "small", row: 2, base: 3, speed: 0.5 },
  { kind: "wisp", row: 5, base: 20, speed: 0.4 },
  { kind: "small", row: 7, base: 31, speed: 0.55 },
  { kind: "wisp", row: 1, base: 12, speed: 0.45 },
  { kind: "small", row: 4, base: 38, speed: 0.5 }
];
const NEAR: CloudSpec[] = [
  { kind: "medium", row: 3, base: 9, speed: 1 },
  { kind: "large", row: 6, base: 27, speed: 1.2 },
  { kind: "medium", row: 1, base: 40, speed: 0.9 },
  { kind: "large", row: 8, base: 55, speed: 1.1 }
];

function cloudsLayer(v: View, t: number, e: Env, phase: number, near: boolean): Grid {
  const g = blank();
  const inkLight = luma(near ? e.pal.cloudNear : e.pal.cloudFar) > luma(e.pal.skyTop);
  const specs = near ? NEAR : FAR;
  const c = e.cond.cloud;
  const count = c >= 0.95 ? specs.length : c > 0.5 ? Math.ceil(specs.length * 0.6) : c > 0.2 ? 2 : near ? 1 : 1;
  const span = COLS + 24;
  for (let i = 0; i < count; i++) {
    const s = specs[i];
    const rows = cloudRows(s.kind, e.lightSide, inkLight);
    const x = Math.floor(mod(s.base + phase * s.speed, span)) - 20;
    stamp(g, x, s.row, rows, false);
  }
  if (c >= 0.95 && !near) {
    // Overcast: one thin stratus sheet across the top, drifting slowly.
    const st = cloudRows("stratus", e.lightSide, inkLight);
    const off = Math.floor(mod(phase * 0.25, 22));
    for (let k = -1; k < 3; k++) stamp(g, k * 22 - off, 0, st, false);
  }
  if (c >= 0.95 && near && e.cond.storm) stamp(g, Math.floor(mod(14 + phase * 0.8, span)) - 20, 3, cloudRows("storm", e.lightSide, inkLight), false);
  return g;
}

function weatherLayer(v: View, t: number, e: Env): Grid {
  const g = blank();
  const windy = v.windKmh > 18;
  if (e.cond.rain) {
    const n = v.precipMm >= 4 ? 44 : v.precipMm >= 1 ? 30 : 18;
    const glyph = v.windKmh > 30 ? "/" : windy ? "/" : "|";
    for (let i = 0; i < n; i++) {
      const y = Math.floor(mod(i * 7 + t * 0.9 + hash(i) * 20, GROUND_END - 1));
      const x = mod(i * 11 + Math.floor(t / (windy ? 3 : 10)) + Math.floor(hash(i + 500) * 40), COLS);
      put(g, x, y, glyph);
    }
    // Splashes on the ground.
    for (let i = 0; i < 8; i++) {
      const k = Math.floor((t + i * 7) / 6);
      const x = Math.floor(hash(k * 31 + i) * COLS);
      const y = HORIZON + 1 + Math.floor(hash(k * 17 + i) * 8);
      put(g, x, y, (t + i) % 6 < 3 ? "." : "o");
    }
  }
  if (e.cond.snow) {
    for (let i = 0; i < 36; i++) {
      const y = Math.floor(mod(i * 5 + t * 0.25 + hash(i) * 20, GROUND_END));
      const x = mod(i * 9 + Math.round(Math.sin(t / 14 + i) * 1.5) + Math.floor(hash(i + 900) * 40), COLS);
      put(g, x, y, "*");
    }
  }
  if (e.cond.fog) {
    for (let row = 9; row < HORIZON + 4; row++) {
      const off = Math.floor(mod(t * 0.15 * (row % 2 ? 1 : -1) + row * 3, 12));
      for (let x = 0; x < COLS; x++) if ((x + off) % 12 < 5 && (x + row) % 3 !== 0) put(g, x, row, row % 2 ? "-" : "~");
    }
  }
  if (e.hot && !e.night && !e.cond.rain) {
    // Heat shimmer: wavy air just above the dunes.
    for (let row = HORIZON - 5; row < HORIZON - 1; row++) {
      for (let x = 0; x < COLS; x++) {
        const s = Math.sin(x * 0.6 + t * 0.35 + row * 1.7);
        if (s > 0.72) put(g, x, row, s > 0.93 ? "~" : "-");
      }
    }
    // Dust devil on a windy hot day.
    if (e.sand && v.windKmh > 14) {
      const cycle = 760;
      const k = t % cycle;
      if (k < 56) {
        const x0 = 2 + Math.floor(hash(Math.floor(t / cycle) + 7) * 30);
        const x = x0 + Math.floor(k / 3);
        const spin = ["(", ")", "|"][Math.floor(k / 2) % 3];
        const spin2 = [")", "(", "|"][Math.floor(k / 2) % 3];
        put(g, x, HORIZON - 4, " " + spin2 + " ", false);
        put(g, x, HORIZON - 3, spin + " " + spin2, false);
        put(g, x, HORIZON - 2, spin2 + " " + spin, false);
        put(g, x, HORIZON - 1, " " + spin + " ", false);
        put(g, x - 1, HORIZON, ".'.'.", false);
      }
    }
  }
  if (e.cond.storm && e.cond.rain && t % 140 < 2) {
    // Lightning.
    const x = 6 + Math.floor(hash(Math.floor(t / 140)) * 28);
    const bolt = ["\\", " \\", "  /", " /", "  \\", "   \\", "  /"];
    stamp(g, x, 5, bolt, false);
  }
  return g;
}

/** Dune ridge height above the horizon row, in rows (about 0.3..3.2), for a column. */
const duneH = (x: number) => 1.6 + 1.0 * Math.sin(x / 6.5 + 0.4) + 0.55 * Math.sin(x / 3.1 + 1.9);
const hillH = (x: number) => 1.6 + 1.1 * Math.sin(x / 7.2 + 1.1) + 0.4 * Math.sin(x / 3.3);
/** First row occupied by the ridge at a column; sky things are clipped above it. */
export const ridgeTop = (x: number, sand: boolean) => HORIZON - 1 - Math.floor(sand ? duneH(x) : hillH(x));

/** Draw a ridge: a clean silhouette line, with shadow only on the slopes that face away from the light. */
function ridge(g: Grid, sand: boolean, side: number, inkLight: boolean): void {
  const H = sand ? duneH : hillH;
  for (let x = 0; x < COLS; x++) {
    const top = ridgeTop(x, sand);
    const slope = H(x + 1) - H(x - 1);
    const ch = slope > 0.45 ? "/" : slope < -0.45 ? "\\" : sand ? "_" : "-";
    g[top][x] = ch;
    // Where the ridge steps down a row, keep the line connected.
    const prev = x > 0 ? ridgeTop(x - 1, sand) : top;
    if (prev < top - 1) for (let y = prev + 1; y < top; y++) g[y][x - 1] = "\\";
    if (prev > top + 1) for (let y = top + 1; y < prev; y++) g[y][x] = "/";
    // Shadow side: the slope faces away from the light.
    const facing = slope * side;
    if (facing < -0.25) {
      const depth = Math.min(2, Math.round(-facing * 3));
      for (let k = 1; k <= depth && top + k < HORIZON; k++) g[top + k][x] = toChar(k === 1 ? 0.35 : 0.2, inkLight, " .:-=");
    } else if (Math.abs(slope) < 0.12 && top + 1 < HORIZON && x % 3 === 0) {
      g[top + 1][x] = inkLight ? "." : ".";
    }
  }
}

function groundLayer(v: View, t: number, e: Env): Grid {
  const g = blank();
  const inkLight = luma(e.pal.ground) > luma(e.pal.groundTop);
  const side = e.lightSide; // -1 light from the left .. 1 from the right
  const reduced = false;

  if (e.sand) {
    ridge(g, true, side, inkLight);
    // Sand surface with perspective: sparse near the horizon, denser and rippled near the viewer.
    for (let y = HORIZON; y <= GROUND_END; y++) {
      const depth = (y - HORIZON) / (GROUND_END - HORIZON);
      for (let x = 0; x < COLS; x++) {
        const r = hash(x * 131 + y * 17);
        const drift = Math.floor(t * 0.02 * (v.windKmh / 10));
        const ripple = Math.sin((x + drift) * 0.9 + y * 2.1) > 0.92 && depth > 0.5;
        if (ripple) g[y][x] = "~";
        else if (r < 0.03 + depth * 0.08) g[y][x] = r < 0.02 ? "." : depth > 0.6 ? "," : ".";
      }
    }
    // Tufts of dry grass that lean with the wind.
    if (v.mood !== "burrowed") {
      const lean = reduced ? 0 : Math.round(Math.sin(t / 7) * Math.min(1, v.windKmh / 25));
      const tuft = lean > 0 ? "\\|/" : lean < 0 ? "\\|/" : "\\|/";
      put(g, 3 + lean, 19, tuft);
      put(g, 33 + lean, 22, tuft);
      put(g, 8, 24, lean > 0 ? ",/" : ",\\");
      put(g, 29, 18, "v");
    }
  } else {
    ridge(g, false, side, inkLight);
    const pine = ["  ^  ", " /^\\ ", "  |  "];
    stamp(g, 4, ridgeTop(6, false) - 3, pine, false);
    stamp(g, 31, ridgeTop(33, false) - 3, pine, false);
    stamp(g, 20, ridgeTop(22, false) - 2, ["(&&)", " && "], false);
    // Grass with blades that sway.
    for (let y = HORIZON; y <= GROUND_END; y++) {
      const depth = (y - HORIZON) / (GROUND_END - HORIZON);
      for (let x = 0; x < COLS; x++) {
        const r = hash(x * 97 + y * 29);
        if (r < 0.03 + depth * 0.09) {
          const sway = Math.sin(x * 0.5 + t * 0.12 * (v.windKmh / 12) + y);
          g[y][x] = depth < 0.4 ? "'" : depth < 0.75 ? (sway > 0.5 ? "," : "'") : sway > 0.4 ? "/" : sway < -0.4 ? "\\" : '"';
        } else if (r > 0.992) g[y][x] = "o";
      }
    }
  }

  // Small stones for the Truffles that came before.
  const past = v.mood === "dead" ? v.gravestones.slice(0, -1) : v.gravestones;
  past.slice(-6).forEach((_, i) => put(g, 1 + i * 2, GROUND_END, "n"));
  return g;
}

function petLayer(v: View, t: number, e: Env, reduced: boolean): { g: Grid; x: number; y: number; w: number; eyeRow: number } {
  const g = blank();
  const inkLight = luma(e.pal.pet) > luma(e.pal.groundTop);
  if (v.mood === "dead") {
    const stone = gravestone(v.stage, inkLight, v.ageDays > 0);
    const x = Math.floor((COLS - stone[0].length) / 2);
    const top = ANCHOR - stone.length;
    stamp(g, x, top, stone, false);
    const a = `${v.ageDays} ${v.ageDays === 1 ? "day" : "days"}`;
    const s = `${v.lifetimeSteps} steps`;
    put(g, Math.floor((COLS - a.length) / 2), ANCHOR, a);
    put(g, Math.floor((COLS - s.length) / 2), GROUND_END, s);
    return { g, x, y: top, w: stone[0].length, eyeRow: top + 2 };
  }
  if (v.mood === "burrowed") {
    const peek = !reduced && t % 150 < 14;
    const rows = mound(e.light, inkLight, peek);
    const x = Math.floor((COLS - rows[0].length) / 2);
    stamp(g, x, 21, rows, false);
    return { g, x, y: 21, w: rows[0].length, eyeRow: 23 };
  }
  const face: Face = v.yawn ? "yawn" : v.mood;
  const sp = spriteFor(v.stage, face, { light: e.light, inkLight, frame: t, reduced });
  const w = sp.rows[0].length;
  const x = Math.floor((COLS - w) / 2) + sp.lean;
  const y = ANCHOR - sp.rows.length + 1;
  stamp(g, x, y, sp.rows, false);
  return { g, x, y, w, eyeRow: y + sp.eyeRow };
}

function fxLayer(v: View, t: number, e: Env, pet: { x: number; y: number; w: number; eyeRow: number }, reduced: boolean): Grid {
  const g = blank();
  const { x, y, w } = pet;
  if (v.mood === "asleep" || v.mood === "burrowed") {
    const k = reduced ? 1 : Math.floor(t / 6) % 5;
    const zx = x + w - 3;
    const zy = v.mood === "burrowed" ? 20 : y;
    put(g, zx + (k % 2), Math.max(HORIZON - 2, zy - 1 - k), "z", false);
    put(g, zx + 2, Math.max(HORIZON - 2, zy - 2 - ((k + 2) % 5)), "Z", false);
    put(g, zx + 4, Math.max(HORIZON - 2, zy - 4 - ((k + 4) % 5)), k % 2 ? "z" : " ", false);
  }
  if (v.mood === "affectionate") {
    const hearts = ["<3", "<3", "v"];
    for (let i = 0; i < 3; i++) {
      const k = reduced ? i * 3 : Math.floor((t + i * 9) / 5) % 11;
      if (k > 8) continue;
      put(g, x + w - 1 + i * 2 - (i === 1 ? 4 : 0), y - 1 - k + (i === 2 ? 2 : 0), hearts[i], false);
    }
  }
  if (v.mood === "wilting" && !reduced) {
    // A leaf lets go now and then and drifts to the ground.
    const cycle = 96;
    const k = t % cycle;
    if (k < 10) put(g, x + w - 4 + Math.floor(k / 3), y + k, ",", false);
  }
  if (v.yawn && !reduced) put(g, x - 2, pet.eyeRow + 1, t % 12 < 6 ? "~" : " ", false);
  if (v.mood === "burrowed" && !e.night) {
    // Heat rising off the mound.
    for (let i = 0; i < 3; i++) {
      const k = reduced ? 0 : Math.floor((t + i * 4) / 4) % 4;
      put(g, x + 2 + i * 5, 20 - k, k % 2 ? "(" : ")", false);
    }
  }
  // Birds at dawn and dusk under a clear sky.
  if (!reduced && e.sunH > 0 && e.sunH < 0.35 && e.cond.cloud < 0.6 && !e.cond.rain) {
    const cycle = 380;
    const k = t % cycle;
    if (k < 60) {
      const row = 3 + Math.floor(hash(Math.floor(t / cycle) + 3) * 4);
      const bx = -8 + k;
      const wing = Math.floor(k / 4) % 2 ? "^v^" : "-v-";
      put(g, bx, row, wing, false);
      put(g, bx - 5, row + 1, wing, false);
      put(g, bx - 9, row, wing, false);
    }
  }
  // Fireflies in grass country at night.
  if (!e.sand && e.night && !e.cond.rain) {
    for (let i = 0; i < 7; i++) {
      const on = reduced ? i % 2 === 0 : (Math.floor(t / 5) + i * 7) % 9 < 2;
      if (!on) continue;
      const fx = Math.floor(hash(i * 13 + 1) * COLS + (reduced ? 0 : Math.sin(t / 30 + i) * 2));
      const fy = HORIZON + 1 + Math.floor(hash(i * 7 + 2) * 7);
      put(g, mod(fx, COLS), fy, "*", false);
    }
  }
  return g;
}

function hudLayer(v: View): Grid {
  const g = blank();
  put(g, 0, HUD_ROW - 1, "\u2500".repeat(COLS));
  const filled = clamp(Math.round(v.energyPct / 10), 0, 10);
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(10 - filled);
  const hud = ` ${bar} ${String(v.energyPct).padStart(3)}% ${v.stage.padEnd(7)} ${v.stepsToday}st ${v.tier}`;
  put(g, 0, HUD_ROW, hud.slice(0, COLS));
  return g;
}

/** Compose every layer. Exported for tests and screenshots. */
export function composeAll(v: View, t: number, cloudPhase: number, hour: number, now: Date, reduced: boolean): { layers: Record<LayerName, string>; env: Env } {
  const e = envFor(v, hour, now);
  const pet = petLayer(v, t, e, reduced);
  const ground = groundLayer(v, t, e);
  for (let y = 0; y < ROWS; y++) {
    const row = pet.g[y];
    let a = -1;
    let b = -1;
    for (let x = 0; x < COLS; x++) if (row[x] !== " ") { if (a < 0) a = x; b = x; }
    for (let x = a; a >= 0 && x <= b; x++) ground[y][x] = " ";
  }
  const layers: Record<LayerName, string> = {
    stars: text(starsLayer(v, t, e)),
    sun: text(sunLayer(v, t, e)),
    cloudsFar: text(cloudsLayer(v, t, e, cloudPhase, false)),
    cloudsNear: text(cloudsLayer(v, t, e, cloudPhase, true)),
    weather: text(weatherLayer(v, t, e)),
    ground: text(ground),
    pet: text(pet.g),
    fx: text(fxLayer(v, t, e, pet, reduced)),
    hud: text(hudLayer(v))
  };
  return { layers, env: e };
}

export class World {
  view: View = { ...EMPTY_VIEW };
  private reduced = false;
  private t = 0;
  private cloudPhase = 0;
  private last: Partial<Record<LayerName, string>> = {};
  private els: Record<LayerName, HTMLElement>;
  private next: number | null = null;
  private prev: number | null = null;
  private paletteKey = "";
  frames = 0;

  constructor(private root: HTMLElement) {
    root.textContent = "";
    this.els = {} as Record<LayerName, HTMLElement>;
    for (const name of LAYERS) {
      const pre = document.createElement("pre");
      pre.className = "layer";
      pre.dataset.layer = name;
      pre.setAttribute("aria-hidden", "true");
      root.appendChild(pre);
      this.els[name] = pre;
    }
    document.addEventListener("visibilitychange", () => {
      this.next = null;
      this.prev = null;
    });
  }

  set(v: Partial<View>): void {
    this.view = { ...this.view, ...v };
  }

  setReduced(on: boolean): void {
    this.reduced = on;
  }

  hour(): number {
    return this.view.hourOverride ?? localHour(this.view.tz);
  }

  private applyPalette(e: Env): void {
    const p = e.pal;
    const key = Object.values(p).join("|") + this.view.mood;
    if (key === this.paletteKey) return;
    this.paletteKey = key;
    const split = ((HORIZON / ROWS) * 100).toFixed(3) + "%";
    this.root.style.background = `linear-gradient(to bottom, ${p.skyTop} 0%, ${p.skyHorizon} ${split}, ${p.groundTop} ${split}, ${p.groundBottom} 100%)`;
    const colour: Record<LayerName, string> = {
      stars: p.stars,
      sun: p.sun,
      cloudsFar: p.cloudFar,
      cloudsNear: p.cloudNear,
      weather: p.weather,
      ground: p.ground,
      pet: p.pet,
      fx: p.fx,
      hud: p.hud
    };
    for (const name of LAYERS) this.els[name].style.color = colour[name];
    const m = this.view.mood;
    this.els.pet.style.filter = m === "wilting" ? "grayscale(0.85) opacity(0.8)" : m === "tired" ? "opacity(0.9)" : "none";
    this.root.style.filter = m === "dead" ? "saturate(0.55)" : "none";
  }

  /** Render one frame now (used once at boot and by the loop). */
  draw(): void {
    const hour = this.hour();
    const { layers, env } = composeAll(this.view, this.t, this.cloudPhase, hour, new Date(), this.reduced);
    this.applyPalette(env);
    let wrote = false;
    for (const name of LAYERS) {
      const s = layers[name];
      if (s !== this.last[name]) {
        this.last[name] = s;
        this.els[name].textContent = s;
        wrote = true;
      }
    }
    if (wrote) this.frames++;
  }

  start(): void {
    const loop = (now: number) => {
      requestAnimationFrame(loop);
      if (document.hidden) return;
      if (this.next === null) this.next = now;
      if (now + 0.25 < this.next) return;
      this.next += PERIOD;
      if (this.next < now) this.next += Math.ceil((now - this.next) / PERIOD) * PERIOD;
      const elapsed = this.prev === null ? 0 : now - this.prev;
      this.prev = now;
      if (!this.reduced) {
        this.t++;
        this.cloudPhase = mod(this.cloudPhase + (Math.min(elapsed, 250) / 1000) * (this.view.windKmh / 20 + 0.15), 100000);
      }
      this.draw();
    };
    this.draw();
    requestAnimationFrame(loop);
  }
}
