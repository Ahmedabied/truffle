// A dense, lit ASCII world at 100 x 68 cells. Static geometry is cached;
// moving geometry is rasterised at 60 Hz and only changed glyph cells paint.
// The legacy effects retain a 12 Hz clock. Breathing uses elapsed seconds.

import type { Stage, Tier } from "../../../worker/src/config";
import type { Gravestone, Mood } from "../../../worker/src/engine";
import { arc, moonPhase, starField, sunHeight, sunTimes } from "./astro";
import { COLS, ROWS } from "./grid";
import { canonicalHour, mix, paletteAt, type Conditions, type Palette } from "./palette";
import { BITMAPS, drawPet, type Face, type PetInfo } from "./pet";
import { ASPECT, clamp, disc, hash, Layer, line, luma, noise, normalize, shade, smooth, stamp, SOFT, RAMP, type Vec3 } from "./raster";
import { localHour } from "./sky";
import { celebration, DURATION, MOMENT_KINDS, type MomentKind } from "./fx";
import { Surface, type Ink, type Paint } from "./surface";
import { drawKeepsakes, hitKeepsake, type GiftArea, type WorldKeepsake } from "./keepsakes";
import { distantRange, distantTop, foreground, groundDetails, grove } from "./landscape";

const PERIOD = 1000 / 60;
export const HORIZON = 40; // first ground row
const ANCHOR = 58; // ground contact row of the Truffle
const SKY_TOP = 2;

export const GULF = new Set(["OM", "AE", "SA", "QA", "KW", "BH", "YE", "IQ", "JO", "EG", "LY"]);

export const LAYERS = ["sky", "stars", "sun", "cloudsFar", "cloudsNear", "distance", "ground", "nature", "weather", "pet", "cap", "skin", "white", "foreground", "gifts", "fx"] as const;
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
  /** Brief companion expression. Server health and weather remain authoritative. */
  reaction?: "happy" | "anticipating" | null;
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

export function presentationFace(v: View): Face {
  if (v.mood === "dead" || v.mood === "burrowed") return v.mood;
  if (v.yawn) return "yawn";
  return v.reaction ? "affectionate" : v.mood;
}

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
  /** Light direction at the Truffle, z toward the viewer. */
  light: Vec3;
  /** Which side of the scene the light sits on: -1 left .. 1 right. */
  lightSide: number;
  hot: boolean;
  night: boolean;
}

