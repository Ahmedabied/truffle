// The ASCII world. One 40 x 28 character buffer, composed back to front, one
// textContent write per rendered frame at 12 fps. Unchanged frames are skipped.

import type { Stage, Tier } from "../../../worker/src/config";
import type { Gravestone, Mood } from "../../../worker/src/engine";
import { gravestone, MOUND, spriteFor, type Face } from "../sprites";
import { COLS, ROWS } from "./grid";
import { bandOf, localHour, paletteFor } from "./sky";

const PERIOD = 1000 / 12;
const HORIZON = 16;
const GROUND_END = 25;
const ANCHOR = 24; // bottom row of the Truffle sprite

export const GULF = new Set(["OM", "AE", "SA", "QA", "KW", "BH"]);

export interface View {
  stage: Stage;
  mood: Mood;
  tier: Tier;
  energyPct: number;
  stepsToday: number;
  gravestones: Gravestone[];
  /** Values engraved on the big stone when dead. */
  ageDays: number;
  lifetimeSteps: number;
  country: string;
  tz: string;
  rain: boolean;
  windKmh: number;
  weatherCode: number;
  yawn: boolean;
  /** Debug: force a local hour (?hour=). */
  hourOverride: number | null;
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
  windKmh: 10,
  weatherCode: 1,
  yawn: false,
  hourOverride: null
};

const mod = (n: number, d: number) => ((n % d) + d) % d;

type Grid = string[][];

function put(g: Grid, x: number, y: number, text: string, opaque = true): void {
  if (y < 0 || y >= ROWS) return;
  let dx = 0;
  for (const ch of text) {
    const cx = x + dx++;
    if (cx < 0 || cx >= COLS) continue;
    if (!opaque && ch === " ") continue;
    g[y][cx] = ch;
  }
}

const stamp = (g: Grid, x: number, y: number, rows: string[], opaque = true) =>
  rows.forEach((r, i) => put(g, x, y + i, r, opaque));

