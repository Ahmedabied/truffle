// Procedural shading into character density. Every solid thing in the world
// (the Truffle, the moon, the clouds, the dunes) is lit from a direction and
// mapped onto a ramp, the way image-to-ASCII converters shade a photograph.
// Cells are about 0.55 wide to 1 tall; callers pass cell sizes, the normals
// are computed in normalised ellipse space so the lighting is aspect-safe.

export type Vec3 = [number, number, number];

export const CELL_ASPECT = 0.55;

/** Dark to light. */
const RAMP = " .:-=+*#%@";
/** Softer ramp for clouds and haze. */
const SOFT = " .:-=+";

export function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/**
 * Light direction toward a thing at screen cell (cx, cy) from a light at (lx, ly),
 * in visual units (x scaled by the cell aspect). z points at the viewer.
 */
export function lightFrom(lx: number, ly: number, cx: number, cy: number, height = 0.75): Vec3 {
  const dx = (lx - cx) * CELL_ASPECT;
  const dy = ly - cy;
  const d = Math.hypot(dx, dy) || 1;
  return normalize([dx / d, dy / d, height]);
}

/** Pseudo noise in [-1, 1], smooth-ish, deterministic. */
function noise(x: number, y: number, seed: number): number {
  const a = Math.sin(x * 1.7 + y * 2.3 + seed) * Math.sin(x * 0.9 - y * 1.1 + seed * 0.7);
  const b = Math.sin(x * 3.1 - y * 0.7 + seed * 1.3) * 0.5;
  return (a + b) / 1.5;
}

/** Luminance 0..1 to a ramp character. inkLight: dense characters are the lit side. */
export function toChar(lum: number, inkLight: boolean, ramp = RAMP): string {
  const n = ramp.length - 1;
  const i = Math.max(0, Math.min(n, Math.round(lum * n)));
  return ramp[inkLight ? i : n - i];
}

export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Height scale of the dome (1 = sphere, lower = flatter). */
  z?: number;
}

export interface ShadeOpts {
  light: Vec3;
  inkLight: boolean;
  ambient?: number;
  /** Bump amplitude for a warty skin. */
  bump?: number;
  seed?: number;
  ramp?: string;
  /** Minimum density on the rim so the silhouette never vanishes. */
  rim?: number;
  /** Draw a one-cell outline ( . - ) ' _ around the shape, like a drawn sprite. */
  outline?: boolean;
  /** Keep the interior between these ramp fractions so lit cells never go blank. */
  range?: [number, number];
}

/**
 * Shade a union of ellipsoid domes into a w x h character block. Cells
 * outside every dome are spaces. The dome with the greatest height wins a cell.
 */
export function shadeDomes(w: number, h: number, domes: Ellipse[], o: ShadeOpts): string[] {
  const ramp = o.ramp ?? RAMP;
  const ambient = o.ambient ?? 0.22;
  const bump = o.bump ?? 0;
  const seed = o.seed ?? 0;
  const rim = o.rim ?? 1;
  const [lo, hi] = o.range ?? [0, 1];
  const nmax = ramp.length - 1;
  const cells: (string | null)[][] = [];
  const normals: ([number, number] | null)[][] = [];
  for (let y = 0; y < h; y++) {
    const row: (string | null)[] = [];
    const nrow: ([number, number] | null)[] = [];
    for (let x = 0; x < w; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let best = -1;
      let nx = 0;
      let ny = 0;
      let nz = 1;
      let edge = 0;
      for (const e of domes) {
        const u = (px - e.cx) / e.rx;
        const v = (py - e.cy) / e.ry;
        const d = u * u + v * v;
        if (d > 1) continue;
        const z = Math.sqrt(1 - d) * (e.z ?? 1);
        if (z > best) {
          best = z;
          nx = (u / e.rx) * (1 / CELL_ASPECT);
          ny = v / e.ry;
          nz = z / Math.min(e.rx * CELL_ASPECT, e.ry);
          edge = d;
        }
      }
      if (best < 0) {
        row.push(null);
        nrow.push(null);
        continue;
      }
      const n = normalize([nx, ny, nz]);
      let lum = ambient + (1 - ambient) * Math.max(0, n[0] * o.light[0] + n[1] * o.light[1] + n[2] * o.light[2]);
      if (bump) lum += bump * noise(px, py * 1.8, seed);
      lum = lo + (hi - lo) * Math.max(0, Math.min(1, lum));
      let i = Math.round(lum * nmax);
      if (!o.inkLight) i = nmax - i;
      if (edge > 0.78) i = Math.max(i, rim);
      row.push(ramp[Math.max(0, Math.min(nmax, i))]);
      nrow.push([n[0], n[1]]);
    }
    cells.push(row);
    normals.push(nrow);
  }
  if (o.outline) {
    const outside = (x: number, y: number) => y < 0 || y >= h || x < 0 || x >= w || cells[y][x] === null;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = normals[y][x];
        if (!n) continue;
        const up = outside(x, y - 1);
        const down = outside(x, y + 1);
        const left = outside(x - 1, y);
        const right = outside(x + 1, y);
        if (!(up || down || left || right)) continue;
        let ch: string;
        if (up && left) ch = ".";
        else if (up && right) ch = ".";
        else if (down && left) ch = "'";
        else if (down && right) ch = "'";
        else if (up) ch = "-";
        else if (down) ch = "_";
        else if (left) ch = "(";
        else ch = ")";
        cells[y][x] = ch;
      }
    }
  }
  return cells.map((r) => r.map((c) => c ?? " ").join(""));
}

