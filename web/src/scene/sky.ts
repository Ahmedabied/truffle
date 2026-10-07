// Local time in the Truffle's timezone, and the palette for that hour and mood.

import type { Mood } from "../../../worker/src/engine";

export type Band = "night" | "dawn" | "day" | "dusk";

const fmtCache = new Map<string, Intl.DateTimeFormat>();

/** Fractional local hour (0..24) in an IANA zone. Falls back to the device clock. */
export function localHour(tz: string, now = new Date()): number {
  try {
    let f = fmtCache.get(tz);
    if (!f) {
      f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hourCycle: "h23" });
      fmtCache.set(tz, f);
    }
    const parts = f.formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? now.getHours());
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return (h % 24) + m / 60;
  } catch {
    return now.getHours() + now.getMinutes() / 60;
  }
}

export function bandOf(hour: number): Band {
  if (hour < 5 || hour >= 20) return "night";
  if (hour < 7.5) return "dawn";
  if (hour < 17) return "day";
  return "dusk";
}

export interface Palette {
  sky: string;
  ink: string;
  ground: string;
  /** CSS filter for the whole grid (wilting greys the world). */
  filter: string;
}

const BASE: Record<Band, { sky: string; ink: string; sand: string; grass: string }> = {
  night: { sky: "#172c3b", ink: "#e8eddb", sand: "#2f3a33", grass: "#243b31" },
  dawn: { sky: "#eed7bd", ink: "#393d32", sand: "#e2cc9e", grass: "#c3cea3" },
  day: { sky: "#dceddf", ink: "#243f37", sand: "#dcd3a7", grass: "#b6cca0" },
  dusk: { sky: "#e6b695", ink: "#3d342e", sand: "#cdb78c", grass: "#b7be92" }
};

export function paletteFor(band: Band, mood: Mood, sand: boolean, rain: boolean): Palette {
  const b = BASE[band];
  let sky = b.sky;
  if (rain && band !== "night") sky = band === "day" ? "#c3cfd2" : "#b9b5b0";
  if (mood === "burrowed" && band !== "night") sky = band === "day" ? "#f4d7a6" : "#eab98c";
  if (mood === "dead") sky = band === "night" ? "#1b2530" : "#cfd0c8";
  const filter =
    mood === "wilting" ? "grayscale(0.75)" : mood === "tired" ? "grayscale(0.3)" : mood === "dead" ? "grayscale(0.4)" : "none";
  return { sky, ink: b.ink, ground: sand ? b.sand : b.grass, filter };
}
