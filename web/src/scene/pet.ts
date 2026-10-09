// The Truffle, modelled as a few lit ellipsoids and rendered per cell: a wide
// cap, a plump body, feet, eyes with a glint, a mouth. Every mood changes the
// geometry (lids, droop, lean, squash), not a hand-drawn picture, so the
// creature keeps its shading from any light direction at any hour.

import type { Stage, Tier } from "../../../worker/src/config";
import type { Mood } from "../../../worker/src/engine";
import { ASPECT, clamp, disc, hash, hitEllipsoids, Layer, noise, shade, W, H, type Ellipsoid, type Hit, type Vec3 } from "./raster";

export type Face = Mood | "yawn" | "anticipating";

export const enum M {
  CAP = 1,
  BODY,
  FOOT,
  EYE,
  PUPIL,
  GLINT,
  MOUTH,
  SPOT,
  LEAF,
  LID,
  STONE,
  MOUND,
  PETAL,
  STEM
}

export interface PetLayers {
  /** Dark ink: shadows, outline, pupils, mouth. */
  ink: Layer;
  /** Cap highlight ink (rust). */
  cap: Layer;
  /** Skin ink (warm tan): body, feet, stone, mound. */
  skin: Layer;
  /** White ink: eye whites, glints, spots, petals. */
  white: Layer;
  /** Cells the creature covers; the ground is blanked under them. */
  mask: Uint8Array;
}

export interface PetInfo {
  /** Bounding box in cells. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  eyeRow: number;
  /** Cast shadow on the ground, in row units (cx) and rows (cy). */
  shadow: { cx: number; cy: number; rx: number; ry: number } | null;
}

export interface PetOpts {
  stage: Stage;
  tier?: Tier;
  face: Face;
  /** Previous expression eases into the new one; simulation state stays exact. */
  fromFace?: Face;
  transition?: number;
  night?: boolean;
  light: Vec3;
  /** Frame clock in 12 Hz ticks; frozen under reduced motion. */
  t: number;
  /** The same clock in seconds, for smooth motion (breathing, blinks, poses). */
  sec?: number;
  /** Rebirth: 0 the new spore is still under the sand, 1 it has pushed up. */
  rise?: number;
  reduced: boolean;
  /** Ground contact row. */
  ground: number;
  /** Centre column. */
  centre: number;
  /** Mound peeks and gravestone flowers. */
  ageDays: number;
}

interface Model {
  shapes: Ellipsoid[];
  /** Extra flat marks drawn after shading, in row units. */
  marks: { X: number; Y: number; r: number; lum: number; layer: "ink" | "skin" | "cap" }[];
  dim: number;
  capRx: number;
  eyeY: number;
  features?: { cx: number; ey: number; dx: number; er: number; brx: number; closure: number; happy: number; anticipating: number; asleep: number; tired: number; wilting: number; yawn: number; gaze: number };
}

const SIZES: Record<Stage, { body: [number, number]; cap: [number, number]; eye: number; feet: number }> = {
  Spore: { body: [4.4, 5.3], cap: [8.0, 3.8], eye: 1.1, feet: 1.6 },
  Sprout: { body: [4.9, 5.8], cap: [9.0, 4.3], eye: 1.2, feet: 1.8 },
  Truffle: { body: [5.6, 6.6], cap: [10.2, 5.1], eye: 1.35, feet: 2.0 },
  Elder: { body: [6.3, 7.0], cap: [12.4, 5.8], eye: 1.4, feet: 2.2 }
};

/** Blinks every few seconds, sometimes twice in a row. Pure in the clock. */
export function blinking(sec: number): boolean {
  const period = 3.3;
  const k = Math.floor(sec / period);
  const d = sec - k * period - (0.4 + hash(k * 13 + 5) * 2.2);
  if (d >= 0 && d < 0.13) return true;
  return hash(k * 7 + 1) > 0.62 && d >= 0.28 && d < 0.41;
}