/** A sphere lit from the phase angle: 0 new, 0.25 first quarter, 0.5 full. */
export function moonRows(phase: number, w = 7, h = 4, inkLight = true): string[] {
  const a = phase * Math.PI * 2;
  const light: Vec3 = normalize([Math.sin(a), -0.08, -Math.cos(a)]);
  const rows = shadeDomes(w, h, [{ cx: w / 2, cy: h / 2, rx: w / 2, ry: h / 2 }], {
    light,
    inkLight,
    ambient: 0.04,
    rim: 0,
    seed: 3
  });
  // A few craters on the lit face.
  if (phase > 0.32 && phase < 0.68) {
    const r = rows.map((s) => s.split(""));
    const craters: [number, number][] = [[2, 1], [4, 2], [3, 3]];
    for (const [x, y] of craters) if (r[y]?.[x] && r[y][x] !== " ") r[y][x] = inkLight ? ":" : "o";
    return r.map((s) => s.join(""));
  }
  return rows;
}

export type CloudKind = "wisp" | "small" | "medium" | "large" | "stratus" | "storm";

const CLOUD_SHAPES: Record<CloudKind, { w: number; h: number; domes: Ellipse[] }> = {
  wisp: { w: 9, h: 2, domes: [{ cx: 4.5, cy: 1.1, rx: 4.5, ry: 1.1, z: 0.45 }] },
  small: { w: 8, h: 2, domes: [{ cx: 3, cy: 1.3, rx: 3, ry: 1.3 }, { cx: 5.5, cy: 1.4, rx: 2.5, ry: 1.0 }] },
  medium: {
    w: 12,
    h: 3,
    domes: [{ cx: 3.5, cy: 2, rx: 3.5, ry: 1.6 }, { cx: 7, cy: 1.5, rx: 3.6, ry: 1.9 }, { cx: 9.5, cy: 2.2, rx: 2.5, ry: 1.2 }]
  },
  large: {
    w: 16,
    h: 4,
    domes: [
      { cx: 4, cy: 3, rx: 4, ry: 1.8 },
      { cx: 8, cy: 2, rx: 4.5, ry: 2.4 },
      { cx: 12.5, cy: 2.8, rx: 3.5, ry: 1.7 },
      { cx: 6.5, cy: 3.2, rx: 6, ry: 1.2, z: 0.5 }
    ]
  },
  stratus: { w: 22, h: 2, domes: [{ cx: 11, cy: 1, rx: 11, ry: 1.2, z: 0.35 }, { cx: 6, cy: 1.2, rx: 5, ry: 1.0, z: 0.5 }] },
  storm: {
    w: 14,
    h: 5,
    domes: [
      { cx: 4, cy: 3.8, rx: 4, ry: 1.8 },
      { cx: 7, cy: 2.3, rx: 4.2, ry: 2.6 },
      { cx: 10.5, cy: 3.6, rx: 3.5, ry: 1.8 },
      { cx: 6, cy: 1.2, rx: 2.2, ry: 1.4 }
    ]
  }
};

const cloudCache = new Map<string, string[]>();

/** Top-lit cloud. Light has a touch of the sun's side so morning and evening clouds glow on one edge. */
export function cloudRows(kind: CloudKind, sunSide: number, inkLight: boolean): string[] {
  const side = Math.round(sunSide * 2) / 2;
  const key = `${kind}|${side}|${inkLight}`;
  let rows = cloudCache.get(key);
  if (!rows) {
    const s = CLOUD_SHAPES[kind];
    const thin = kind === "wisp" || kind === "stratus";
    rows = shadeDomes(s.w, s.h, s.domes, {
      light: normalize([side * 0.5, -0.85, 0.55]),
      inkLight,
      ambient: 0.3,
      ramp: SOFT,
      rim: 0,
      seed: 7,
      range: kind === "stratus" ? [0, 0.32] : thin ? [0, 0.5] : [0, 0.9]
    });
    cloudCache.set(key, rows);
  }
  return rows;
}

/** Perceived luminance 0..1 of a hex colour. */
export function luma(hexColor: string): number {
  const r = parseInt(hexColor.slice(1, 3), 16) / 255;
  const g = parseInt(hexColor.slice(3, 5), 16) / 255;
  const b = parseInt(hexColor.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
