// Colours for the layered world, continuous over the day. Keyframes sit on a
// canonical clock where sunrise is 6 and sunset is 18, so the same colours
// fit a short winter day and a long summer one.

import type { Mood } from "../../../worker/src/engine";

export interface Palette {
  skyTop: string;
  skyHorizon: string;
  groundTop: string;
  groundBottom: string;
  stars: string;
  sun: string;
  cloudFar: string;
  cloudNear: string;
  weather: string;
  ground: string;
  pet: string;
  fx: string;
  hud: string;
  /** Sun glow and horizon haze ink. */
  glow: string;
  /** The Truffle's cap highlight ink (rust). */
  cap: string;
  /** The Truffle's skin ink (warm tan). */
  skin: string;
  /** Eye whites, spots and petals. */
  white: string;
}

type Rgb = [number, number, number];

const hex = (c: string): Rgb => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const toHex = (c: Rgb) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const lerp = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mix = (a: string, b: string, t: number) => toHex(lerp(hex(a), hex(b), Math.max(0, Math.min(1, t))));

interface Key {
  h: number;
  skyTop: string;
  skyHorizon: string;
  sand: [string, string];
  grass: [string, string];
  stars: string;
  sun: string;
  cloudFar: string;
  cloudNear: string;
  weather: string;
  groundSand: string;
  groundGrass: string;
  pet: string;
  fx: string;
  hud: string;
}