/** Lids close and reopen over 220ms, instead of changing in one frame. */
export function blinkAmount(sec: number): number {
  const period = 3.3;
  const k = Math.floor(sec / period);
  const d = sec - k * period - (0.4 + hash(k * 13 + 5) * 2.2);
  const pulse = (x: number) => x <= 0 || x >= 0.22 ? 0 : Math.sin(Math.PI * x / 0.22) ** 2;
  return Math.max(pulse(d), hash(k * 7 + 1) > 0.62 ? pulse(d - 0.3) : 0);
}

/** Breathing in [-1, 1]: slow, slower and deeper when asleep. */
export function breathOf(sec: number, face: Face): number {
  return Math.sin((sec * Math.PI * 2) / (face === "asleep" || face === "burrowed" ? 5.2 : 3.6));
}

function build(o: PetOpts): Model {
  const S = SIZES[o.stage];
  const t = o.reduced ? 0 : o.t;
  const sec = o.reduced ? 0 : o.sec ?? t / 12;
  const face = o.face;
  const transition = o.reduced ? 1 : clamp(o.transition ?? 1, 0, 1);
  const eased = transition * transition * (3 - 2 * transition);
  const weight = (m: Face) => (face === m ? eased : 0) + ((o.fromFace ?? face) === m ? 1 - eased : 0);
  const asleep = weight("asleep"), tired = weight("tired"), wilting = weight("wilting"), happy = weight("affectionate"), yawn = weight("yawn");
  const anticipating = weight("anticipating");
  const tier = ({ asleep: 0, low: 1, medium: 2, high: 3 } as const)[o.tier ?? "asleep"];
  const growth = 1 + tier * 0.025;
  const amp = 0.022 - asleep * 0.012 - wilting * 0.006;
  const breath = o.reduced ? 0 : breathOf(sec, face) * amp;
  // Anticipation is a quiet, attentive lift, with both feet still on the ground.
  // Only affection uses a small hop; sleep and anticipation never bounce.
  const sway = o.reduced ? 0 : Math.sin(sec * 0.9) * 0.2 * weight("content") + Math.sin(sec * 1.6) * 0.3 * happy;
  const hop = o.reduced ? 0 : Math.pow(Math.max(0, Math.sin(sec * Math.PI * 1.25)), 2) * 0.5 * happy;
  const cx = o.centre * ASPECT + sway;
  const g = o.ground + 0.6 - hop + sinkOf(o);
  const shapes: Ellipsoid[] = [];
  const marks: Model["marks"] = [];
  let dim = 1;

  // Body.
  let [brx, bry] = S.body;
  brx *= growth * (1 + asleep * 0.06 + tired * 0.04 + wilting * 0.06);
  bry *= growth * (1 - asleep * 0.055 - tired * 0.07 - wilting * 0.12 + yawn * 0.05 + anticipating * 0.025);
  bry *= 1 + breath;
  brx *= 1 - breath * 0.6;
  const bcy = g - bry;
  shapes.push({ cx, cy: bcy, rx: brx, ry: bry, rz: 0.95, m: M.BODY });
  if (o.stage === "Elder") {
    // A heavier, lower belly.
    shapes.push({ cx, cy: g - bry * 0.55, rx: brx * 1.08, ry: bry * 0.6, rz: 0.9, m: M.BODY });
  }

  // Feet.
  if (S.feet) {
    const fy = g - 0.45;
    shapes.push({ cx: cx - brx * 0.62, cy: fy, rx: S.feet * growth, ry: S.feet * growth * 0.5, rz: 0.9, z: 0.6, m: M.FOOT });
    shapes.push({ cx: cx + brx * 0.62, cy: fy, rx: S.feet * growth, ry: S.feet * growth * 0.5, rz: 0.9, z: 0.6, m: M.FOOT });
    // Little hands give the larger creature an affectionate, toy-like posture.
    if (o.stage !== "Sprout") {
      for (const side of [-1, 1]) shapes.push({
        cx: cx + side * brx * 0.94, cy: g - bry * (0.72 + happy * 0.38 + anticipating * 0.16),
        rx: 0.95, ry: 1.2 + happy * 0.4, rz: 0.55, z: 0.7, m: M.BODY
      });
    }
  }

  // Cap.
  let capRx = S.cap[0] * growth;
  if (capRx) {
    let capRy = S.cap[1] * growth;
    let capCx = cx;
    let capCy = g - bry * 2 - capRy * 0.35 + 0.8;
    capCx += anticipating * 0.25 - 2.2 * wilting - 0.35 * asleep;
    capRy *= 1 - 0.26 * wilting;
    capCy += 1.3 * wilting + 0.45 * (tired + asleep);
    dim = 1 - 0.15 * wilting;
    capCy -= breath * bry * 2;
    shapes.push({ cx: capCx, cy: capCy, rx: capRx, ry: capRy, rz: 0.75, z: 1.2, m: M.CAP });
    if (o.stage === "Elder" || face === "wilting") {
      // Drooping brim lobes.
      const droop = face === "wilting" ? 1.6 : 0.9;
      shapes.push({ cx: capCx - capRx * 0.62, cy: capCy + capRy * 0.35 + droop * 0.5, rx: capRx * 0.42, ry: capRy * 0.62, rz: 0.7, z: 1.1, m: M.CAP });
      shapes.push({ cx: capCx + capRx * 0.62, cy: capCy + capRy * 0.35 + droop * 0.5, rx: capRx * 0.42, ry: capRy * 0.62, rz: 0.7, z: 1.1, m: M.CAP });
    }
    // Spots on the cap, lit like the cap but drawn in the skin ink.
    // Intelligence adds quiet freckles; even the newest sleepy pet is a mushroom.
    const spots = [[-0.36, -0.2, 0.16], [0.36, 0.1, 0.16], [0.02, -0.5, 0.13], [-0.7, 0.1, 0.12], [0.65, -0.18, 0.12], [-0.12, 0.34, 0.1], [0.4, -0.5, 0.1], [-0.5, -0.5, 0.1]].slice(0, 2 + tier * 2);
    for (const [sx, sy, sr] of spots) {
      shapes.push({ cx: capCx + sx * capRx, cy: capCy + sy * capRy, rx: sr * capRx, ry: sr * capRx * 0.75, rz: 0.1, z: capRy * 0.75 + 1.3, m: M.SPOT });
    }
    if (o.stage === "Sprout") {
      // One small leaf on the cap.
      shapes.push({ cx: capCx + capRx * 0.55, cy: capCy - capRy - 0.6, rx: 1.6, ry: 0.7, rz: 0.4, z: 2, m: M.LEAF });
    }
  }

  // Face.
  const ey = bcy - bry * 0.18 - anticipating * S.eye * 0.18;
  const eyeDx = brx * 0.42;
  const er = S.eye;
  // Face features sit in front of the belly at every stage. A fixed z=3
  // disappeared behind the Truffle/Elder's 5–6 row-unit body depth.
  const faceZ = Math.min(brx, bry) * 0.95 + 1;
  // Smooth lids and gaze are geometry, sampled on the same elapsed clock as breath.
  const blink = o.reduced ? 0 : blinkAmount(sec) * (1 - asleep - yawn) * (1 - happy);
  const closure = clamp(asleep + yawn + blink, 0, 1);
  const gaze = o.reduced ? 0 : Math.sin(sec * 0.31) * Math.sin(sec * 0.13) * er * 0.38 * (1 - closure);
  const eyes = [cx - eyeDx, cx + eyeDx];
  for (const ex of eyes) {
    if (closure > 0.94) {
      shapes.push({ cx: ex, cy: ey + er * 0.2, rx: er * 1.05, ry: 0.35, z: faceZ, m: M.PUPIL, flat: 0.05 });
      continue;
    }
    if (happy > 0.85) {
      shapes.push({ cx: ex, cy: ey + er * 0.35, rx: er * 1.05, ry: er * 0.75, z: faceZ, m: M.PUPIL, flat: 0.05 });
      shapes.push({ cx: ex, cy: ey + er * 0.85, rx: er * 0.85, ry: er * 0.55, z: faceZ + 1, m: M.BODY });
      marks.push({ X: ex - (ex < cx ? er * 1.9 : -er * 1.9), Y: ey + er * 1.3, r: er * 0.55, lum: 0.9, layer: "cap" });
      continue;
    }
    const small = 1 - wilting * 0.2;
    shapes.push({ cx: ex, cy: ey, rx: er * small, ry: er * 1.15 * small * (1 - closure * 0.92 - happy * 0.4), z: faceZ, m: M.EYE, flat: 0.96 });
    const look = wilting * 0.25 + tired * 0.1 - anticipating * 0.22;
    const px = ex + gaze + (o.light[0] > 0 ? 0.12 : -0.12) * er;
    shapes.push({ cx: px, cy: ey + look * er + er * 0.1, rx: er * 0.52 * small, ry: er * 0.7 * small * (1 - closure * 0.92 - happy * 0.4), z: faceZ + 1.4, m: M.PUPIL, flat: 0 });
    shapes.push({ cx: px - er * 0.22, cy: ey - er * 0.18, rx: er * 0.2, ry: er * 0.22, z: faceZ + 2.5, m: M.GLINT, flat: 1 });
    if (tired > 0.05) shapes.push({ cx: ex, cy: ey - er * 0.95, rx: er * 1.15, ry: er * 0.85 * tired, z: faceZ + 3, m: M.LID });
    else if (o.stage === "Elder") shapes.push({ cx: ex, cy: ey - er * 1.4, rx: er * 1.15, ry: er * 0.6, z: faceZ + 3, m: M.LID });
  }

  // A continuous mouth curve flattens into rest, droops when wilted and opens
  // into a yawn. The interpolation happens in geometry, not cross-faded images.
  const my = ey + er * 1.9;
  const r = er * (1 + happy * 0.3 - asleep * 0.55);
  const curve = 1 - wilting * 2;
  shapes.push({ cx, cy: my, rx: r, ry: Math.max(0.28, r * (0.68 - tired * 0.4 + yawn * 0.55)), z: faceZ, m: M.MOUTH, flat: 0.04 });
  if (yawn < 0.95) shapes.push({ cx, cy: my - curve * 0.6, rx: r * 1.1, ry: r * 0.6 * (1 - yawn), z: faceZ + 1.2, m: M.BODY, flat: 0.85 });

  return { shapes, marks, dim, capRx: capRx || brx, eyeY: ey, features: { cx, ey, dx: eyeDx, er, brx, closure, happy, anticipating, asleep, tired, wilting, yawn, gaze } };
}

