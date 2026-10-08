// Celebrations for proud moments (decision 0017), drawn into the fx layer
// (and a cool ripple into the weather layer). Each effect is a pure function
// of its progress p in [0, 1], so a reduced-motion viewer gets one still frame.

import { ASPECT, clamp, disc, hash, Layer, line } from "./raster";
import { COLS, ROWS } from "./grid";

/** Exactly the kinds of decision 0017. Kept here so the scene does not import app code. */
export type MomentKind = "stage_up" | "best_day" | "beat_avg7" | "day_10k" | "streak" | "lifetime" | "heat_day_indoor";

export const MOMENT_KINDS: readonly MomentKind[] = ["stage_up", "best_day", "beat_avg7", "day_10k", "streak", "lifetime", "heat_day_indoor"];

/** Seconds each effect runs. All between 2 and 4. */
export const DURATION: Record<MomentKind, number> = {
  stage_up: 3,
  best_day: 2.6,
  beat_avg7: 2.4,
  day_10k: 3.5,
  streak: 3,
  lifetime: 4,
  heat_day_indoor: 2.5
};

export interface Around {
  /** Centre column and the creature's box in cells. */
  cx: number;
  y0: number;
  y1: number;
  ground: number;
}

const TAU = Math.PI * 2;

function burst(L: Layer, a: Around, p: number, rays: number, reach: number, seed: number): void {
  const cy = (a.y0 + a.y1) / 2;
  const r = 3 + p * reach;
  const fade = 1 - p * 0.7;
  for (let i = 0; i < rays; i++) {
    const ang = (i / rays) * TAU + hash(seed + i) * 0.3;
    const rr = r * (0.8 + 0.35 * hash(seed + i * 3));
    const x = a.cx + (Math.cos(ang) * rr) / ASPECT;
    const y = cy + Math.sin(ang) * rr * 0.8;
    // A short streak pointing out from the centre, brighter at the head.
    const tx = a.cx + (Math.cos(ang) * (rr - 2.5)) / ASPECT;
    const ty = cy + Math.sin(ang) * (rr - 2.5) * 0.8;
    line(L, Math.round(tx), Math.round(ty), Math.round(x), Math.round(y), 0.45 * fade);
    L.add(Math.round(x), Math.round(y), fade);
  }
}

function rising(L: Layer, a: Around, p: number, n: number, seed: number): void {
  for (let i = 0; i < n; i++) {
    const delay = hash(seed + i) * 0.35;
    const q = clamp((p - delay) / (1 - delay), 0, 1);
    if (q <= 0 || q >= 1) continue;
    const x0 = a.cx + (hash(seed + i * 7) - 0.5) * 30;
    const x = x0 + Math.sin(q * 9 + i) * 1.5;
    const y = a.y1 - q * (a.y1 - a.y0 + 14);
    const l = q < 0.8 ? 1 : 1 - (q - 0.8) * 4;
    L.add(Math.round(x), Math.round(y), l);
    L.add(Math.round(x), Math.round(y) + 1, l * 0.4);
    if (q > 0.85) {
      // A small pop at the top.
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) L.add(Math.round(x) + dx, Math.round(y) + dy, 0.5);
    }
  }
}

function ring(L: Layer, a: Around, p: number, n: number): void {
  const cy = (a.y0 + a.y1) / 2;
  const rx = ((a.y1 - a.y0) / 2 + 6) / ASPECT;
  const ry = (a.y1 - a.y0) / 2 + 5;
  const shown = Math.ceil(clamp(p / 0.5, 0, 1) * n);
  for (let i = 0; i < shown; i++) {
    const ang = (i / n) * TAU - Math.PI / 2 + p * 0.6;
    const x = Math.round(a.cx + Math.cos(ang) * rx);
    const y = Math.round(cy + Math.sin(ang) * ry);
    const tw = 0.6 + 0.4 * Math.sin(p * 30 + i * 1.7);
    const l = (p > 0.85 ? (1 - p) / 0.15 : 1) * tw;
    L.add(x, y, l);
    if (i % 2 === 0) {
      L.add(x - 1, y, l * 0.4);
      L.add(x + 1, y, l * 0.4);
    }
  }
}

function shower(L: Layer, p: number, seed: number): void {
  for (let i = 0; i < 46; i++) {
    const start = hash(seed + i) * 0.6;
    const q = (p - start) / 0.4;
    if (q <= 0 || q >= 1) continue;
    const x = Math.round(hash(seed + i * 5) * COLS + Math.sin(q * 6 + i) * 1.5);
    const y = Math.round(q * (ROWS - 12));
    L.add(x, y, 0.95);
    L.add(x, y - 1, 0.35);
  }
}

function ripple(L: Layer, a: Around, p: number): void {
  for (let k = 0; k < 3; k++) {
    const q = p * 1.4 - k * 0.2;
    if (q <= 0 || q >= 1) continue;
    const rx = 4 + q * 14;
    const ry = 1 + q * 3.2;
    const l = 0.9 * (1 - q);
    const steps = Math.ceil(rx * 2.4);
    for (let i = 0; i < steps; i++) {
      const ang = (i / steps) * TAU;
      L.add(Math.round(a.cx + (Math.cos(ang) * rx) / ASPECT), Math.round(a.ground + 2 + Math.sin(ang) * ry), l);
    }
  }
}

/** Draw one celebration at progress p. Cool effects go to `cool` (the weather ink), the rest to `fx`. */
export function celebration(fx: Layer, cool: Layer, kind: MomentKind, value: number, p: number, a: Around): void {
  switch (kind) {
    case "stage_up":
      burst(fx, a, p, 18, 20, 11);
      rising(fx, a, p, 4, 50);
      if (p < 0.25) disc(fx, a.cx * ASPECT, (a.y0 + a.y1) / 2, 2 + p * 20, 0.35 * (1 - p * 4), 0.8);
      break;
    case "best_day":
      rising(fx, a, p, 6, 70);
      break;
    case "beat_avg7":
      rising(fx, a, p, 4, 90);
      break;
    case "day_10k":
      burst(fx, a, p, 28, 38, 130);
      burst(fx, a, clamp(p * 1.4 - 0.25, 0, 1), 16, 24, 170);
      break;
    case "streak":
      ring(fx, a, p, clamp(Math.round(value) || 7, 6, 16));
      break;
    case "lifetime":
      shower(fx, p, 210);
      break;
    case "heat_day_indoor":
      ripple(cool, a, p);
      break;
  }
}