function lightFrom(lx: number, ly: number, cx: number, cy: number, height: number): Vec3 {
  const dx = (lx - cx) * ASPECT;
  const dy = ly - cy;
  const d = Math.hypot(dx, dy) || 1;
  return normalize([dx / d, dy / d, height]);
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
  const sunPos = arc(sunP, COLS, SKY_TOP + 4, HORIZON - 4);
  const phase = v.moonOverride ?? moonPhase(now);
  const moonHour = mod(hour - phase * 24, 24);
  const moonP = (moonHour - rise) / (set - rise);
  const moonUp = moonP > -0.05 && moonP < 1.05 && sunH < 0.25;
  const moonPos = arc(clamp(moonP, -0.05, 1.05), COLS, SKY_TOP + 4, HORIZON - 4);

  const petX = COLS / 2;
  const petY = ANCHOR - 10;
  let light: Vec3;
  let lightSide: number;
  if (sunH > 0.02) {
    light = lightFrom(sunPos.x, sunPos.y, petX, petY, 0.9);
    lightSide = (sunPos.x - petX) / (COLS / 2);
  } else if (moonUp) {
    light = lightFrom(moonPos.x, moonPos.y, petX, petY, 1.0);
    lightSide = (moonPos.x - petX) / (COLS / 2);
  } else {
    light = normalize([-0.35, -0.6, 0.9]);
    lightSide = -0.35;
  }
  if (cond.cloud > 0.6 || cond.fog) light = normalize([light[0] * 0.35, light[1] * 0.6, 1.1]);
  // Keep a little left bias so a noon sun still gives every form a lit and a shadow side.
  lightSide = clamp(lightSide - 0.3, -1, 1);
  if (Math.abs(light[0]) < 0.25) light = normalize([light[0] - 0.3, light[1], light[2]]);

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

// ---------- terrain ----------

/** Ridge height above the horizon in rows for a column. Sand dunes are long and soft, hills are rounder. */
const duneH = (x: number) => 3.2 + 2.6 * Math.sin(x / 16 + 0.4) + 1.3 * Math.sin(x / 7.5 + 1.9) + 0.4 * Math.sin(x / 3.1);
const hillH = (x: number) => 3.4 + 2.8 * Math.sin(x / 18 + 1.1) + 1.1 * Math.sin(x / 8.3) + 0.5 * Math.sin(x / 4.1 + 2);
/** First row occupied by the near ridge at a column; sky things are clipped above it. */
export const ridgeTop = (x: number, sand: boolean) => HORIZON - 1 - Math.floor(sand ? duneH(x) : hillH(x));
const skyline = (x: number, sand: boolean) => Math.min(ridgeTop(x, sand), distantTop(x, sand));

// ---------- layers ----------

const STARS = starField(COLS, HORIZON - 6, 90);

function skyLayer(L: Layer, e: Env, t: number): void {
  // Sun glow and horizon haze, as sparse dots in the sun's colour.
  const haze = e.cond.fog ? 0.55 : e.cond.cloud > 0.6 ? 0.25 : 0.35;
  for (let y = 0; y < HORIZON; y++) {
    for (let x = 0; x < COLS; x++) {
      let l = 0;
      if (e.sun.up && e.cond.cloud < 0.95) {
        const d = Math.hypot((x - e.sun.x) * ASPECT, y - e.sun.y);
        const r = 4 + (1 - clamp(e.sunH, 0, 1)) * 5;
        l = Math.max(l, 0.6 * Math.exp(-Math.max(0, d - 3.5) / r));
        // Rays near the horizon.
        if (e.sunH < 0.35 && d > 4) {
          const a = Math.atan2(y - e.sun.y, (x - e.sun.x) * ASPECT);
          const ray = Math.pow(Math.max(0, Math.cos(a * 11 + t * 0.01)), 14);
          l = Math.max(l, ray * 0.45 * Math.exp(-d / 26) * (1 - clamp(e.sunH / 0.35, 0, 1)));
        }
      }
      // Haze band just above the horizon.
      const band = smooth(HORIZON - 9, HORIZON - 1, y) * haze * 0.6;
      l = Math.max(l, band * (0.6 + 0.4 * noise(x * 0.06, y * 0.5 + t * 0.002, 2)));
      if (l > 0.03) L.set(x, y, l);
    }
  }
  for (let x = 0; x < COLS; x++) for (let y = skyline(x, e.sand); y < HORIZON; y++) L.set(x, y, -1);
}

function starsLayer(L: Layer, e: Env, t: number): void {
  const dark = clamp((0.08 - e.sunH) / 0.5, 0, 1);
  if (dark > 0) {
    const n = Math.floor(STARS.length * dark);
    for (const s of STARS) {
      if (s.rank >= n) continue;
      const k = Math.floor(t / (s.bright ? 5 : 9) + s.phase) % 4;
      const l = s.bright ? [1, 0.8, 1, 0.6][k] : [0.6, 0.45, 0.6, 0.3][k];
      L.add(s.x, s.y, l);
      if (s.bright && k !== 3) {
        L.add(s.x - 1, s.y, 0.25);
        L.add(s.x + 1, s.y, 0.25);
      }
    }
    if (dark > 0.9) {
      const cycle = 520;
      const k = t % cycle;
      if (k < 9) {
        const row = 3 + Math.floor(hash(Math.floor(t / cycle)) * 10);
        const x0 = 10 + Math.floor(hash(Math.floor(t / cycle) + 99) * 60);
        for (let i = 0; i < 7; i++) L.add(x0 + k * 3 - i * 2, row + Math.floor((k * 3 - i * 2) / 9), 1 - i * 0.14);
      }
    }
  }
  if (e.moon.up && e.moon.phase > 0.04 && e.moon.phase < 0.96) {
    // A sphere lit from the phase angle, with a faint earthshine.
    const a = e.moon.phase * Math.PI * 2;
    const ml: Vec3 = normalize([Math.sin(a), -0.1, -Math.cos(a)]);
    const cx = e.moon.x * ASPECT + ASPECT / 2;
    const cy = e.moon.y + 0.5;
    const r = 3.1;
    for (let y = Math.floor(cy - r) - 1; y <= Math.ceil(cy + r) + 1; y++) {
      for (let x = Math.floor((cx - r) / ASPECT) - 1; x <= Math.ceil((cx + r) / ASPECT) + 1; x++) {
        const u = ((x + 0.5) * ASPECT - cx) / r;
        const v = (y + 0.5 - cy) / r;
        const d = u * u + v * v;
        if (d > 1) continue;
        const nz = Math.sqrt(1 - d);
        const n: Vec3 = [u, v, nz];
        let l = Math.max(0, n[0] * ml[0] + n[1] * ml[1] + n[2] * ml[2]);
        l = 0.08 + 0.92 * l + 0.07 * noise(x * 0.9, y * 1.4, 3);
        L.set(x, y, clamp(l, 0, 1));
      }
    }
  }
  for (let x = 0; x < COLS; x++) for (let y = skyline(x, e.sand); y < ROWS; y++) L.set(x, y, -1);
}

function sunLayer(L: Layer, e: Env): void {
  if (!e.sun.up || e.cond.cloud >= 0.95 || e.cond.fog) return;
  const low = clamp(1 - e.sunH / 0.25, 0, 1);
  const r = 2.6 + low * 1.8;
  const cx = e.sun.x * ASPECT + ASPECT / 2;
  let cy = e.sun.y + 0.5;
  if (low > 0) {
    // A big low sun rests on the ridge instead of sinking behind it.
    let top = ROWS;
    for (let x = e.sun.x - 6; x <= e.sun.x + 6; x++) top = Math.min(top, skyline(clamp(x, 0, COLS - 1), e.sand));
    cy = Math.min(cy + low * 2, top - r * 0.35);
  }
  disc(L, cx, cy, r, 1, 0.5);
  for (let x = 0; x < COLS; x++) for (let y = skyline(x, e.sand); y < ROWS; y++) L.set(x, y, -1);
}

interface CloudSpec {
  /** Centre row. */
  row: number;
  base: number;
  speed: number;
  /** Blobs: [dx, dy, r] in row units. */
  blobs: [number, number, number][];
}
const FAR: CloudSpec[] = [
  { row: 7, base: 6, speed: 0.5, blobs: [[0, 0, 2.2], [2.6, -0.4, 1.9], [-2.4, 0.3, 1.6]] },
  { row: 12, base: 30, speed: 0.4, blobs: [[0, 0, 1.6], [2.2, 0.2, 1.3], [5, 0.1, 1.2], [-2, 0.3, 1.1]] },
  { row: 5, base: 48, speed: 0.55, blobs: [[0, 0, 1.8], [2.4, -0.3, 1.5]] },
  { row: 15, base: 70, speed: 0.45, blobs: [[0, 0, 1.5], [2, 0.2, 1.3], [-1.8, 0.4, 1.0]] },
  { row: 9, base: 86, speed: 0.5, blobs: [[0, 0, 2.0], [-2.6, 0.4, 1.4], [2.4, 0.2, 1.6]] }
];
const NEAR: CloudSpec[] = [
  { row: 9, base: 14, speed: 1.0, blobs: [[0, 0, 3.4], [4.2, -0.8, 2.9], [-4, 0.6, 2.4], [8, 0.4, 2.1], [2, 1.6, 2.6]] },
  { row: 16, base: 46, speed: 1.2, blobs: [[0, 0, 4.2], [5.4, -1.2, 3.4], [-5, 0.8, 2.8], [10, 0.6, 2.4], [2.5, 2.0, 3.2], [-9, 1.4, 2.0]] },
  { row: 4, base: 72, speed: 0.9, blobs: [[0, 0, 3.0], [3.8, -0.4, 2.6], [-3.4, 0.5, 2.0], [7, 0.8, 1.8]] },
  { row: 20, base: 100, speed: 1.1, blobs: [[0, 0, 3.6], [4.6, -1.0, 3.0], [-4.4, 0.7, 2.6], [9, 0.5, 2.2], [1.5, 1.8, 2.8]] }
];
const STORM: CloudSpec = { row: 8, base: 0, speed: 0.8, blobs: [[0, 0, 5], [6, -1.5, 4.2], [-6, 1, 3.8], [12, 0.5, 3.4], [3, 3, 4.6], [-11, 2, 3], [-2, -3.2, 3.2]] };

// Gaussian blobs are separable. Reuse their axis samples for the field and
// its original finite differences, without changing the noise or the lighting.
// Float64 keeps the intermediates at JS number precision; no quantised lookup.
const CLOUD_AXES = new WeakMap<CloudSpec, { x: Float64Array; y: Float64Array }>();

function cloud(L: Layer, cx: number, cy: number, spec: CloudSpec, e: Env, t: number, soft: number): void {
  const blobs = spec.blobs;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [dx, dy, r] of blobs) {
    minX = Math.min(minX, cx + dx - r * 1.5);
    maxX = Math.max(maxX, cx + dx + r * 1.5);
    minY = Math.min(minY, cy + dy - r * 1.5);
    maxY = Math.max(maxY, cy + dy + r * 1.5);
  }
  const x0 = Math.max(0, Math.floor(minX / ASPECT));
  const x1 = Math.min(COLS - 1, Math.ceil(maxX / ASPECT));
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(HORIZON - 1, Math.ceil(maxY));
  if (x0 > x1 || y0 > y1) return;
  const light: Vec3 = normalize([e.lightSide * 0.6, -0.8, 0.5]);
  const count = blobs.length;
  let axes = CLOUD_AXES.get(spec);
  if (!axes) {
    axes = { x: new Float64Array(COLS * 3 * count), y: new Float64Array(HORIZON * 3 * count) };
    CLOUD_AXES.set(spec, axes);
  }
  const xs = axes.x;
  const ys = axes.y;
  for (let x = x0; x <= x1; x++) {
    const X = (x + 0.5) * ASPECT;
    for (let k = 0; k < 3; k++) {
      const sample = k === 0 ? X : k === 1 ? X + 0.3 : X - 0.3;
      for (let i = 0; i < count; i++) {
        const [dx, , r] = blobs[i];
        const u = (sample - cx - dx) / r;
        xs[(x * 3 + k) * count + i] = Math.exp(-(u * u) * 1.6);
      }
    }
  }
  for (let y = y0; y <= y1; y++) {
    const Y = y + 0.5;
    for (let k = 0; k < 3; k++) {
      const sample = k === 0 ? Y : k === 1 ? Y + 0.3 : Y - 0.3;
      for (let i = 0; i < count; i++) {
        const [, dy, r] = blobs[i];
        const v = (sample - cy - dy) / (r * 0.78);
        ys[(y * 3 + k) * count + i] = Math.exp(-(v * v) * 1.6);
      }
    }
  }
  const field = (X: number, Y: number, xi: number, yi: number) => {
    let f = 0;
    for (let i = 0; i < count; i++) f += xs[xi + i] * ys[yi + i];
    return f + 0.18 * noise(X * 0.55 + t * 0.004, Y * 0.7, 11);
  };
  for (let y = y0; y <= y1; y++) {
    const Y = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const X = (x + 0.5) * ASPECT;
      const xi = x * 3 * count;
      const yi = y * 3 * count;
      const f = field(X, Y, xi, yi);
      if (f < 0.55) continue;
      const gx = field(X + 0.3, Y, xi + count, yi) - field(X - 0.3, Y, xi + count * 2, yi);
      const gy = field(X, Y + 0.3, xi, yi + count) - field(X, Y - 0.3, xi, yi + count * 2);
      const n = normalize([-gx * 2.2, -gy * 2.2, 0.55 + Math.min(1, f - 0.55)]);
      let l = shade(n, light, 0.32, 0);
      const edge = smooth(0.55, 0.95, f);
      l = l * (0.55 + 0.45 * edge) * soft;
      L.add(x, y, clamp(l, 0, 1));
    }
  }
}