function mound(o: PetOpts): Model {
  const t = o.reduced ? 0 : o.t;
  const cx = o.centre * ASPECT;
  const g = o.ground + 0.6;
  const shapes: Ellipsoid[] = [{ cx, cy: g, rx: 11, ry: 3.4, rz: 0.55, m: M.MOUND }, { cx: cx - 5, cy: g + 0.4, rx: 7, ry: 2.2, rz: 0.5, m: M.MOUND }];
  // A small dark hole near the top where the Truffle went down, with a lip of loose sand.
  shapes.push({ cx: cx + 1.5, cy: g - 2.75, rx: 2.3, ry: 0.75, z: 2.4, m: M.MOUTH, flat: 0.04 });
  shapes.push({ cx: cx + 1.5, cy: g - 2.15, rx: 3.2, ry: 0.55, z: 2.2, m: M.MOUND });
  const peek = !o.reduced && t % 150 < 16;
  if (peek) {
    for (const ex of [cx + 0.6, cx + 2.4]) {
      shapes.push({ cx: ex, cy: g - 2.95, rx: 0.7, ry: 0.6, z: 3, m: M.EYE, flat: 0.96 });
      shapes.push({ cx: ex, cy: g - 2.9, rx: 0.3, ry: 0.35, z: 3.5, m: M.PUPIL, flat: 0 });
    }
  }
  return { shapes, marks: [], dim: 1, capRx: 11, eyeY: g - 2.6 };
}

