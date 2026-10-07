// Hand-drawn ASCII Truffle, per stage and mood. Base art from fleet/outbox/S08.
// Templates use E for an eye and MMMM for the mouth. Every row of a sprite has
// the same width; spaces inside the rectangle are opaque (rain and grass stay out).

import type { Stage } from "../../worker/src/config";
import type { Mood } from "../../worker/src/engine";

export type Face = Mood | "yawn";

export interface Sprite {
  rows: string[];
  /** Columns to nudge right (affection leans in). */
  lean: number;
}

const pad = (rows: string[]): string[] => {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(w, " "));
};

const TRUFFLE = [
  "     .----.     ",
  "   .' .  . '.   ",
  "  /          \\  ",
  " |   E    E   | ",
  " |    MMMM    | ",
  "  \\          /  ",
  "   '--------'   "
];

const TRUFFLE_ASLEEP = [
  "                ",
  "                ",
  "    .------.    ",
  "  .'        '.  ",
  " /   -    -   \\ ",
  "|      .       |",
  " '------------' "
];

const TRUFFLE_AFFECTIONATE = [
  "    .----.      ",
  "  .' .  . '.    ",
  " /          \\ / ",
  "|   ^    ^   |  ",
  "|  . \\__/ .  |  ",
  " \\          /   ",
  "  '--------'    "
];

const ELDER = [
  "         _@_         ",
  "          |          ",
  "     .----'-----.    ",
  "   .'  /    \\    '.  ",
  "  /   /      \\     \\ ",
  " |    E  |  E       |",
  " |  .    MMMM    .  |",
  "  \\   \\        /   / ",
  "   '--------------'  "
];

const SPROUT = [
  "       __       ",
  "      /_/       ",
  "       |        ",
  "    .--'--.     ",
  "___/ E   E \\____"
];

const SPORE = [
  " .   .     .   .",
  "________________",
  "       E        ",
  "  .         .   ",
  "     .   .      "
];

interface FaceParts {
  eye: string;
  mouth: string;
}

const FACES: Record<Face, FaceParts> = {
  content: { eye: "o", mouth: "\\__/" },
  affectionate: { eye: "^", mouth: "\\__/" },
  asleep: { eye: "-", mouth: " .. " },
  tired: { eye: "o", mouth: " -- " },
  wilting: { eye: ".", mouth: " ~~ " },
  burrowed: { eye: "-", mouth: " .. " },
  dead: { eye: "-", mouth: "    " },
  yawn: { eye: "-", mouth: "(  )" }
};

const fill = (rows: string[], f: FaceParts) => rows.map((r) => r.replace(/E/g, f.eye).replace("MMMM", f.mouth));

const set = (rows: string[], i: number, row: string) => rows.map((r, j) => (j === i ? row.padEnd(r.length, " ").slice(0, r.length) : r));

/** Sprite for a stage and face. Burrowed and dead are drawn by the scene, not here. */
export function spriteFor(stage: Stage, face: Face, frame: number): Sprite {
  const f = FACES[face];
  const yawnOpen = face === "yawn" && frame % 12 < 6;
  const parts = face === "yawn" ? { eye: "-", mouth: yawnOpen ? "(  )" : " () " } : f;
  switch (stage) {
    case "Spore": {
      const dot = face === "asleep" || face === "yawn" ? "o" : face === "wilting" ? "." : "o";
      return { rows: SPORE.map((r) => r.replace("E", dot)), lean: 0 };
    }
    case "Sprout": {
      let rows = fill(SPROUT, parts);
      // Wilting: the leaf curls down onto the stem.
      if (face === "wilting") rows = set(set(rows, 0, ""), 1, "      @|");
      if (face === "tired") rows = set(rows, 1, "      \\_\\");
      return { rows, lean: face === "affectionate" ? 1 : 0 };
    }
    case "Elder": {
      let rows = fill(ELDER, parts);
      if (face === "wilting") rows = set(set(rows, 0, ""), 1, "          |@");
      return { rows: pad(rows), lean: face === "affectionate" ? 1 : 0 };
    }
    default: {
      if (face === "asleep") return { rows: TRUFFLE_ASLEEP, lean: 0 };
      if (face === "affectionate") return { rows: TRUFFLE_AFFECTIONATE, lean: 1 };
      let rows = fill(TRUFFLE, parts);
      // Tired: heavy lids. Wilting: a curled leaf on the cap.
      if (face === "tired") rows = set(rows, 2, "  /  _    _  \\  ");
      if (face === "wilting") rows = set(rows, 0, "     .----._@   ");
      return { rows, lean: 0 };
    }
  }
}

/** Gravestone, 11 wide, with the stage on its face. Age and steps are engraved below by the scene. */
export function gravestone(stage: Stage): string[] {
  const inner = stage.length >= 7 ? stage.slice(0, 7) : stage.padStart(Math.floor((7 + stage.length) / 2)).padEnd(7);
  return ["   _____   ", "  /     \\  ", " |  RIP  | ", ` |${inner}| `, " |       | ", "_|_______|_"];
}

/** A small mound with Truffle curled up under it, for heat days. */
export const MOUND = ["  _.-^^-._  ", "            ", "   (-.-)    "];