function cloudsLayer(L: Layer, e: Env, t: number, phase: number, near: boolean): void {
  const specs = near ? NEAR : FAR;
  const c = e.cond.cloud;
  const count = c >= 0.95 ? specs.length : c > 0.5 ? Math.ceil(specs.length * 0.6) : c > 0.2 ? 2 : 1;
  const span = COLS * ASPECT + 30;
  const soft = near ? 1 : 0.8;
  for (let i = 0; i < count; i++) {
    const s = specs[i];
    const X = mod(s.base + phase * s.speed, span) - 15;
    cloud(L, X, s.row, s, e, t, soft);
  }
  if (c >= 0.95 && !near) {
    // Overcast: a long sheet across the top.
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < COLS; x++) {
        const n = noise(x * 0.09 + phase * 0.01, y * 0.35, 21) * 0.5 + 0.5;
        const l = (1 - y / 9) * 0.5 * (0.4 + 0.6 * n);
        if (l > 0.06) L.add(x, y, l);
      }
    }
  }
  if (c >= 0.95 && near && e.cond.storm) cloud(L, mod(20 + phase * 0.8, span) - 15, STORM.row, STORM, e, t, 0.75);
  for (let x = 0; x < COLS; x++) for (let y = skyline(x, e.sand); y < ROWS; y++) L.set(x, y, -1);
}