function stone(o: PetOpts): Model {
  const cx = o.centre * ASPECT;
  const g = o.ground + 0.6;
  const shapes: Ellipsoid[] = [
    // A slab: a tall flat ellipsoid for the body, a rounder one for the top, a plinth at the foot.
    { cx, cy: g - 5.0, rx: 4.0, ry: 6.2, rz: 0.22, m: M.STONE },
    { cx, cy: g - 9.0, rx: 4.0, ry: 2.6, rz: 0.4, z: 0.3, m: M.STONE },
    { cx, cy: g - 0.4, rx: 5.6, ry: 1.3, rz: 0.35, z: 0.5, m: M.STONE }
  ];
  const marks: Model["marks"] = [];
  if (o.ageDays > 0) {
    // A small flower leaning on the stone.
    shapes.push({ cx: cx + 5.9, cy: g - 1.9, rx: 0.28, ry: 2.0, rz: 0.5, z: 1, m: M.STEM });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      shapes.push({ cx: cx + 5.9 + Math.cos(a) * 0.8, cy: g - 4.1 + Math.sin(a) * 0.8, rx: 0.5, ry: 0.5, z: 1.5, m: M.PETAL, flat: 0.95 });
    }
    shapes.push({ cx: cx + 5.9, cy: g - 4.1, rx: 0.42, ry: 0.42, z: 2, m: M.PUPIL, flat: 0.1 });
  }
  // A carved mark on the face of the stone: a small ring and a line under it.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    marks.push({ X: cx + Math.cos(a) * 1.3, Y: g - 8.2 + Math.sin(a) * 1.3, r: 0.32, lum: 0.12, layer: "ink" });
  }
  for (let k = -2; k <= 2; k++) marks.push({ X: cx + k * 0.6, Y: g - 5.4, r: 0.3, lum: 0.12, layer: "ink" });
  return { shapes, marks, dim: 1, capRx: 4.5, eyeY: g - 6 };
}

