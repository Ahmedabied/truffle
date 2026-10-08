// A cell raster for the world. Each layer is a field of luminance values, one
// per character cell, that the renderer turns into glyph density with an
// ordered dither, the way an image-to-ASCII converter treats a photograph.
// Geometry is evaluated in "row units": one unit is the height of a row, and
// a cell is ASPECT units wide, so a circle drawn here is a circle on screen.

import { COLS, ROWS } from "./grid";

export const W = COLS;
export const H = ROWS;
/** Cell width over cell height for the grid font (advance 0.6 em, line height 1 em). */
export const ASPECT = 0.6;

export type Vec3 = [number, number, number];

export const RAMP = " .:+*#%@";
export const SOFT = " .:+*";
/** The density ramp comes first; authored marks share the same real glyph atlas. */
export const GLYPHS = [...new Set(RAMP + Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)).join(""))].join("");

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export const clamp = (n: number, a: number, b: number) => (n < a ? a : n > b ? b : n);
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Hash to [0, 1), stable between frames. */
export function hash(n: number): number {
  let x = (n | 0) * 2654435761;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

/** Smooth value noise in [-1, 1]. */
export function noise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const h = (i: number, j: number) => hash(i * 7349 + j * 15731 + seed * 31) * 2 - 1;
  const h00 = h(xi, yi);
  const h01 = h(xi, yi + 1);
  const a = h00 + (h(xi + 1, yi) - h00) * sx;
  const b = h01 + (h(xi + 1, yi + 1) - h01) * sx;
  return a + (b - a) * sy;
}

/**
 * Luminance to a glyph with ordered dithering. inkLight: dense glyphs are the
 * bright side (light ink on dark paper). Otherwise dense glyphs are the dark side.
 */
export function glyph(lum: number, x: number, y: number, inkLight: boolean, ramp = RAMP): string {
  const n = ramp.length - 1;
  const b = (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  let i = Math.floor(clamp(lum, 0, 1) * n + b);
  if (i > n) i = n;
  if (!inkLight) i = n - i;
  return ramp[i];
}

/** Ramp index for a luminance at a cell (the same ordered dither as glyph). */
export function glyphIndex(lum: number, x: number, y: number, inkLight: boolean, n: number, floor = 0): number {
  const b = (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  let i = Math.floor((lum < 0 ? 0 : lum > 1 ? 1 : lum) * n + b);
  if (i > n) i = n;
  if (!inkLight) i = n - i;
  if (i < floor) i = floor;
  return i;
}

/** One layer: a luminance per cell, negative for empty. Tracks the rows it touched so clear and paint skip the rest. */
export class Layer {
  lum = new Float32Array(W * H).fill(-1);
  /** Zero means shaded density; other indices are deliberate ASCII strokes. */
  symbols = new Uint8Array(W * H);
  /** First and last row written since the last clear (y0 > y1 when empty). */
  y0 = H;
  y1 = -1;

  clear(): void {
    if (this.y1 >= this.y0) {
      this.lum.fill(-1, this.y0 * W, (this.y1 + 1) * W);
      this.symbols.fill(0, this.y0 * W, (this.y1 + 1) * W);
    }
    this.y0 = H;
    this.y1 = -1;
  }

  /** Copy another layer's cells (used to restore a cached base each frame). */
  copy(from: Layer): void {
    this.lum.set(from.lum);
    this.symbols.set(from.symbols);
    this.y0 = from.y0;
    this.y1 = from.y1;
  }

  private touch(y: number): void {
    if (y < this.y0) this.y0 = y;
    if (y > this.y1) this.y1 = y;
  }

  set(x: number, y: number, l: number): void {
    x |= 0;
    y |= 0;
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    this.lum[y * W + x] = l;
    this.symbols[y * W + x] = 0;
    if (l >= 0) this.touch(y);
  }

  get(x: number, y: number): number {
    if (x < 0 || x >= W || y < 0 || y >= H) return -1;
    return this.lum[y * W + x];
  }

  /** One hand-placed glyph, still clipped, masked and painted like the raster. */
  symbol(x: number, y: number, char: string): void {
    x |= 0;
    y |= 0;
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const code = GLYPHS.indexOf(char);
    if (code <= 0) return;
    const i = y * W + x;
    this.lum[i] = 1;
    this.symbols[i] = code;
    this.touch(y);
  }

  /** Keep the brighter of the two values (for glows and sparkles). */
  add(x: number, y: number, l: number): void {
    x |= 0;
    y |= 0;
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = y * W + x;
    if (l > this.lum[i]) {
      this.lum[i] = l;
      this.symbols[i] = 0;
      this.touch(y);
    }
  }

  /** Scale a cell that is already drawn (for shadows). */
  mul(x: number, y: number, k: number): void {
    x |= 0;
    y |= 0;
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = y * W + x;
    if (this.lum[i] >= 0) this.lum[i] *= k;
  }

  /** Rows of text, one string per row. Cells under the mask are left blank. */
  rows(inkLight: boolean, ramp = RAMP, mask?: Uint8Array, floor = 0): string[] {
    const rows: string[] = new Array(H);
    for (let y = 0; y < H; y++) {
      let s = "";
      const base = y * W;
      for (let x = 0; x < W; x++) {
        const l = this.lum[base + x];
        s += l < 0 || (mask && mask[base + x]) ? " " : this.symbols[base + x]
          ? GLYPHS[this.symbols[base + x]] : ramp[glyphIndex(l, x, y, inkLight, ramp.length - 1, floor)];
      }
      rows[y] = s;
    }
    return rows;
  }

  /** Render to text. Cells under the mask are left blank. */
  text(inkLight: boolean, ramp = RAMP, mask?: Uint8Array, floor = 0): string {
    return this.rows(inkLight, ramp, mask, floor).join("\n");
  }
}

/** Stamp a small bitmap (rows of "#" and " ") as a flat luminance. */
export function stamp(L: Layer, x: number, y: number, rows: string[], lum = 1): void {
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) if (r[i] !== " ") L.set(x + i, y + j, r[i] === "." ? lum * 0.45 : lum);
  }
}

