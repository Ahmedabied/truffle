// The Truffle, modelled as a few lit ellipsoids and rendered per cell: a wide
// cap, a plump body, feet, eyes with a glint, a mouth. Every mood changes the
// geometry (lids, droop, lean, squash), not a hand-drawn picture, so the
// creature keeps its shading from any light direction at any hour.

import type { Stage } from "../../../worker/src/config";
import type { Mood } from "../../../worker/src/engine";
import { ASPECT, clamp, disc, hash, hitEllipsoids, Layer, noise, shade, W, H, type Ellipsoid, type Hit, type Vec3 } from "./raster";

export type Face = Mood | "yawn";

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
  face: Face;
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
}

const SIZES: Record<Stage, { body: [number, number]; cap: [number, number]; eye: number; feet: number }> = {
  Spore: { body: [3.9, 3.6], cap: [0, 0], eye: 0.6, feet: 0 },
  Sprout: { body: [3.2, 3.9], cap: [5.6, 2.5], eye: 0.9, feet: 1.3 },
  Truffle: { body: [5.6, 6.6], cap: [10.2, 5.1], eye: 1.2, feet: 2.0 },
  Elder: { body: [6.6, 7.2], cap: [14.6, 6.4], eye: 1.25, feet: 2.3 }
};

/** Blinks every few seconds, sometimes twice in a row. Pure in the clock. */
export function blinking(sec: number): boolean {
  const period = 3.3;
  const k = Math.floor(sec / period);
  const d = sec - k * period - (0.4 + hash(k * 13 + 5) * 2.2);
  if (d >= 0 && d < 0.13) return true;
  return hash(k * 7 + 1) > 0.62 && d >= 0.28 && d < 0.41;
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
  const amp = face === "asleep" ? 0.05 : face === "wilting" ? 0.022 : 0.035;
  const breath = o.reduced ? 0 : breathOf(sec, face) * amp;
  // Poses: a slow sway when content, small hops when affectionate.
  const sway = o.reduced ? 0 : face === "content" ? Math.sin(sec * 0.9) * 0.4 : face === "affectionate" ? Math.sin(sec * 1.6) * 0.6 : 0;
  const hop = o.reduced || face !== "affectionate" ? 0 : Math.pow(Math.max(0, Math.sin(sec * Math.PI * 1.25)), 2) * 1.1;
  const cx = o.centre * ASPECT + sway;
  const g = o.ground + 0.6 - hop + sinkOf(o);
  const shapes: Ellipsoid[] = [];
  const marks: Model["marks"] = [];
  let dim = 1;

  // Body.
  let [brx, bry] = S.body;
  if (face === "asleep") {
    brx *= 1.08;
    bry *= 0.9;
  } else if (face === "tired") {
    brx *= 1.04;
    bry *= 0.93;
  } else if (face === "wilting") {
    brx *= 1.06;
    bry *= 0.88;
  } else if (face === "yawn") {
    bry *= 1.05;
  }
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
    shapes.push({ cx: cx - brx * 0.62, cy: fy, rx: S.feet, ry: S.feet * 0.5, rz: 0.9, z: 0.6, m: M.FOOT });
    shapes.push({ cx: cx + brx * 0.62, cy: fy, rx: S.feet, ry: S.feet * 0.5, rz: 0.9, z: 0.6, m: M.FOOT });
  }

  // Cap.
  let capRx = S.cap[0];
  if (capRx) {
    let capRy = S.cap[1];
    let capCx = cx;
    let capCy = g - bry * 2 - capRy * 0.35 + 0.8;
    if (face === "wilting") {
      capCx -= 2.2;
      capRy *= 0.74;
      capCy += 1.3;
      dim = 0.85;
    } else if (face === "tired" || face === "asleep") {
      capCy += 0.5;
      capCx -= face === "asleep" ? 0.6 : 0;
    }
    capCy -= breath * bry * 2;
    shapes.push({ cx: capCx, cy: capCy, rx: capRx, ry: capRy, rz: 0.75, z: 1.2, m: M.CAP });
    if (o.stage === "Elder" || face === "wilting") {
      // Drooping brim lobes.
      const droop = face === "wilting" ? 1.6 : 0.9;
      shapes.push({ cx: capCx - capRx * 0.62, cy: capCy + capRy * 0.35 + droop * 0.5, rx: capRx * 0.42, ry: capRy * 0.62, rz: 0.7, z: 1.1, m: M.CAP });
      shapes.push({ cx: capCx + capRx * 0.62, cy: capCy + capRy * 0.35 + droop * 0.5, rx: capRx * 0.42, ry: capRy * 0.62, rz: 0.7, z: 1.1, m: M.CAP });
    }
    // Spots on the cap, lit like the cap but drawn in the skin ink.
    const spots = o.stage === "Sprout" ? [[-0.35, -0.15, 0.22]] : o.stage === "Elder" ? [[-0.6, -0.05, 0.17], [-0.2, -0.55, 0.13], [0.12, -0.15, 0.15], [0.5, 0.15, 0.18], [-0.3, 0.38, 0.11], [0.72, -0.38, 0.1], [0.38, -0.55, 0.09], [-0.78, 0.35, 0.08]] : [[-0.5, -0.05, 0.22], [0.15, -0.45, 0.18], [0.52, 0.2, 0.2]];
    for (const [sx, sy, sr] of spots) {
      shapes.push({ cx: capCx + sx * capRx, cy: capCy + sy * capRy, rx: sr * capRx, ry: sr * capRx * 0.75, rz: 0.1, z: capRy * 0.75 + 1.3, m: M.SPOT });
    }
    if (o.stage === "Sprout") {
      // One small leaf on the cap.
      shapes.push({ cx: capCx + capRx * 0.55, cy: capCy - capRy - 0.6, rx: 1.6, ry: 0.7, rz: 0.4, z: 2, m: M.LEAF });
    }
  }

  // Face.
  const ey = o.stage === "Spore" ? bcy - 0.2 : bcy - bry * 0.18;
  const eyeDx = o.stage === "Spore" ? 0 : brx * 0.42;
  const er = S.eye;
  const closed = face === "asleep" || face === "yawn" || (!o.reduced && face !== "affectionate" && blinking(sec));
  const eyes = o.stage === "Spore" ? [cx] : [cx - eyeDx, cx + eyeDx];
  for (const ex of eyes) {
    if (o.stage === "Spore") {
      // One dot that breathes.
      const r = er * (!o.reduced && blinking(sec) ? 0.55 : 1 + breath * 2);
      shapes.push({ cx: ex, cy: ey, rx: r, ry: r, z: 3, m: M.PUPIL, flat: 0 });
      continue;
    }
    if (closed) {
      shapes.push({ cx: ex, cy: ey + er * 0.2, rx: er * 1.05, ry: 0.22, z: 3, m: M.PUPIL, flat: 0.05 });
      continue;
    }
    if (face === "affectionate") {
      // Happy arcs: a dark arc over a skin-coloured fill.
      shapes.push({ cx: ex, cy: ey + er * 0.35, rx: er * 1.05, ry: er * 0.75, z: 3, m: M.PUPIL, flat: 0.05 });
      shapes.push({ cx: ex, cy: ey + er * 0.75, rx: er * 0.85, ry: er * 0.65, z: 3.5, m: M.BODY });
      marks.push({ X: ex - (ex < cx ? er * 1.9 : -er * 1.9), Y: ey + er * 1.3, r: er * 0.55, lum: 0.9, layer: "cap" });
      continue;
    }
    const small = face === "wilting" ? 0.8 : 1;
    shapes.push({ cx: ex, cy: ey, rx: er * small, ry: er * 1.15 * small, z: 3, m: M.EYE, flat: 0.96 });
    const look = face === "wilting" ? 0.25 : face === "tired" ? 0.1 : 0;
    const px = ex + (o.light[0] > 0 ? 0.12 : -0.12) * er;
    shapes.push({ cx: px, cy: ey + look * er + er * 0.1, rx: er * 0.5 * small, ry: er * 0.64 * small, z: 3.5, m: M.PUPIL, flat: 0 });
    shapes.push({ cx: px - er * 0.22, cy: ey - er * 0.18, rx: er * 0.2, ry: er * 0.22, z: 4, m: M.GLINT, flat: 1 });
    if (face === "tired") shapes.push({ cx: ex, cy: ey - er * 0.95, rx: er * 1.15, ry: er * 0.85, z: 4.5, m: M.LID });
    else if (o.stage === "Elder") shapes.push({ cx: ex, cy: ey - er * 1.25, rx: er * 1.15, ry: er * 0.75, z: 4.5, m: M.LID });
  }

  // Mouth.
  if (o.stage !== "Spore") {
    const my = ey + er * 1.9;
    if (face === "yawn") {
      shapes.push({ cx, cy: my + 0.3, rx: er * 0.9, ry: er * 1.15, z: 3, m: M.MOUTH, flat: 0.05 });
      shapes.push({ cx, cy: my + 0.45, rx: er * 0.5, ry: er * 0.7, z: 3.5, m: M.MOUTH, flat: 0.3 });
    } else if (face === "asleep") {
      marks.push({ X: cx, Y: my, r: 0.3, lum: 0.1, layer: "ink" });
    } else if (face === "tired") {
      shapes.push({ cx, cy: my, rx: er * 0.9, ry: 0.2, z: 3, m: M.MOUTH, flat: 0.05 });
    } else {
      // A smile (or a frown when wilting): a thin arc of small marks.
      const frown = face === "wilting";
      const r = er * (face === "affectionate" ? 1.3 : 1.0);
      for (let k = -3; k <= 3; k++) {
        const a = (k / 3) * 0.9;
        marks.push({ X: cx + Math.sin(a) * r, Y: my + (frown ? -1 : 1) * (Math.cos(a) * r * 0.55 - r * 0.3), r: 0.28, lum: 0.08, layer: "ink" });
      }
    }
  }

  return { shapes, marks, dim, capRx: capRx || brx, eyeY: ey };
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
  return k * k * (SIZES[o.stage].body[1] * 2 + 1.5);
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
        const wart = hit.m === M.CAP ? 0.06 * noise(X * 1.3, Y * 1.3, 5) : hit.m === M.STONE ? 0.08 * noise(X * 2.2, Y * 2.2, 9) : hit.m === M.MOUND ? 0.05 * noise(X * 2, Y * 2, 4) : 0;
        lum = shade(hit.n, o.light, hit.m === M.CAP ? 0.18 : 0.26, hit.m === M.EYE || hit.m === M.STONE || hit.m === M.MOUND ? 0 : 0.28) + wart;
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
        L.cap.set(x, y, -1);
        L.skin.set(x, y, -1);
        if (m !== M.EYE && m !== M.GLINT) L.white.set(x, y, -1);
      }
    }
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