const MAT = new Uint8Array(W * H);

/** Rows the creature sits below the ground while a new spore pushes up. */
function sinkOf(o: PetOpts): number {
  if (o.rise === undefined || o.rise >= 1) return 0;
  const k = 1 - Math.max(0, o.rise);
  return k * k * (SIZES[o.stage].body[1] * 2 + SIZES[o.stage].cap[1] * 1.35 + 2) * 1.08;
}

/** Draw the creature into the layers and report where it is. */
export function drawPet(L: PetLayers, o: PetOpts): PetInfo {
  const model = o.face === "dead" ? stone(o) : o.face === "burrowed" ? mound(o) : build(o);
  const { shapes, marks, dim } = model;
  let x0 = W;
  let x1 = -1;
  let y0 = H;
  let y1 = -1;
  for (const e of shapes) {
    x0 = Math.min(x0, Math.floor((e.cx - e.rx) / ASPECT) - 1);
    x1 = Math.max(x1, Math.ceil((e.cx + e.rx) / ASPECT) + 1);
    y0 = Math.min(y0, Math.floor(e.cy - e.ry) - 1);
    y1 = Math.max(y1, Math.ceil(e.cy + e.ry) + 1);
  }
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(W - 1, x1);
  y1 = Math.min(H - 1, y1);
  // A spore being reborn is cut off at the ground line while it pushes up.
  if (o.rise !== undefined && o.rise < 1) y1 = Math.min(y1, o.ground);
  const hit: Hit = { z: 0, n: [0, 0, 1], m: 0, flat: -1, d: 0 };
  const mat = MAT;
  const dark = o.face === "dead" ? 0.9 : 1;
  for (let y = y0; y <= y1; y++) {
    const Y = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const X = (x + 0.5) * ASPECT;
      if (!hitEllipsoids(shapes, X, Y, hit)) continue;
      const i = y * W + x;
      L.mask[i] = 1;
      mat[i] = hit.m;
      let lum: number;
      if (hit.flat >= 0) lum = hit.flat;
      else {
        const wart = hit.m === M.CAP ? 0.025 * noise(X * 1.3, Y * 1.3, 5) : hit.m === M.STONE ? 0.08 * noise(X * 2.2, Y * 2.2, 9) : hit.m === M.MOUND ? 0.05 * noise(X * 2, Y * 2, 4) : 0;
        lum = shade(hit.n, o.light, o.night ? 0.48 : hit.m === M.CAP ? 0.18 : 0.26, hit.m === M.EYE || hit.m === M.STONE || hit.m === M.MOUND ? 0 : 0.28) + wart;
        if (hit.m === M.SPOT) lum = clamp(lum + 0.28, 0, 1);
        if (hit.m === M.LEAF) lum = clamp(lum * 0.9, 0, 1);
        lum *= dim * dark;
      }
      lum = clamp(lum, 0, 1);
      if (hit.m === M.PUPIL || hit.m === M.MOUTH) {
        L.ink.set(x, y, lum);
        L.cap.set(x, y, -1);
        L.skin.set(x, y, -1);
        L.white.set(x, y, -1);
        continue;
      }
      // Dark ink carries only the shadow half; the colour inks carry the tone, dense where lit.
      L.ink.set(x, y, clamp(lum / 0.5, 0, 1));
      const tone = clamp((lum - 0.12) / 0.88, 0, 1);
      switch (hit.m) {
        case M.CAP:
          L.cap.set(x, y, tone);
          break;
        case M.BODY:
        case M.FOOT:
        case M.LID:
        case M.STONE:
        case M.MOUND:
        case M.STEM:
          L.skin.set(x, y, tone);
          break;
        case M.LEAF:
          L.skin.set(x, y, tone * 0.7);
          break;
        case M.SPOT:
        case M.EYE:
        case M.GLINT:
        case M.PETAL:
          L.white.set(x, y, hit.flat >= 0 ? lum : tone);
          break;
        default:
          break;
      }
    }
  }
  // Flat marks: mouth, carvings, blush.
  for (const m of marks) {
    const Lr = m.layer === "ink" ? L.ink : m.layer === "cap" ? L.cap : L.white;
    const xs = Math.floor((m.X - m.r) / ASPECT);
    const xe = Math.ceil((m.X + m.r) / ASPECT);
    for (let y = Math.floor(m.Y - m.r); y <= Math.ceil(m.Y + m.r); y++) {
      for (let x = xs; x <= xe; x++) {
        if (Math.hypot((x + 0.5) * ASPECT - m.X, y + 0.5 - m.Y) > m.r) continue;
        if (y < 0 || y >= H || x < 0 || x >= W || !L.mask[y * W + x]) continue;
        Lr.set(x, y, m.lum);
        if (m.layer === "ink" && m.lum < 0.3) {
          L.skin.set(x, y, -1);
          L.cap.set(x, y, -1);
          L.white.set(x, y, -1);
        }
      }
    }
  }
  // Outline: a dark contour one cell wide where the creature meets the world,
  // and a thin line where the cap meets the body.
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (!L.mask[i]) continue;
      const m = mat[i];
      const edge =
        (x === 0 || !L.mask[i - 1]) || (x === W - 1 || !L.mask[i + 1]) || (y === 0 || !L.mask[i - W]) || (y === H - 1 || !L.mask[i + W]);
      const seam = m !== M.CAP && m !== M.SPOT && y > 0 && L.mask[i - W] && (mat[i - W] === M.CAP || mat[i - W] === M.SPOT);
      if (edge || seam) {
        const l = L.ink.get(x, y);
        L.ink.set(x, y, Math.min(l, edge ? 0.15 : 0.3));
        // A thin ink contour is more legible than a dark band of @ characters.
        // Colour and material still come from the ellipsoid raster underneath.
        if (edge && m !== M.CAP && m !== M.SPOT) L.ink.symbol(x, y, !L.mask[i - 1] ? "(" : !L.mask[i + 1] ? ")" : "_");
        else if (seam) L.ink.symbol(x, y, "_");
        L.cap.set(x, y, -1);
        L.skin.set(x, y, -1);
        // A moonlit contour keeps the full silhouette readable against dark earth.
        // Pupils stay dark; this is a separate material rim, not inverted eyes.
        if (o.night && edge) {
          const rim = m === M.CAP || m === M.SPOT ? L.cap : L.skin;
          rim.symbol(x, y, !L.mask[i - 1] ? "(" : !L.mask[i + 1] ? ")" : "_");
        }
        if (m !== M.EYE && m !== M.GLINT) L.white.set(x, y, -1);
      }
    }
  }
  // The face gets a quiet plane: texture describes the body, never obscures
  // its expression. These marks are real ASCII in the same depth-masked atlas.
  if (model.features) {
    const f = model.features;
    const left = Math.floor((f.cx - f.brx * 0.78) / ASPECT);
    const right = Math.ceil((f.cx + f.brx * 0.78) / ASPECT);
    const top = Math.floor(f.ey - 1.15);
    const bottom = Math.ceil(f.ey + f.er * 2.7);
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const i = y * W + x;
      if (!L.mask[i] || !L.mask[i - 1] || !L.mask[i + 1] || !L.mask[i - W] || !L.mask[i + W] || mat[i] === M.CAP || mat[i] === M.SPOT) continue;
      for (const layer of [L.ink, L.cap, L.skin, L.white]) layer.set(x, y, -1);
    }
    const faceInk = o.night ? L.white : L.ink;
    const mark = (x: number, y: number, text: string) => {
      const start = Math.round(x - (text.length - 1) / 2);
      for (let k = 0; k < text.length; k++) {
        if (text[k] !== " " && L.mask[y * W + start + k]) faceInk.symbol(start + k, y, text[k]);
      }
    };
    const ey = Math.round(f.ey);
    const eye = f.closure > 0.82 ? "___" : f.closure > 0.45 ? "(-)" : f.happy > 0.75 ? "^" : f.anticipating > 0.65 ? "(O)" : "(o)";
    for (const side of [-1, 1]) mark((f.cx + side * f.dx + f.gaze) / ASPECT, ey, eye);
    const mouthY = Math.round(f.ey + f.er * 2.05);
    const mouth = f.yawn > 0.5 ? "O" : f.asleep > 0.8 ? "~" : f.wilting > 0.65 ? "/^\\" : f.tired > 0.65 ? "___" : f.happy > 0.65 ? "\\___/" : "\\_/";
    mark(f.cx / ASPECT, mouthY, mouth);
  }
  // A faint ground contact under the feet so it stands on the sand.
  const shadow = o.face === "dead" || o.face === "burrowed" ? null : { cx: o.centre * ASPECT - o.light[0] * model.capRx * 0.35, cy: o.ground + 1.1, rx: model.capRx * 0.95, ry: 1.7 + model.capRx * 0.08 };
  return { x0, x1, y0, y1, eyeRow: Math.round(model.eyeY - 0.5), shadow };
}

/** Small flat marks for effects (hearts, z's, birds). */
export const BITMAPS = {
  heart: [" ## ## ", "#######", " ##### ", "  ###  ", "   #   "],
  heartSmall: [" # # ", "#####", " ### ", "  #  "],
  z: ["####", "  # ", " #  ", "####"],
  zSmall: ["###", " # ", "###"],
  bird: ["#   #", " # # ", "  #  "],
  birdUp: [" #.#", "# . #"],
  leaf: [" ##", "## ", "#  "]
};

export { disc };
