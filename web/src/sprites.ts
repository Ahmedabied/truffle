// The Truffle itself: a lit, shaded body per stage with a face drawn on top.
// Bodies are shaded at runtime from the real light direction (sun or moon),
// so the shadow side moves across the day. Faces are hand-drawn.

import type { Stage } from "../../worker/src/config";
import type { Mood } from "../../worker/src/engine";
import { shadeDomes, type Vec3 } from "./scene/shade";

export type Face = Mood | "yawn";

export interface Sprite {
  rows: string[];
  /** Columns to nudge right (affection leans in). */
  lean: number;
  /** Where the eyes landed, for effects that start at the face. */
  eyeRow: number;
}

interface FaceParts {
  eye: string;
  mouth: string;
}

const FACES: Record<Face, FaceParts> = {
  content: { eye: "o", mouth: "\\__/" },
  affectionate: { eye: "^", mouth: "\\__/" },
  asleep: { eye: "-", mouth: " .. " },
  tired: { eye: "u", mouth: " -- " },
  wilting: { eye: ".", mouth: " ~~ " },
  burrowed: { eye: "-", mouth: " .. " },
  dead: { eye: "x", mouth: "    " },
  yawn: { eye: "-", mouth: "(  )" }
};

const overlay = (rows: string[], x: number, y: number, text: string): void => {
  if (y < 0 || y >= rows.length) return;
  const r = rows[y].split("");
  for (let i = 0; i < text.length; i++) {
    const cx = x + i;
    if (cx >= 0 && cx < r.length) r[cx] = text[i];
  }
  rows[y] = r.join("");
};

interface BodySpec {
  w: number;
  h: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  bump: number;
  /** Eye offset from centre, in cells, and the mouth row offset. */
  eyeDx: number;
  eyeDy: number;
  mouthDy: number;
}

const BODIES: Record<Stage, BodySpec> = {
  Spore: { w: 16, h: 5, cx: 8, cy: 4.6, rx: 3.2, ry: 1.9, bump: 0, eyeDx: 0, eyeDy: -1, mouthDy: 0 },
  Sprout: { w: 16, h: 7, cx: 8, cy: 5.4, rx: 4.6, ry: 2.4, bump: 0.06, eyeDx: 1.6, eyeDy: -1, mouthDy: 0 },
  Truffle: { w: 18, h: 9, cx: 9, cy: 5.0, rx: 8.7, ry: 4.2, bump: 0.14, eyeDx: 3, eyeDy: -1, mouthDy: 1 },
  Elder: { w: 22, h: 11, cx: 11, cy: 6.6, rx: 10.7, ry: 4.8, bump: 0.18, eyeDx: 3.5, eyeDy: -1, mouthDy: 1 }
};

export interface BodyOpts {
  light: Vec3;
  inkLight: boolean;
  frame: number;
  reduced: boolean;
}

