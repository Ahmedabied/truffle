// A glyph atlas and cell damage tracking. Unchanged sky and terrain issue no
// draw calls. Repaint changed cells in layer order, including cleared glyphs.
import { COLS, ROWS } from "./grid";
import { glyphIndex, GLYPHS, Layer, W } from "./raster";

export interface Ink { colour: string; alpha: number; weight?: number }
export interface Paint {
  layer: Layer;
  ink: number;
  inkLight: boolean;
  ramp: string;
  mask?: Uint8Array;
}

export class Surface {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private atlas: HTMLCanvasElement;
  private actx: CanvasRenderingContext2D;
  private previous: Uint8Array[] = [];
  private current: Uint8Array[] = [];
  private damage = new Uint8Array(COLS * ROWS);
  private damagedCells = new Uint16Array(COLS * ROWS);
  private invalid = true;
  readonly stats = { changedCells: 0, glyphDraws: 0 };
  cw = 0;
  ch = 0;
  private sizeKey = "";
  private inkKey = "";
  private fontFamily = "monospace";

  constructor(private root: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.dataset.layer = "world";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.display = "block";
    this.canvas.style.flex = "0 0 auto";
    root.appendChild(this.canvas);
    const ctx = this.canvas.getContext("2d", { alpha: true });
    this.atlas = document.createElement("canvas");
    const actx = this.atlas.getContext("2d");
    if (!ctx || !actx) throw new Error("The ASCII world needs a 2D canvas context");
    this.ctx = ctx;
    this.actx = actx;
    this.fontFamily = getComputedStyle(root).fontFamily || "monospace";
    document.fonts?.ready.then(() => { this.inkKey = ""; this.sizeKey = ""; });
  }

  fit(): boolean {
    const font = this.root.style.fontSize;
    const width = this.root.clientWidth;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cellWidth = this.root.style.getPropertyValue?.("--world-cell-width");
    const key = `${font}|${width}|${cellWidth}|${dpr}`;
    if (key === this.sizeKey && this.cw) return false;
    this.sizeKey = key;
    const cssCell = parseFloat(cellWidth) || (width || 600) / COLS;
    const cssRow = parseFloat(font) || cssCell / 0.6;
    this.cw = Math.max(1, Math.round(cssCell * dpr));
    this.ch = Math.max(1, Math.round(cssRow * dpr));
    this.canvas.width = this.cw * COLS;
    this.canvas.height = this.ch * ROWS;
    // Preserve the fitter's geometry when device-pixel rounding changes aspect.
    this.canvas.style.width = `${cssCell * COLS}px`;
    this.canvas.style.height = `${cssRow * ROWS}px`;
    this.inkKey = "";
    this.invalid = true;
    return true;
  }

  inks(inks: Ink[]): void {
    const key = inks.map((i) => i.colour + i.alpha + ":" + (i.weight ?? 400)).join("|") + this.cw + "x" + this.ch;
    if (key === this.inkKey) return;
    this.inkKey = key;
    this.invalid = true;
    const { cw, ch } = this;
    this.atlas.width = cw * GLYPHS.length;
    this.atlas.height = ch * inks.length;
    const a = this.actx;
    a.font = `${ch}px ${this.fontFamily}`;
    a.textAlign = "center";
    a.textBaseline = "alphabetic";
    const m = a.measureText("M");
    const asc = m.fontBoundingBoxAscent || ch * 0.78;
    const desc = m.fontBoundingBoxDescent || ch * 0.22;
    const base = (ch - (asc + desc)) / 2 + asc;
    for (let r = 0; r < inks.length; r++) {
      a.font = `${inks[r].weight ?? 400} ${ch}px ${this.fontFamily}`;
      a.fillStyle = inks[r].colour;
      a.globalAlpha = inks[r].alpha;
      for (let g = 1; g < GLYPHS.length; g++) {
        a.save();
        a.beginPath();
        a.rect(g * cw, r * ch, cw, ch);
        a.clip();
        a.fillText(GLYPHS[g], g * cw + cw / 2, r * ch + base);
        a.restore();
      }
    }
    a.globalAlpha = 1;
  }

  /** Rebuild only cells whose visible glyph stack changed. */
  paint(layers: Paint[]): void {
    const size = COLS * ROWS;
    const damage = this.damage;
    damage.fill(this.invalid ? 1 : 0);
    if (this.current.length !== layers.length) {
      this.current = layers.map(() => new Uint8Array(size));
      this.previous = layers.map(() => new Uint8Array(size));
      damage.fill(1);
    }
    for (let n = 0; n < layers.length; n++) {
      const p = layers[n];
      const L = p.layer;
      const cells = this.current[n];
      const old = this.previous[n];
      cells.fill(0);
      const mask = p.mask;
      const rampMax = p.ramp.length - 1;
      for (let y = L.y0; y <= L.y1; y++) {
        const row = y * W;
        for (let x = 0; x < COLS; x++) {
          const i = row + x;
          const lum = L.lum[i];
          if (lum < 0 || mask?.[i]) continue;
          cells[i] = L.symbols[i] || glyphIndex(lum, x, y, p.inkLight, rampMax);
        }
      }
      for (let i = 0; i < size; i++) if (cells[i] !== old[i]) damage[i] = 1;
    }
    const c = this.ctx;
    const { cw, ch } = this;
    let changed = 0;
    let draws = 0;
    let damagedCount = 0;
    // Clear each contiguous damaged run, including glyphs which disappeared.
    for (let y = 0; y < ROWS; y++) {
      const row = y * COLS;
      for (let x = 0; x < COLS;) {
        if (!damage[row + x]) { x++; continue; }
        const start = x;
        while (x < COLS && damage[row + x]) { this.damagedCells[damagedCount++] = row + x; x++; }
        changed += x - start;
        c.clearRect(start * cw, y * ch, (x - start) * cw, ch);
      }
    }
    if (changed) {
      for (let n = 0; n < layers.length; n++) {
        const cells = this.current[n];
        const sy = layers[n].ink * ch;
        // Damage is usually a small fraction of the grid. Visit its cells,
        // instead of rescanning every static layer's full rectangle in storms.
        for (let k = 0; k < damagedCount; k++) {
          const i = this.damagedCells[k];
          const g = cells[i];
          if (g === 0) continue;
          const x = i % COLS, y = Math.floor(i / COLS);
          c.drawImage(this.atlas, g * cw, sy, cw, ch, x * cw, y * ch, cw, ch);
          draws++;
        }
      }
    }
    const spare = this.previous;
    this.previous = this.current;
    this.current = spare;
    this.invalid = false;
    this.stats.changedCells = changed;
    this.stats.glyphDraws = draws;
  }
}