/** Solid disc in row units, with a soft edge, written as flat luminance. */
export function disc(L: Layer, cx: number, cy: number, r: number, lum: number, soft = 0.6): void {
  const x0 = Math.max(0, Math.floor((cx - r) / ASPECT) - 1);
  const x1 = Math.min(W - 1, Math.ceil((cx + r) / ASPECT) + 1);
  const y0 = Math.max(0, Math.floor(cy - r) - 1);
  const y1 = Math.min(H - 1, Math.ceil(cy + r) + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot((x + 0.5) * ASPECT - cx, y + 0.5 - cy);
      if (d > r + soft) continue;
      const k = 1 - smooth(r - soft, r + soft, d);
      L.add(x, y, lum * k);
    }
  }
}

/** A line of cells from (x0,y0) to (x1,y1) in cell coordinates. */
export function line(L: Layer, x0: number, y0: number, x1: number, y1: number, lum: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    L.add(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), lum);
  }
}

export interface Ellipsoid {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Depth radius as a fraction of the smaller screen radius (1 = round). */
  rz?: number;
  /** Push the surface toward the viewer so it wins over what it sits on. */
  z?: number;
  /** Material tag, read back by the caller. */
  m: number;
  /** Flat luminance instead of lighting. */
  flat?: number;
}

export interface Hit {
  z: number;
  n: Vec3;
  m: number;
  flat: number;
  /** Normalised squared distance from the centre (1 at the rim). */
  d: number;
}

/** Nearest ellipsoid under a point in row units, or null. */
export function hitEllipsoids(shapes: Ellipsoid[], X: number, Y: number, out: Hit): boolean {
  let best = -Infinity;
  let found = false;
  for (let i = 0; i < shapes.length; i++) {
    const e = shapes[i];
    const u = (X - e.cx) / e.rx;
    const v = (Y - e.cy) / e.ry;
    const d = u * u + v * v;
    if (d > 1) continue;
    const rz = (e.rz ?? 1) * Math.min(e.rx, e.ry);
    const h = Math.sqrt(1 - d);
    const z = h * rz + (e.z ?? 0);
    if (z <= best) continue;
    best = z;
    found = true;
    out.z = z;
    out.m = e.m;
    out.flat = e.flat ?? -1;
    out.d = d;
    // Gradient of (u^2 + v^2 + (z/rz)^2).
    const nx = u / e.rx;
    const ny = v / e.ry;
    const nz = h / rz;
    const length = Math.hypot(nx, ny, nz) || 1;
    out.n[0] = nx / length;
    out.n[1] = ny / length;
    out.n[2] = nz / length;
  }
  return found;
}

/** Lambert with a soft specular, ambient and a rim darkening. */
export function shade(n: Vec3, light: Vec3, ambient = 0.22, spec = 0.3): number {
  const diff = Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
  let l = ambient + (1 - ambient) * diff;
  if (spec > 0) {
    const hx = light[0];
    const hy = light[1];
    const hz = light[2] + 1;
    const hl = Math.hypot(hx, hy, hz) || 1;
    const s = Math.max(0, (n[0] * hx + n[1] * hy + n[2] * hz) / hl);
    l += spec * Math.pow(s, 18);
  }
  if (n[2] < 0.42) l *= 0.6 + n[2];
  return clamp(l, 0, 1);
}

/** Perceived luminance 0..1 of a hex colour. */
export function luma(hexColor: string): number {
  const r = parseInt(hexColor.slice(1, 3), 16) / 255;
  const g = parseInt(hexColor.slice(3, 5), 16) / 255;
  const b = parseInt(hexColor.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