function groundLayer(L: Layer, v: View, e: Env, t: number): void {
  const sand = e.sand;
  const H = sand ? duneH : hillH;
  const side = e.lightSide;
  const light: Vec3 = normalize([side, -0.35, 0.45]);
  const wind = v.windKmh;
  const drift = t * 0.01 * (wind / 10);
  // At night the ground is a quiet etching, not a luminous wall of @ glyphs.
  const terrain = (x: number, y: number, l: number) => L.set(x, y, e.night ? 0.025 + (1 - l) * 0.32 : l);
  // Near ridge, the dune face: one side lit almost to paper, the other in shadow.
  for (let x = 0; x < COLS; x++) {
    const top = ridgeTop(x, sand);
    const slope = (H(x + 2) - H(x - 2)) / (4 * ASPECT);
    const n = normalize([-slope * (sand ? 1.6 : 1.1), -0.55, 0.7]);
    const faceL = 0.2 + 0.8 * shade(n, light, 0.05, 0);
    for (let y = top; y < HORIZON; y++) {
      const k = smooth(top, HORIZON + 1, y);
      let l = faceL * (1 - k * 0.45) + 0.8 * k * 0.45;
      l += (sand ? 0.04 : 0.08) * noise(x * 0.35, y * 0.9, 7);
      if (y === top) l = Math.min(l, 0.45 + 0.3 * faceL);
      terrain(x, y, clamp(l, 0, 1));
    }
  }
  // Ground plane: broad dune bodies in perspective, mostly paper, with ripples that get coarser toward the viewer.
  for (let y = HORIZON; y < ROWS; y++) {
    const depth = (y - HORIZON) / (ROWS - HORIZON);
    for (let x = 0; x < COLS; x++) {
      const X = x * ASPECT;
      let l: number;
      if (sand) {
        // Height of a low dune field; its slope toward the light decides the tone.
        const px = X / (6 + depth * 9);
        const hgt = Math.sin(px + y * 0.09 + 0.6) + 0.5 * Math.sin(px * 2.3 - y * 0.05 + 1.2);
        const slope = Math.cos(px + y * 0.09 + 0.6) + 1.15 * Math.cos(px * 2.3 - y * 0.05 + 1.2);
        l = 0.972 + 0.075 * clamp(slope * side * 0.8, -1, 1) - 0.012 * hgt;
        const ripple = Math.sin((X + drift) * (1.3 + depth * 0.9) + Math.sin(y * 0.7) * 1.5 + y * 0.4);
        l += 0.012 * ripple * depth + 0.008 * noise(X * 0.8, y * 0.45, 8);
      } else {
        const blades = noise(X * 1.3 + Math.sin(t * 0.12 * (wind / 12) + y) * 0.25, y * 1.1, 9);
        const hgt = Math.sin(X / 7 + y * 0.08) * 0.5 + 0.5 * Math.sin(X / 3.1 - y * 0.06);
        l = 0.9 + 0.07 * hgt * side + 0.035 * blades * (0.4 + depth) + 0.018 * noise(X * 0.3, y * 0.3, 10);
        if (hash(x * 97 + y * 29) > 0.991 - depth * 0.009) l -= 0.2;
      }
      // Toward the bottom edge the ground darkens a little, like it falls away.
      l -= depth * depth * 0.025;
      terrain(x, y, clamp(l, 0, 1));
    }
  }
  groundDetails(L, e);
  // Small stones for the Truffles that came before.
  const past = v.mood === "dead" ? v.gravestones.slice(0, -1) : v.gravestones;
  past.slice(-6).forEach((_, i) => {
    const sx = 4 + i * 5;
    const sy = ROWS - 4;
    for (let y = sy - 2; y <= sy; y++) for (let x = sx - 1; x <= sx + 1; x++) L.set(x, y, y === sy - 2 && x !== sx ? 0.5 : (x - sx) * side < 0 ? 0.28 : 0.42);
  });
}

/** Foreground blades move without recomputing the terrain heightfield. */
function windLayer(L: Layer, v: View, e: Env, sec: number): void {
  const wind = clamp(v.windKmh, 0, 70);
  const amplitude = Math.min(2.6, wind / 18);
  const speed = 1.1 + wind / 50;
  const tufts = e.sand
    ? [[9, 47, 4], [84, 53, 5], [20, 61, 3], [70, 44, 3]]
    : [[8, 49, 3], [19, 61, 4], [32, 47, 2], [76, 62, 4], [88, 52, 4], [67, 43, 2], [4, 65, 3], [94, 65, 3]];
  for (const [tx, ty, h] of tufts) {
    const lean = (Math.sin(sec * speed + tx * 0.2) + Math.sin(sec * speed * 0.47 + ty) * 0.4) * amplitude;
    for (let k = 0; k < h; k++) {
      for (const side of [-1, 0, 1]) {
        const x = Math.round(tx + side * k * 0.8 + lean * (k / h) ** 2);
        L.set(x, ty - k, 0.22 + 0.1 * side * e.lightSide);
      }
    }
  }
}

