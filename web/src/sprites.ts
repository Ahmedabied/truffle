// The Truffle itself. Hand-tuned shaded sprites from fleet/outbox/A01 (lit from
// the upper left, with a cast shadow on the sand), in a dark-ink and a
// light-ink variant. The scene mirrors them when the light comes from the
// right, so the shadow side follows the sun across the day. Blinks, hearts
// and z's are overlaid by the renderer.

import type { Stage } from "../../worker/src/config";
import type { Mood } from "../../worker/src/engine";
import ART from "./art.json";
import type { Vec3 } from "./scene/shade";

export type Face = Mood | "yawn";

interface Asset {
  w: number;
  h: number;
  eyes: number[][];
  mouth: number[] | null;
  dark: string[];
  light: string[];
}
const art = ART as Record<string, Asset>;

export interface Sprite {
  rows: string[];
  /** Columns to nudge right (affection leans in). */
  lean: number;
  /** Row of the eyes inside the sprite, for effects that start at the face. */
  eyeRow: number;
}

export interface BodyOpts {
  light: Vec3;
  inkLight: boolean;
  frame: number;
  reduced: boolean;
}

const MIRROR: Record<string, string> = { "/": "\\", "\\": "/", "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "<": ">", ">": "<" };

/** Flip a sprite left to right, swapping the slanted glyphs so the drawing still reads. */
export function mirror(rows: string[]): string[] {
  return rows.map((r) =>
    r
      .split("")
      .reverse()
      .map((c) => MIRROR[c] ?? c)
      .join("")
  );
}

const overlay = (rows: string[], x: number, y: number, text: string): void => {
  if (y < 0 || y >= rows.length) return;
  const r = rows[y].split("");
  for (let i = 0; i < text.length; i++) if (x + i >= 0 && x + i < r.length) r[x + i] = text[i];
  rows[y] = r.join("");
};

function pick(key: string, inkLight: boolean): Asset & { rows: string[] } {
  const a = art[key] ?? art.truffle_content;
  return { ...a, rows: [...(inkLight ? a.light : a.dark)] };
}

const FACE_KEY: Record<Face, string> = {
  content: "content",
  affectionate: "affectionate",
  asleep: "asleep",
  tired: "tired",
  wilting: "wilting",
  yawn: "yawn",
  burrowed: "asleep",
  dead: "asleep"
};

/** Sprite for a stage and face. Burrowed and dead are drawn by the scene. */
export function spriteFor(stage: Stage, face: Face, o: BodyOpts): Sprite {
  const t = o.reduced ? 0 : o.frame;
  const asset = pick(`${stage.toLowerCase()}_${FACE_KEY[face]}`, o.inkLight);
  const flip = o.light[0] > 0.15;
  let rows = flip ? mirror(asset.rows) : asset.rows;
  const eyes = asset.eyes.map(([x, y]) => [flip ? asset.w - 1 - x : x, y]);

  // Blink: both eyes close for three frames every seven seconds.
  const canBlink = eyes.length === 2 && face !== "asleep" && face !== "wilting" && face !== "yawn";
  if (canBlink && !o.reduced && (t + 40) % 84 < 3) {
    rows = [...rows];
    for (const [x, y] of eyes) overlay(rows, x, y, "-");
  }
  // The spore's single dot breathes.
  if (stage === "Spore" && !o.reduced) {
    const [x, y] = (art.spore_content as Asset & { seed?: number[] }).eyes[0] ?? [7, 3];
    if (t % 48 >= 24) overlay(rows, flip ? asset.w - 1 - x : x, y, ".");
  }
  const lean = face === "affectionate" ? (t % 72 < 36 ? 1 : 0) : 0;
  const eyeRow = eyes[0]?.[1] ?? Math.floor(asset.h / 2);
  return { rows, lean, eyeRow };
}

/** Gravestone with a bevel on the lit edge and a shadow side. The stage is in the HUD and the label. */
export function gravestone(_stage: Stage, inkLight: boolean, withFlower: boolean): string[] {
  return pick(withFlower ? "stone_flower" : "stone", inkLight).rows;
}

/** A sand mound with Truffle curled under it, for heat days. */
export function mound(light: Vec3, inkLight: boolean, peek: boolean): string[] {
  const a = pick(peek ? "mound_peek" : "mound", inkLight);
  return light[0] > 0.15 ? mirror(a.rows) : a.rows;
}