/** Pure composition. `t` is the animation clock in frames (frozen under reduced motion). */
export function compose(v: View, t: number, cloudPhase: number, hour: number): string {
  const g: Grid = Array.from({ length: ROWS }, () => Array<string>(COLS).fill(" "));
  const band = bandOf(hour);
  const sand = GULF.has(v.country) || v.mood === "burrowed";

  // Stars.
  if (band === "night") for (let i = 0; i < 14; i++) put(g, (i * 13 + 3) % COLS, (i * 7 + 1) % 13, i % 3 ? "." : "+");

  // Clouds: more of them on cloudy codes. Drift is driven by wind.
  const clouds = v.weatherCode >= 3 || v.rain ? 4 : v.weatherCode === 2 ? 3 : 2;
  const cloudRows = [3, 6, 1, 9];
  const speeds = [1, 0.75, 0.55, 0.85];
  for (let i = 0; i < clouds; i++) {
    const x = Math.floor(mod(i * 13 + 1 + cloudPhase * speeds[i], COLS + 10)) - 5;
    stamp(g, x, cloudRows[i], ["  .--.  ", " (    ).", "(______)"]);
  }

  // Sun by day (06-19), moon by night. Arcs across the sky.
  const sun = hour >= 6 && hour < 19;
  const p = sun ? (hour - 6) / 13 : mod(hour - 19, 24) / 11;
  const lx = Math.round(2 + p * 31);
  const ly = Math.round(10 - Math.sin(p * Math.PI) * 9);
  stamp(g, lx, ly, sun ? ["\\ | /", "- O -", "/ | \\"] : [" .-. ", "(  . ", " `-. "]);

  // Heat shimmer over the horizon on burrowed days.
  if (v.mood === "burrowed") {
    for (let row = 12; row < HORIZON; row++) {
      for (let i = 0; i < 6; i++) {
        const x = mod(i * 7 + row * 3 + Math.floor(t / 4) * (row % 2 ? 1 : -1), COLS);
        put(g, x, row, "~");
      }
    }
  }

  // Horizon and ground.
  put(g, 0, HORIZON, "\u2500".repeat(COLS));
  for (let y = HORIZON + 1; y <= GROUND_END; y++) {
    for (let x = 0; x < COLS; x++) {
      const s = (x * 13 + y * 7) % 23;
      g[y][x] = sand ? (s < 3 ? "." : " ") : s < 5 ? '"' : s < 8 ? "," : s === 9 ? "v" : " ";
    }
  }
  if (sand && v.mood !== "burrowed") {
    put(g, 3, 19, "\\|/");
    put(g, 33, 22, "\\|/");
    put(g, 7, 25, "v");
  }

  // Rain, behind the pet so the face stays readable.
  if (v.rain) {
    for (let i = 0; i < 30; i++) {
      const y = Math.floor(mod(i * 7 + t * 0.5, GROUND_END));
      const x = mod(i * 11 + Math.floor(t / 8), COLS);
      put(g, x, y, v.windKmh > 20 ? "/" : "|");
    }
  }

  // A row of small stones for Truffles that came before.
  const past = v.mood === "dead" ? v.gravestones.slice(0, -1) : v.gravestones;
  past.slice(-6).forEach((_, i) => put(g, 1 + i * 2, GROUND_END, "n"));

  // Truffle itself.
  if (v.mood === "dead") {
    const stone = gravestone(v.stage);
    const top = ANCHOR - stone.length;
    stamp(g, Math.floor((COLS - stone[0].length) / 2), top, stone);
    const a = `${v.ageDays} ${v.ageDays === 1 ? "day" : "days"}`;
    const s = `${v.lifetimeSteps} steps`;
    put(g, Math.floor((COLS - a.length) / 2), ANCHOR, a);
    put(g, Math.floor((COLS - s.length) / 2), GROUND_END, s);
  } else if (v.mood === "burrowed") {
    const x = Math.floor((COLS - MOUND[0].length) / 2);
    stamp(g, x, 21, MOUND);
    const z = ["z", "zz", "zzz"][Math.floor(t / 8) % 3];
    put(g, x + 8, 19, z.padEnd(3), true);
  } else {
    const face: Face = v.yawn ? "yawn" : v.mood;
    const sp = spriteFor(v.stage, face, t);
    const w = sp.rows[0].length;
    const x = Math.floor((COLS - w) / 2) + sp.lean;
    const y = ANCHOR - sp.rows.length + 1;
    stamp(g, x, y, sp.rows);
    if (v.mood === "asleep" || v.mood === "tired" || face === "yawn") {
      if (v.mood === "asleep") {
        const k = Math.floor(t / 6) % 4;
        const top = HORIZON + 1;
        put(g, x + w - 3 + (k % 2), Math.max(top, y - 1 - k), "z", false);
        put(g, x + w - 1, Math.max(top, y - 2 - ((k + 2) % 4)), "z", false);
      }
      if (face === "yawn") put(g, x - 2, y + Math.floor(sp.rows.length / 2), t % 12 < 6 ? "~" : " ", false);
    }
    if (v.mood === "affectionate") {
      const k = Math.floor(t / 4) % 8;
      put(g, x + w - 2, y - 1 - Math.floor(k / 2), "<3", false);
      if (v.stage !== "Truffle") put(g, x + w, y + 1, "<3", false);
    }
  }

  // HUD.
  put(g, 0, 26, "\u2500".repeat(COLS));
  const filled = Math.max(0, Math.min(10, Math.round(v.energyPct / 10)));
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(10 - filled);
  const hud = ` ${bar} ${String(v.energyPct).padStart(3)}% ${v.stage.padEnd(7)} ${v.stepsToday}st ${v.tier}`;
  put(g, 0, 27, hud.slice(0, COLS));

  return g.map((r) => r.join("")).join("\n");
}

export class World {
  view: View = { ...EMPTY_VIEW };
  private reduced = false;
  private t = 0;
  private cloudPhase = 0;
  private last = "";
  private next: number | null = null;
  private prev: number | null = null;
  private paletteKey = "";
  frames = 0;

  constructor(private pre: HTMLElement) {
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

  private applyPalette(hour: number): void {
    const v = this.view;
    const sand = GULF.has(v.country) || v.mood === "burrowed";
    const band = bandOf(hour);
    const key = `${band}|${v.mood}|${sand}|${v.rain}`;
    if (key === this.paletteKey) return;
    this.paletteKey = key;
    const p = paletteFor(band, v.mood, sand, v.rain);
    const s = this.pre.style;
    s.setProperty("--sky", p.sky);
    s.setProperty("--ink", p.ink);
    s.setProperty("--soil", p.ground);
    s.filter = p.filter;
  }

  /** Render one frame now (used once at boot and by the loop). */
  draw(): void {
    const hour = this.hour();
    this.applyPalette(hour);
    const text = compose(this.view, this.t, this.cloudPhase, hour);
    if (text !== this.last) {
      this.last = text;
      this.pre.textContent = text; // the only grid DOM write
      this.frames++;
    }
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
        this.cloudPhase = mod(this.cloudPhase + (Math.min(elapsed, 250) / 1000) * (this.view.windKmh / 24), 100000);
      } else if (this.view.yawn) {
        // Reduced motion: the yawn face still shows, without the stretch loop.
        this.t = 0;
      }
      this.draw();
    };
    this.draw();
    requestAnimationFrame(loop);
  }
}