function shadowLayer(L: Layer, e: Env, pet: PetInfo): void {
  // Cast shadow of the Truffle.
  if (pet.shadow) {
    const s = pet.shadow;
    const soft = 0.55;
    for (let y = Math.floor(s.cy - s.ry - 1); y <= Math.ceil(s.cy + s.ry + 1); y++) {
      for (let x = Math.floor((s.cx - s.rx) / ASPECT) - 2; x <= Math.ceil((s.cx + s.rx) / ASPECT) + 2; x++) {
        const u = ((x + 0.5) * ASPECT - s.cx) / s.rx;
        const w = (y + 0.5 - s.cy) / s.ry;
        const d = Math.sqrt(u * u + w * w);
        if (d > 1 + soft) continue;
        const k = 1 - smooth(1 - soft, 1 + soft, d);
        L.mul(x, y, 1 - 0.5 * k * (e.night ? 0.5 : 1));
      }
    }
  }
}

function weatherLayer(L: Layer, v: View, e: Env, t: number): void {
  const windy = v.windKmh > 18;
  if (e.cond.rain) {
    const n = v.precipMm >= 4 ? 90 : v.precipMm >= 1 ? 60 : 35;
    const slant = v.windKmh > 30 ? 2 : windy ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const len = 2 + Math.floor(hash(i + 77) * 3);
      const y = Math.floor(mod(i * 7 + t * 2.2 + hash(i) * 60, ROWS - 4));
      const x = mod(i * 11 + Math.floor(t * slant * 0.5) + Math.floor(hash(i + 500) * 100), COLS);
      // A narrow authored stroke reads as rain instead of a fuzzy density band.
      // Fewer covered cells also leave room for 60Hz motion on slower devices.
      for (let j = 0; j < len; j++) L.symbol(x - slant * j, y - j, slant ? "\\" : "|");
    }
    for (let i = 0; i < 14; i++) {
      const k = Math.floor((t + i * 7) / 6);
      const x = Math.floor(hash(k * 31 + i) * COLS);
      const y = HORIZON + 2 + Math.floor(hash(k * 17 + i) * 22);
      const ph = (t + i) % 6;
      L.add(x, y, 0.6);
      if (ph >= 3) {
        L.add(x - 1, y, 0.35);
        L.add(x + 1, y, 0.35);
      }
    }
  }
  if (e.cond.snow) {
    for (let i = 0; i < 80; i++) {
      const y = Math.floor(mod(i * 5 + t * 0.4 + hash(i) * 60, ROWS - 2));
      const x = mod(i * 9 + Math.round(Math.sin(t / 14 + i) * 2) + Math.floor(hash(i + 900) * 100), COLS);
      L.add(x, y, 0.7 + 0.3 * hash(i + 3));
    }
  }
  if (e.cond.fog) {
    for (let y = HORIZON - 12; y < HORIZON + 10; y++) {
      const k = 1 - Math.abs(y - HORIZON) / 12;
      for (let x = 0; x < COLS; x++) {
        const n = noise(x * 0.07 + t * 0.006 * (y % 2 ? 1 : -1), y * 0.25, 15) * 0.5 + 0.5;
        const l = k * 0.55 * n;
        if (l > 0.08) L.add(x, y, l);
      }
    }
  }
  if (e.hot && !e.night && !e.cond.rain) {
    // Heat shimmer just above the dunes.
    for (let y = HORIZON - 12; y < HORIZON - 2; y++) {
      for (let x = 0; x < COLS; x++) {
        const s = Math.sin(x * 0.3 + t * 0.35 + y * 1.7) * Math.sin(x * 0.11 - t * 0.1);
        if (s > 0.74) L.add(x, y, 0.3 + (s - 0.74) * 1.5);
      }
    }
    if (e.sand && v.windKmh > 14) {
      const cycle = 760;
      const k = t % cycle;
      if (k < 70) {
        const x0 = 6 + Math.floor(hash(Math.floor(t / cycle) + 7) * 70);
        const x = x0 + Math.floor(k / 3);
        const base = ridgeTop(x, true) + 2;
        for (let j = 0; j < 9; j++) {
          const w = 1 + Math.floor(j * 0.45);
          const wob = Math.round(Math.sin(t * 0.6 + j) * 1.2);
          for (let dx = -w; dx <= w; dx++) if ((dx + j + Math.floor(t / 2)) % 2 === 0) L.add(x + dx + wob, base - j, 0.4 + 0.3 * hash(j * 3 + dx));
        }
      }
    }
  }
  if (e.cond.storm && e.cond.rain && t % 140 < 2) {
    const x = 15 + Math.floor(hash(Math.floor(t / 140)) * 70);
    let px = x;
    let py = 8;
    for (let k = 0; k < 7; k++) {
      const nx = px + (k % 2 ? 3 : -2) + Math.floor(hash(k + t) * 3) - 1;
      const ny = py + 4;
      line(L, px, py, nx, ny, 1);
      px = nx;
      py = ny;
    }
  }
}

