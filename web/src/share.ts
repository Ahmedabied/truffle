// The share card: a 1080 x 1350 PNG drawn on an offscreen canvas from what the
// page already shows. The world as text on its palette background, the HUD line,
// the newest moment line, and a small footer. No libraries. Nothing leaves the
// device except through the person's own share sheet or a download.

import type { Lang } from "./copy";

export const CARD_W = 1080;
export const CARD_H = 1350;
const SIDE = 72;
const TOP = 64;
const TEXT_BLOCK = 270; // room under the world for the moment, HUD and footer
const MONO = '"DejaVu Sans Mono", "Noto Sans Mono", "Droid Sans Mono", "Roboto Mono", Menlo, Consolas, monospace';
const SANS = 'system-ui, "Noto Sans Arabic", "Geeza Pro", Tahoma, sans-serif';
export const PUBLIC_HOST = "truffle-web.ahmed-abied.workers.dev";

export interface Stop {
  color: string;
  at: number; // 0..1
}

export interface TextLayer {
  text: string;
  color: string;
  alpha: number;
}

export interface WorldPicture {
  layers: TextLayer[];
  image: CanvasImageSource | null;
  stops: Stop[];
}

export interface CardText {
  lang: Lang;
  bg: string;
  fg: string;
  muted: string;
  hud: string;
  moment: string;
  tag: string;
  host: string;
}

/** Colour stops of a CSS linear-gradient, as the browser reports it (hex or rgb()). */
export function parseGradient(css: string): Stop[] {
  const rx = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\s+(-?[\d.]+)%/g;
  const out: Stop[] = [];
  for (let m = rx.exec(css); m; m = rx.exec(css)) {
    const at = Math.min(1, Math.max(0, Number(m[2]) / 100));
    if (Number.isFinite(at)) out.push({ color: m[1], at });
  }
  return out;
}

/** The host shown on the card: this site, or the public one when running locally. */
export function cardHost(host: string): string {
  return !host || /^(localhost|127\.|0\.0\.0\.0|\[::1\]|192\.168\.|10\.)/.test(host) ? PUBLIC_HOST : host;
}

export function fileName(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `truffle-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.png`;
}

type FrameExport = { frame?: () => unknown };

/** Read what the world shows right now. Prefers a world.frame() export, else the DOM. */
export function readWorld(root: HTMLElement, world: unknown): WorldPicture {
  const stops = parseGradient(getComputedStyle(root).backgroundImage || root.style.background || "");
  const colorOf = (el: Element | null) => (el ? getComputedStyle(el).color : getComputedStyle(root).color);
  const alphaOf = (el: Element | null) => (el ? Number(getComputedStyle(el).opacity) || 1 : 1);
  const pres = Array.from(root.querySelectorAll<HTMLElement>("pre"));

  const exp = (world as FrameExport | null)?.frame;
  if (typeof exp === "function") {
    try {
      const f = exp.call(world);
      if (f instanceof HTMLCanvasElement) return { layers: [], image: f, stops };
      if (typeof f === "string") return { layers: [{ text: f, color: colorOf(pres[0] ?? null), alpha: 1 }], image: null, stops };
      const rec = (f as { layers?: unknown } | null)?.layers ?? f;
      if (rec && typeof rec === "object") {
        const layers: TextLayer[] = [];
        for (const [name, text] of Object.entries(rec as Record<string, unknown>)) {
          if (typeof text !== "string") continue;
          const el = root.querySelector(`pre[data-layer="${CSS.escape(name)}"]`);
          layers.push({ text, color: colorOf(el), alpha: alphaOf(el) });
        }
        if (layers.length) return { layers, image: null, stops };
      }
    } catch {
      /* fall back to the DOM */
    }
  }
  if (pres.length) {
    return { layers: pres.map((p) => ({ text: p.textContent ?? "", color: colorOf(p), alpha: alphaOf(p) })), image: null, stops };
  }
  const canvas = root.querySelector("canvas");
  return { layers: [], image: canvas, stops };
}

/** Largest font size, at most max, that fits text in width. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: string, max: number, width: number, family: string): number {
  let size = max;
  for (; size > 12; size -= 1) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= width) break;
  }
  return size;
}

export function drawCard(canvas: HTMLCanvasElement, pic: WorldPicture, t: CardText): void {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // The world: 100 x 68 cells, as large as the frame allows.
  const lines = pic.layers.map((l) => l.text.split("\n"));
  const cols = Math.max(1, ...lines.flat().map((l) => l.length));
  const rows = Math.max(1, ...lines.map((l) => l.length));
  ctx.font = `100px ${MONO}`;
  const k = ctx.measureText("M".repeat(cols)).width / (100 * cols) || 0.6;
  const maxW = CARD_W - 2 * SIDE;
  const maxH = CARD_H - TOP - TEXT_BLOCK;
  let size = Math.min(maxW / (cols * k), maxH / rows);
  let w = cols * k * size;
  let h = rows * size;
  if (pic.image && !pic.layers.length) {
    const iw = (pic.image as HTMLCanvasElement).width || 100;
    const ih = (pic.image as HTMLCanvasElement).height || 68;
    const s = Math.min(maxW / iw, maxH / ih);
    w = iw * s;
    h = ih * s;
    size = 0;
  }
  const x0 = Math.round((CARD_W - w) / 2);
  const y0 = TOP;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, 14);
  ctx.clip();
  if (pic.stops.length >= 2) {
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    for (const s of pic.stops) g.addColorStop(s.at, s.color);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = "#86bce6";
  }
  ctx.fillRect(x0, y0, w, h);
  if (size > 0) {
    ctx.font = `${size}px ${MONO}`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.direction = "ltr";
    pic.layers.forEach((layer, i) => {
      ctx.globalAlpha = layer.alpha;
      ctx.fillStyle = layer.color;
      lines[i].forEach((row, r) => {
        if (row.trim()) ctx.fillText(row, x0, y0 + r * size, w);
      });
    });
    ctx.globalAlpha = 1;
  } else if (pic.image) {
    ctx.drawImage(pic.image, x0, y0, w, h);
  }
  ctx.restore();

  // Text under the world. Arabic flows right to left from the right edge.
  const rtl = t.lang === "ar";
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  ctx.textBaseline = "alphabetic";
  const tx = rtl ? x0 + w : x0;
  const tw = w;
  let y = y0 + h + 72;
  if (t.moment) {
    ctx.fillStyle = t.fg;
    fit(ctx, t.moment, "700", 40, tw, SANS);
    ctx.fillText(t.moment, tx, y);
    y += 52;
  }
  ctx.fillStyle = t.muted;
  fit(ctx, t.hud, "400", 26, tw, SANS);
  ctx.fillText(t.hud, tx, y);

  ctx.fillStyle = t.fg;
  fit(ctx, t.tag, "600", 30, tw, SANS);
  ctx.fillText(t.tag, tx, CARD_H - 92);
  ctx.fillStyle = t.muted;
  ctx.direction = "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  fit(ctx, t.host, "400", 24, tw, MONO);
  ctx.fillText(t.host, tx, CARD_H - 54);
}

export function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/png")
  );
}

/** The share sheet when the browser can share files, else a download. */
export async function deliver(blob: Blob, name: string, title: string): Promise<"shared" | "cancelled" | "downloaded"> {
  const file = new File([blob], name, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return "cancelled";
      // NotAllowedError and friends: fall through to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
