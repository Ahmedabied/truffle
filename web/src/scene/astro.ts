// Sun, moon and stars. Time only, no network. Sunrise and sunset are
// approximated for a mid-latitude place by month (Muscat is the default
// person), which is enough to put the sun on the horizon at the right hour.

const mod = (n: number, d: number) => ((n % d) + d) % d;

/** Day of year, 1..366, from a Date in the device clock (close enough for season). */
function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86400000) + 1;
}

/** Approximate sunrise and sunset local hours for a latitude (default Muscat, 23.6N). */
export function sunTimes(now = new Date(), latDeg = 23.6): { rise: number; set: number } {
  const n = dayOfYear(now);
  const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (n - 81)) * (Math.PI / 180);
  const lat = latDeg * (Math.PI / 180);
  const cosH = -Math.tan(lat) * Math.tan(decl);
  const h = Math.acos(Math.max(-1, Math.min(1, cosH))) * (12 / Math.PI); // half day length in hours
  // Mean solar noon at 12:00 local; good enough without longitude and the equation of time.
  return { rise: 12 - h, set: 12 + h };
}

/** Sun elevation proxy in [-1, 1]: 1 at local noon, 0 at the horizon, negative at night. */
export function sunHeight(hour: number, rise: number, set: number): number {
  const day = set - rise;
  if (hour >= rise && hour <= set) return Math.sin(((hour - rise) / day) * Math.PI);
  const night = 24 - day;
  const since = mod(hour - set, 24);
  return -Math.sin((since / night) * Math.PI);
}

/** Where the sun or moon sits on a 40 x 28 grid for a progress p in [0, 1] along its arc. */
export function arc(p: number, cols = 40, top = 1, horizon = 15): { x: number; y: number } {
  const x = Math.round(3 + p * (cols - 10));
  const y = Math.round(horizon - Math.sin(p * Math.PI) * (horizon - top));
  return { x, y };
}

/** Moon phase in [0, 1): 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
export function moonPhase(now = new Date()): number {
  const synodic = 29.530588853;
  const known = Date.UTC(2000, 0, 6, 18, 14); // a new moon
  const days = (now.getTime() - known) / 86400000;
  return mod(days / synodic, 1);
}

export interface Star {
  x: number;
  y: number;
  bright: boolean;
  phase: number;
  rank: number;
}

/** Fixed star field, hashed so it never changes between frames. */
export function starField(cols = 40, rows = 13, count = 44): Star[] {
  const out: Star[] = [];
  let s = 1234567;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < count; i++) {
    out.push({ x: Math.floor(rnd() * cols), y: Math.floor(rnd() * rows), bright: rnd() < 0.3, phase: Math.floor(rnd() * 12), rank: i });
  }
  return out;
}