function fxLayer(L: Layer, v: View, e: Env, t: number, pet: PetInfo, reduced: boolean): void {
  const cx = Math.floor((pet.x0 + pet.x1) / 2);
  const top = pet.y0;
  if (v.mood === "asleep" || v.mood === "burrowed") {
    const k = reduced ? 1 : Math.floor(t / 6) % 6;
    const zx = pet.x1 - 6;
    stamp(L, zx + (k % 2), top - 2 - k, BITMAPS.zSmall, 0.9);
    stamp(L, zx + 5, top - 6 - ((k + 3) % 6), BITMAPS.z, 1);
    if (k % 2) stamp(L, zx + 11, top - 10 - ((k + 4) % 6), BITMAPS.zSmall, 0.7);
  }
  if (v.mood === "affectionate") {
    for (let i = 0; i < 3; i++) {
      const k = reduced ? i * 3 : Math.floor((t + i * 9) / 5) % 12;
      if (k > 9) continue;
      const bm = i === 1 ? BITMAPS.heart : BITMAPS.heartSmall;
      stamp(L, pet.x1 - 4 + i * 6 - (i === 1 ? 14 : 0), top - 3 - k + (i === 2 ? 3 : 0), bm, 1 - k * 0.05);
    }
  }
  if (v.mood === "wilting" && !reduced) {
    const cycle = 96;
    const k = t % cycle;
    if (k < 22) stamp(L, pet.x1 - 8 + Math.floor(k / 4) + Math.round(Math.sin(k / 3)), top + k, BITMAPS.leaf, 0.8);
  }
  if (v.yawn && !reduced) {
    const k = Math.floor(t / 4) % 3;
    stamp(L, pet.x0 - 5, pet.eyeRow + 3 - k, ["~"], 0.7);
    stamp(L, pet.x0 - 7, pet.eyeRow + 5 - k, ["~~"], 0.5);
  }
  if (v.mood === "burrowed" && !e.night) {
    for (let i = 0; i < 4; i++) {
      const k = reduced ? 0 : Math.floor((t + i * 4) / 4) % 5;
      const x = cx - 9 + i * 6;
      for (let j = 0; j < 3; j++) L.add(x + ((j + k) % 2), top - 2 - k - j * 2, 0.5 - j * 0.12);
    }
  }
  if (v.mood === "dead" && !reduced) {
    // Two pale petals travel quietly past the stone, carried by the wind.
    for (let i = 0; i < 2; i++) {
      const q = mod(t / 12 + i * 5.5, 12) / 12;
      const x = Math.round(cx - 14 + q * (22 + Math.min(v.windKmh, 40) / 3));
      const y = Math.round(ANCHOR - 6 + q * 8 + Math.sin(q * 8 + i) * 1.4);
      L.add(x, y, 0.7);
      L.add(x + 1, y, 0.35);
    }
  }
  // Birds at dawn and dusk under a clear sky.
  if (!reduced && e.sunH > 0 && e.sunH < 0.35 && e.cond.cloud < 0.6 && !e.cond.rain) {
    const cycle = 380;
    const k = t % cycle;
    if (k < 150) {
      const row = 6 + Math.floor(hash(Math.floor(t / cycle) + 3) * 10);
      const bx = -12 + k;
      const up = Math.floor(k / 4) % 2 === 0;
      stamp(L, bx, row, up ? BITMAPS.birdUp : BITMAPS.bird, 0.95);
      stamp(L, bx - 9, row + 2, up ? BITMAPS.bird : BITMAPS.birdUp, 0.85);
      stamp(L, bx - 16, row - 1, up ? BITMAPS.birdUp : BITMAPS.bird, 0.75);
    }
  }
  // Fireflies in grass country at night.
  if (!e.sand && e.night && !e.cond.rain) {
    for (let i = 0; i < 12; i++) {
      const on = reduced ? i % 2 === 0 : (Math.floor(t / 5) + i * 7) % 9 < 2;
      if (!on) continue;
      const fx = Math.floor(hash(i * 13 + 1) * COLS + (reduced ? 0 : Math.sin(t / 30 + i) * 4));
      const fy = HORIZON + 1 + Math.floor(hash(i * 7 + 2) * 20);
      disc(L, mod(fx, COLS) * ASPECT, fy, 0.9, 1, 0.5);
    }
  }
}

// ---------- compose ----------

export interface Frame {
  layers: Record<LayerName, string>;
  env: Env;
}

export interface SceneOptions {
  /** Smooth animation clock. The legacy t argument remains in 12 Hz ticks. */
  sec?: number;
  rise?: number;
  fromFace?: Face;
  transition?: number;
  moment?: { kind: MomentKind; value: number; progress: number };
}

export interface RasterFrame {
  layers: Record<LayerName, Layer>;
  mask: Uint8Array;
  pet: PetInfo;
  env: Env;
}

/** Independent caches per world. No live canvas shares mutable global layers. */
export class Scene {
  readonly layers = Object.fromEntries(LAYERS.map((n) => [n, new Layer()])) as Record<LayerName, Layer>;
  readonly mask = new Uint8Array(COLS * ROWS);
  private ground = new Layer();
  giftAreas: GiftArea[] = [];

  setKeepsakes(items: readonly WorldKeepsake[]): void {
    this.giftAreas = drawKeepsakes(this.layers.gifts, items);
  }
  private environment: Env | null = null;
  private environmentKey = "";
  private cloudsKey = "";
  /** Useful for deterministic cache and performance checks. */
  readonly builds = { static: 0, clouds: 0 };