// Night, late night, pre-dawn, sunrise, morning, noon, afternoon, sunset, dusk, night.
const KEYS: Key[] = [
  { h: 0, skyTop: "#070d18", skyHorizon: "#14233a", sand: ["#2b2f2c", "#1c1f1c"], grass: ["#1d2e22", "#141f18"], stars: "#dfe6f2", sun: "#efe9d0", cloudFar: "#2a3a4e", cloudNear: "#425468", weather: "#8fa1b8", groundSand: "#7b7f70", groundGrass: "#5f7d62", pet: "#e9ecdf", fx: "#f4c56a", hud: "#c3cbbf" },
  { h: 4.3, skyTop: "#0b1424", skyHorizon: "#2a3550", sand: ["#2f322d", "#1f221e"], grass: ["#20311f", "#172218"], stars: "#d6dde9", sun: "#efe9d0", cloudFar: "#34445a", cloudNear: "#4d5f74", weather: "#92a3b8", groundSand: "#85887a", groundGrass: "#66836a", pet: "#e6e9dc", fx: "#f4c56a", hud: "#c3cbbf" },
  { h: 5.4, skyTop: "#3a4670", skyHorizon: "#d78a6c", sand: ["#7d6c57", "#4a4238"], grass: ["#4d6446", "#2e3e2d"], stars: "#c9cfdd", sun: "#ff9b57", cloudFar: "#8b6f84", cloudNear: "#dca8a2", weather: "#b8b5c1", groundSand: "#c9b48c", groundGrass: "#8fae82", pet: "#f3eadb", fx: "#ffb36b", hud: "#eadfc9" },
  { h: 6, skyTop: "#7a8bb5", skyHorizon: "#f5b98a", sand: ["#c8ae7f", "#9d8a67"], grass: ["#8ea36f", "#6d8656"], stars: "#aab4c6", sun: "#ff8c42", cloudFar: "#d9b8c0", cloudNear: "#fbe3d4", weather: "#c5c7cf", groundSand: "#846f45", groundGrass: "#4c6a3f", pet: "#3a3328", fx: "#d4553a", hud: "#3a3328" },
  { h: 7.5, skyTop: "#9fc4e4", skyHorizon: "#e9e0cf", sand: ["#e1d2a5", "#cdbd8a"], grass: ["#a4c48e", "#86a874"], stars: "#aab4c6", sun: "#f7b33a", cloudFar: "#dbe6ee", cloudNear: "#ffffff", weather: "#aab7c2", groundSand: "#8b7a4f", groundGrass: "#4b6b3e", pet: "#2f3a31", fx: "#c6553b", hud: "#2f3a31" },
  { h: 12, skyTop: "#86bce6", skyHorizon: "#d8eaf3", sand: ["#e8dcad", "#d6c791"], grass: ["#a2c88c", "#80a86e"], stars: "#aab4c6", sun: "#ffc53d", cloudFar: "#dde9f0", cloudNear: "#ffffff", weather: "#9fb0bd", groundSand: "#8d7c50", groundGrass: "#4a6b3c", pet: "#2e3a31", fx: "#c6553b", hud: "#2e3a31" },
  { h: 16.5, skyTop: "#8fb6dc", skyHorizon: "#ead9bd", sand: ["#e2d2a2", "#cfbd86"], grass: ["#9fbf86", "#7fa26b"], stars: "#aab4c6", sun: "#ffb13a", cloudFar: "#e3dcd9", cloudNear: "#fff6ea", weather: "#a6b1bb", groundSand: "#88764b", groundGrass: "#49683b", pet: "#323a2f", fx: "#c6553b", hud: "#323a2f" },
  { h: 18, skyTop: "#5c5b8f", skyHorizon: "#f1865a", sand: ["#c6a877", "#8e7a57"], grass: ["#879d66", "#5f7a4e"], stars: "#bcc3d2", sun: "#ff6f3a", cloudFar: "#b58896", cloudNear: "#f7c0a2", weather: "#b3aab5", groundSand: "#6e5a3b", groundGrass: "#3f5a36", pet: "#3b3028", fx: "#e0613f", hud: "#3b3028" },
  { h: 19.2, skyTop: "#232c54", skyHorizon: "#8f5c6a", sand: ["#5a5244", "#3a352e"], grass: ["#3a4e3a", "#263326"], stars: "#d2d8e4", sun: "#f0d9b0", cloudFar: "#4a4a6a", cloudNear: "#7a6a84", weather: "#9d9fb0", groundSand: "#a89b7e", groundGrass: "#789a76", pet: "#e3e4d6", fx: "#f4c56a", hud: "#d3d6c8" },
  { h: 21, skyTop: "#0a1222", skyHorizon: "#1a2a44", sand: ["#2e322e", "#1e211d"], grass: ["#1f3124", "#162119"], stars: "#dfe6f2", sun: "#efe9d0", cloudFar: "#2d3d51", cloudNear: "#46586c", weather: "#8fa1b8", groundSand: "#7f8373", groundGrass: "#628066", pet: "#e9ecdf", fx: "#f4c56a", hud: "#c3cbbf" },
  { h: 24, skyTop: "#070d18", skyHorizon: "#14233a", sand: ["#2b2f2c", "#1c1f1c"], grass: ["#1d2e22", "#141f18"], stars: "#dfe6f2", sun: "#efe9d0", cloudFar: "#2a3a4e", cloudNear: "#425468", weather: "#8fa1b8", groundSand: "#7b7f70", groundGrass: "#5f7d62", pet: "#e9ecdf", fx: "#f4c56a", hud: "#c3cbbf" }
];

/** Map a real local hour onto the canonical clock (sunrise 6, sunset 18). */
export function canonicalHour(hour: number, rise: number, set: number): number {
  if (hour >= rise && hour <= set) return 6 + ((hour - rise) / (set - rise)) * 12;
  const night = 24 - (set - rise);
  const since = hour > set ? hour - set : hour + 24 - set;
  return (18 + (since / night) * 12) % 24;
}

export interface Conditions {
  /** 0 clear .. 1 overcast */
  cloud: number;
  rain: boolean;
  fog: boolean;
  snow: boolean;
  hot: boolean;
  sand: boolean;
  mood: Mood;
}