/** Sprite for a stage and face. Burrowed and dead are drawn by the scene. */
export function spriteFor(stage: Stage, face: Face, o: BodyOpts): Sprite {
  const b = BODIES[stage];
  const f = FACES[face];
  const t = o.reduced ? 0 : o.frame;
  const breath = stage === "Spore" ? 0 : 0.035 * Math.sin(t / 9);
  const settle = face === "asleep" ? 0.9 : face === "wilting" ? 0.86 : face === "tired" ? 0.95 : 1;
  const ry = b.ry * settle * (1 + breath);
  const cy = b.cy + (b.ry - ry) * 0.9;
  const rows = shadeDomes(b.w, b.h, [{ cx: b.cx, cy, rx: b.rx * (1 - breath * 0.4), ry }], {
    light: o.light,
    inkLight: o.inkLight,
    bump: b.bump * 0.7,
    seed: stage === "Elder" ? 5 : 2,
    ambient: face === "wilting" ? 0.1 : 0.16,
    outline: true,
    // Dark ink by day: keep the lit side faint but present. Light ink at night: never a solid block.
    range: o.inkLight ? [0.04, 0.72] : [0.1, 0.96]
  });

  const eyeY = Math.round(cy + b.eyeDy);
  const blink = !o.reduced && face !== "asleep" && face !== "yawn" && face !== "wilting" && (t + 40) % 84 < 3;
  const eye = blink ? "-" : f.eye;
  const yawnOpen = face === "yawn" && t % 12 < 6;
  const mouth = face === "yawn" ? (yawnOpen ? "(  )" : " () ") : f.mouth;

  if (stage === "Spore") {
    // A lump under the sand: cracks around it, one dot that pulses as it breathes.
    const dot = t % 48 < 24 ? "o" : ".";
    overlay(rows, 0, 1, " '  .        .  '");
    overlay(rows, 0, 3, "  ,     .   ,   ");
    overlay(rows, b.cx - 1, eyeY + 1, ` ${dot} `);
    return { rows, lean: 0, eyeRow: eyeY + 1 };
  }

  if (stage === "Sprout") {
    const sway = o.reduced ? 0 : Math.round(Math.sin(t / 10)) ;
    const shoot = sway > 0 ? ["      __  ", "     /_/  ", "      |   "] : sway < 0 ? ["    __    ", "    \\_\\   ", "      |   "] : ["     __   ", "    /_/   ", "      |   "];
    const curled = face === "wilting" ? ["          ", "     @|   ", "      |   "] : face === "tired" ? ["          ", "     \\_\\  ", "      |   "] : shoot;
    curled.forEach((r, i) => overlay(rows, 3, i, r));
  }

  if (stage === "Elder") {
    // Cracks in the old skin and a flower on top.
    overlay(rows, 4, 4, "\\");
    overlay(rows, 5, 5, "\\");
    overlay(rows, 16, 3, "/");
    overlay(rows, 15, 4, "/");
    const flower = face === "wilting" ? ["          ", "     \\@   "] : t % 60 < 30 ? ["     _@_  ", "      |   "] : ["     _@_  ", "      |   "];
    flower.forEach((r, i) => overlay(rows, 6, i, r));
  }

  // Eyes with clear space around them so they read on a shaded body.
  const eyeTxt = face === "asleep" ? " -- " : ` ${eye} `;
  const lx = Math.round(b.cx - b.eyeDx) - 2;
  const rx = Math.round(b.cx + b.eyeDx) - 1;
  overlay(rows, lx, eyeY, eyeTxt);
  overlay(rows, rx, eyeY, eyeTxt);
  if (stage !== "Sprout") {
    overlay(rows, lx + 1, eyeY - 1, face === "tired" ? "_" : " ");
    overlay(rows, rx + 1, eyeY - 1, face === "tired" ? "_" : " ");
  }
  overlay(rows, Math.round(b.cx) - 2, eyeY + b.mouthDy + 1, mouth);

  const lean = face === "affectionate" ? (t % 72 < 36 ? 1 : 0) : 0;
  return { rows, lean, eyeRow: eyeY };
}

/** Gravestone, 12 wide, with the stage on its face and a shadow side. */
export function gravestone(stage: Stage, inkLight: boolean, withFlower: boolean): string[] {
  const sh = inkLight ? ":" : "#";
  const inner = stage.length >= 7 ? stage.slice(0, 7) : stage.padStart(Math.floor((7 + stage.length) / 2)).padEnd(7);
  const rows = ["   _____    ", "  /     \\   ", " |  RIP  |" + sh + " ", ` |${inner}|${sh} `, " |       |" + sh + " ", "_|_______|" + sh + "_"];
  if (withFlower) {
    rows[3] = rows[3].slice(0, 11) + "@";
    rows[4] = rows[4].slice(0, 11) + "|";
  }
  return rows;
}

/** A sand mound with Truffle curled under it, for heat days. Shaded like the dunes. */
export function mound(light: Vec3, inkLight: boolean, peek: boolean): string[] {
  const rows = shadeDomes(14, 4, [{ cx: 7, cy: 4.2, rx: 7, ry: 2.8, z: 0.8 }], {
    light,
    inkLight,
    ambient: 0.3,
    bump: 0.04,
    seed: 11,
    ramp: " .:-=+*",
    outline: true,
    range: [0.1, 0.9]
  });
  overlay(rows, 4, 2, peek ? "(o.o)" : "(-.-)");
  return rows;
}