  compose(v: View, t: number, cloudPhase: number, hour: number, now: Date, reduced: boolean, options: SceneOptions = {}): RasterFrame {
    // Astronomy and the continuous palette advance every 15 seconds. Breathing,
    // weather and wind continue independently at the display cadence.
    const sampledHour = Math.floor(hour * 240) / 240;
    const key = [sampledHour, now.toISOString().slice(0, 10), v.country, v.weatherCode,
      v.rain, v.apparentC, v.mood, v.moonOverride, v.gravestones.length].join("|");
    const L = this.layers;
    if (key !== this.environmentKey || !this.environment) {
      this.environmentKey = key;
      this.environment = envFor(v, sampledHour, now);
      L.sky.clear();
      L.sun.clear();
      L.distance.clear();
      L.nature.clear();
      L.foreground.clear();
      this.ground.clear();
      skyLayer(L.sky, this.environment, 0);
      sunLayer(L.sun, this.environment);
      groundLayer(this.ground, v, this.environment, 0);
      distantRange(L.distance, this.environment, x => ridgeTop(x, this.environment!.sand));
      grove(L.nature, this.environment);
      foreground(L.foreground, this.environment);
      this.builds.static++;
    }
    const e = this.environment;
    const clock = reduced ? 0 : t;
    const sec = reduced ? 0 : options.sec ?? clock / 12;
    const phase = reduced ? 0 : Math.floor(cloudPhase * 2) / 2;
    // Cloud evolution is subtle at this scale: its slow field samples at 8Hz,
    // with coarse wind buckets. The creature and rain still render at 60Hz.
    const cloudTick = Math.floor(clock * 2 / 3) * 1.5;
    const cloudKey = `${key}|${cloudTick}|${phase}`;
    if (cloudKey !== this.cloudsKey) {
      this.cloudsKey = cloudKey;
      L.cloudsFar.clear();
      L.cloudsNear.clear();
      cloudsLayer(L.cloudsFar, e, cloudTick, phase, false);
      cloudsLayer(L.cloudsNear, e, cloudTick, phase, true);
      this.builds.clouds++;
    }
    for (const name of ["stars", "weather", "pet", "cap", "skin", "white", "fx"] as const) L[name].clear();
    this.mask.fill(0);
    const face = presentationFace(v);
    const pet = drawPet({ ink: L.pet, cap: L.cap, skin: L.skin, white: L.white, mask: this.mask }, {
      stage: v.stage, tier: v.tier, face, light: e.light, t: clock, sec, reduced, night: e.night,
      fromFace: options.fromFace, transition: options.transition,
      ground: ANCHOR, centre: COLS / 2, ageDays: v.ageDays, rise: reduced ? undefined : options.rise
    });
    L.ground.copy(this.ground);
    windLayer(L.ground, v, e, sec);
    shadowLayer(L.ground, e, pet);
    starsLayer(L.stars, e, Math.floor(clock));
    weatherLayer(L.weather, v, e, reduced ? 0 : sec * 12);
    fxLayer(L.fx, v, e, Math.floor(clock), pet, reduced);
    if (options.moment) {
      const m = options.moment;
      celebration(L.fx, L.weather, m.kind, m.value, m.progress, {
        cx: COLS / 2, y0: pet.y0, y1: pet.y1, ground: ANCHOR
      });
    }
    return { layers: L, mask: this.mask, pet, env: e };
  }
}

/** All output surfaces share exactly the same layer order, dither and masking. */
export function paintsFor(frame: RasterFrame): Paint[] {
  const p = frame.env.pal;
  const paperSky = (luma(p.skyTop) + luma(p.skyHorizon)) * 0.5;
  const paperGround = (luma(p.groundTop) + luma(p.groundBottom)) * 0.5;
  return LAYERS.map((name, ink) => ({
    layer: frame.layers[name], ink, ramp: name === "sky" ? SOFT : RAMP,
    inkLight: name === "pet" ? false : name === "ground" ? luma(p.ground) > paperGround
      : name === "cloudsFar" ? luma(p.cloudFar) > paperSky
      : name === "cloudsNear" ? luma(p.cloudNear) > paperSky : true,
    mask: ["sky", "stars", "sun", "cloudsFar", "cloudsNear", "distance", "ground", "nature", "weather"].includes(name) ? frame.mask : undefined
  }));
}

export function inksFor(e: Env, mood: Mood): Ink[] {
  const p = e.pal;
  const dark = luma(p.pet) > 0.5 ? mix(p.skyTop, "#141b1c", 0.55) : p.pet;
  const colours: Record<LayerName, string> = { sky: p.glow, stars: p.stars, sun: p.sun,
    cloudsFar: p.cloudFar, cloudsNear: p.cloudNear, distance: p.distance,
    ground: p.ground, nature: p.nature, weather: p.weather, pet: dark,
    cap: p.cap, skin: p.skin, white: p.white, foreground: p.foreground, gifts: e.night ? "#e0c99b" : "#775134", fx: p.fx };
  return LAYERS.map(name => {
    let colour = colours[name];
    const isPet = ["pet", "cap", "skin", "white"].includes(name);
    // Match the former CSS grayscale filter while keeping the palette itself.
    if (isPet && mood === "wilting") {
      const value = Math.round(luma(colour) * 255).toString(16).padStart(2, "0");
      colour = mix(colour, `#${value}${value}${value}`, 0.7);
    }
    return { colour, weight: isPet || name === "gifts" ? 600 : 400, alpha: isPet && mood === "wilting" ? 0.85 : isPet && mood === "tired" ? 0.92
      : name === "sky" || name === "weather" ? 0.8 : name === "cloudsFar" ? 0.85 : 1 };
  });
}

const TEXT_SCENE = new Scene();

/** Immutable text snapshot for tests, tooling and ASCII exports. Not the live paint path. */
export function composeAll(v: View, t: number, cloudPhase: number, hour: number, now: Date, reduced: boolean, options: SceneOptions = {}): Frame {
  const raster = TEXT_SCENE.compose(v, t, cloudPhase, hour, now, reduced, options);
  const paints = paintsFor(raster);
  const layers = Object.fromEntries(LAYERS.map((name, i) => {
    const p = paints[i];
    return [name, p.layer.text(p.inkLight, p.ramp, p.mask)];
  })) as Record<LayerName, string>;
  return { layers, env: raster.env };
}

export class World {
  view: View = { ...EMPTY_VIEW };
  private reduced = false;
  private seconds = 0;
  private cloudPhase = 0;
  private scene = new Scene();
  private surface: Surface;
  private next: number | null = null;
  private prev: number | null = null;
  private animation: number | null = null;
  private paletteKey = "";
  private dirty = true;
  private lastMinute = "";
  private expression: { from: Face; at: number } | null = null;
  private rebornAt: number | null = null;
  private moment: { kind: MomentKind; value: number; start: number } | null = null;
  private momentTimer: ReturnType<typeof setTimeout> | null = null;
  frames = 0;
  /** CPU compose and canvas submission time. GPU work is not included. */
  timing: ((composeMs: number, paintMs: number) => void) | null = null;