export function paletteAt(canonical: number, c: Conditions): Palette {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= canonical) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = Math.max(0, Math.min(1, (canonical - a.h) / (b.h - a.h)));
  const L = (k: keyof Omit<Key, "h" | "sand" | "grass">) => mix(a[k], b[k], t);
  const ground = c.sand ? [mix(a.sand[0], b.sand[0], t), mix(a.sand[1], b.sand[1], t)] : [mix(a.grass[0], b.grass[0], t), mix(a.grass[1], b.grass[1], t)];

  let skyTop = L("skyTop");
  let skyHorizon = L("skyHorizon");
  let cloudFar = L("cloudFar");
  let cloudNear = L("cloudNear");
  let sun = L("sun");
  let groundTop = ground[0];
  let groundBottom = ground[1];
  const night = canonical < 5.4 || canonical > 19.2;

  // Overcast: the sky flattens toward grey and loses its gradient.
  const grey = night ? "#1a2129" : "#9aa5ad";
  if (c.cloud > 0) {
    skyTop = mix(skyTop, grey, c.cloud * 0.7);
    skyHorizon = mix(skyHorizon, grey, c.cloud * 0.55);
    sun = mix(sun, grey, c.cloud * 0.6);
    groundTop = mix(groundTop, grey, c.cloud * 0.25);
    groundBottom = mix(groundBottom, grey, c.cloud * 0.25);
  }
  if (c.rain) {
    const wet = night ? "#101820" : "#6f7d8a";
    skyTop = mix(skyTop, wet, 0.5);
    skyHorizon = mix(skyHorizon, wet, 0.45);
    groundTop = mix(groundTop, wet, 0.3);
    groundBottom = mix(groundBottom, wet, 0.35);
    cloudFar = mix(cloudFar, wet, 0.4);
    cloudNear = mix(cloudNear, "#c2ccd4", 0.4);
  }
  if (c.fog) {
    const haze = night ? "#3b434c" : "#d9dde0";
    skyTop = mix(skyTop, haze, 0.55);
    skyHorizon = mix(skyHorizon, haze, 0.7);
    groundTop = mix(groundTop, haze, 0.4);
  }
  if (c.hot && !night) {
    skyTop = mix(skyTop, "#f0c27a", 0.28);
    skyHorizon = mix(skyHorizon, "#f7d9a1", 0.4);
    groundTop = mix(groundTop, "#f1d9a2", 0.3);
    sun = mix(sun, "#ffffff", 0.35);
  }
  if (c.mood === "dead") {
    skyTop = mix(skyTop, "#6b6f72", 0.35);
    skyHorizon = mix(skyHorizon, "#8a8d8f", 0.35);
    groundTop = mix(groundTop, "#7d7f78", 0.3);
    groundBottom = mix(groundBottom, "#5f615c", 0.3);
  }
  // The creature's own inks: rust cap and cream skin by day, both sinking toward moonlight at night.
  const dark = night ? 1 : canonical < 7 ? 1 - (canonical - 5.4) / 1.6 : canonical > 17.5 ? (canonical - 17.5) / 1.7 : 0;
  const cap = mix("#c4552c", "#8c6a62", Math.max(0, Math.min(1, dark)));
  const skin = mix("#b07a4c", "#b9b4a6", Math.max(0, Math.min(1, dark)) * 0.85);
  const white = mix("#fff6e6", "#d9dcd6", Math.max(0, Math.min(1, dark)) * 0.6);
  const glow = mix(sun, skyHorizon, 0.35);
  return {
    skyTop,
    skyHorizon,
    groundTop,
    groundBottom,
    stars: L("stars"),
    sun,
    cloudFar,
    cloudNear,
    weather: L("weather"),
    ground: c.sand ? L("groundSand") : L("groundGrass"),
    pet: L("pet"),
    fx: L("fx"),
    hud: L("hud"),
    glow,
    cap: c.mood === "dead" ? mix(cap, "#777777", 0.6) : cap,
    skin: c.mood === "dead" ? mix(skin, "#8a8a86", 0.7) : skin,
    white
  };
}