  constructor(private root: HTMLElement) {
    root.textContent = "";
    this.surface = new Surface(root);
    document.addEventListener("visibilitychange", this.visibilityChanged);
  }

  private visibilityChanged = (): void => {
    this.next = null;
    this.prev = null;
    this.dirty = true;
  };

  set(v: Partial<View>): void {
    if (this.view.mood === "dead" && v.mood && v.mood !== "dead") this.rebornAt = this.seconds;
    const before = presentationFace(this.view);
    const next = { ...this.view, ...v };
    const after = presentationFace(next);
    if (before !== after && ![before, after].some(m => m === "dead" || m === "burrowed")) this.expression = { from: before, at: this.seconds };
    this.view = next;
    this.dirty = true;
  }

  /** Update the latest placed objects without rebuilding terrain or the atlas. */
  setKeepsakes(items: readonly WorldKeepsake[]): void {
    this.scene.setKeepsakes(items);
    this.dirty = true;
  }

  hitGift(clientX: number, clientY: number): string | null {
    return hitKeepsake(this.scene.giftAreas, this.surface.canvas.getBoundingClientRect(), clientX, clientY);
  }

  setReduced(on: boolean): void {
    if (this.reduced === on) return;
    this.reduced = on;
    this.prev = null;
    this.dirty = true;
    // A preference change must not leave a growing or endless celebration.
    if (this.moment) this.celebrate(this.moment.kind, this.moment.value);
  }

  hour(): number {
    return this.view.hourOverride ?? localHour(this.view.tz);
  }

  /** A share card reads the rendered canvas without re-composing the world. */
  frame(): HTMLCanvasElement {
    return this.surface.canvas;
  }

  celebrate(kind: MomentKind, value: number): void {
    if (!MOMENT_KINDS.includes(kind)) return;
    if (this.momentTimer !== null) clearTimeout(this.momentTimer);
    this.moment = { kind, value, start: this.seconds };
    this.dirty = true;
    // Reduced motion shows one fixed effect for exactly two seconds. The timer
    // expires independently of the frozen animation clock, even in a hidden tab.
    this.momentTimer = setTimeout(() => {
      this.moment = null;
      this.momentTimer = null;
      this.dirty = true;
      if (!document.hidden) this.draw();
    }, (this.reduced ? 2 : DURATION[kind]) * 1000);
    this.draw();
  }

  private applyPalette(e: Env): void {
    const p = e.pal;
    const key = Object.values(p).join("|") + this.view.mood;
    if (key === this.paletteKey) return;
    this.paletteKey = key;
    const haze = (((HORIZON - 15) / ROWS) * 100).toFixed(3) + "%";
    const ground = (((HORIZON + 2) / ROWS) * 100).toFixed(3) + "%";
    this.root.style.background = `linear-gradient(to bottom, ${p.skyTop} 0%, ${p.skyHorizon} ${haze}, ${p.groundTop} ${ground}, ${p.groundBottom} 100%)`;
    this.root.style.filter = this.view.mood === "dead" ? "saturate(0.55)" : "none";
  }

  /** Render one frame now (used at boot, on resize, and for state changes). */
  draw(): void {
    const t0 = this.timing ? performance.now() : 0;
    const m = this.moment;
    const progress = m ? this.reduced ? 0.45 : clamp((this.seconds - m.start) / DURATION[m.kind], 0, 1) : 0;
    const rise = this.rebornAt === null ? undefined : clamp(this.seconds - this.rebornAt, 0, 1);
    if (rise === 1) this.rebornAt = null;
    const transition = this.expression ? clamp((this.seconds - this.expression.at) / 0.65, 0, 1) : 1;
    if (transition === 1 || this.reduced) this.expression = null;
    const frame = this.scene.compose(this.view, Math.floor(this.seconds * 12), this.cloudPhase, this.hour(), new Date(), this.reduced, {
      sec: this.seconds, rise, fromFace: this.expression?.from, transition,
      moment: m && progress < 1 ? { kind: m.kind, value: m.value, progress } : undefined
    });
    const paints = paintsFor(frame);
    const t1 = this.timing ? performance.now() : 0;
    this.applyPalette(frame.env);
    this.surface.fit();
    this.surface.inks(inksFor(frame.env, this.view.mood));
    this.surface.paint(paints);
    this.frames++;
    this.dirty = false;
    if (this.timing) this.timing(t1 - t0, performance.now() - t1);
  }

  start(): void {
    if (this.animation !== null) return;
    document.addEventListener("visibilitychange", this.visibilityChanged);
    const loop = (now: number) => {
      this.animation = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (this.next === null) this.next = now;
      if (now + 0.5 < this.next) return;
      this.next += PERIOD;
      if (this.next < now) this.next += Math.ceil((now - this.next) / PERIOD) * PERIOD;
      const elapsed = this.prev === null ? 0 : Math.min(now - this.prev, 250) / 1000;
      this.prev = now;
      if (!this.reduced) {
        this.seconds += elapsed;
        this.cloudPhase = mod(this.cloudPhase + elapsed * (Math.max(0, this.view.windKmh) / 20 + 0.15), 100000);
      }
      const minute = Math.floor(Date.now() / 15000).toString();
      if (!this.reduced || this.dirty || minute !== this.lastMinute) this.draw();
      this.lastMinute = minute;
    };
    this.draw();
    this.animation = requestAnimationFrame(loop);
  }

  /** Release animation callbacks if a host replaces its world. */
  stop(): void {
    if (this.animation !== null) cancelAnimationFrame(this.animation);
    if (this.momentTimer !== null) clearTimeout(this.momentTimer);
    this.animation = null;
    this.momentTimer = null;
    this.moment = null;
    this.next = this.prev = null;
    document.removeEventListener("visibilitychange", this.visibilityChanged);
  }
}
