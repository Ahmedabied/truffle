// Open-Meteo forecast: URL, a pure parser, and the short text the model sees.
// No API key. timezone=auto makes hourly times local to the coordinates.

export const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
const VARS = "apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day";

/** Daytime window for the burrow decision, local hours, inclusive. */
export const DAYTIME_FIRST_HOUR = 6;
export const DAYTIME_LAST_HOUR = 22;

export function buildForecastUrl(lat: number, lon: number): string {
  const la = lat.toFixed(4);
  const lo = lon.toFixed(4);
  return `${OPEN_METEO}?latitude=${la}&longitude=${lo}&hourly=${VARS}&current=${VARS}&timezone=auto&forecast_days=2`;
}

export interface ParsedForecast {
  /** Local day the daytime max is for, "YYYY-MM-DD". */
  day: string;
  /** Max apparent temperature 06:00-22:00 local, or null if the day is not in the data. */
  daytime_max_c: number | null;
  current_apparent_c: number | null;
  precipitation_mm: number;
  wind_kmh: number;
  is_day: boolean;
  weather_code: number;
  /** Zone Open-Meteo resolved for the coordinates. */
  timezone: string | null;
}

interface OpenMeteoJson {
  timezone?: string;
  current?: Record<string, unknown>;
  hourly?: { time?: unknown; apparent_temperature?: unknown };
}

const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Daytime max apparent temperature for a local day, from hourly data. */
export function daytimeMax(json: unknown, dayIso: string): number | null {
  const h = (json as OpenMeteoJson)?.hourly;
  const times = Array.isArray(h?.time) ? (h!.time as unknown[]) : [];
  const temps = Array.isArray(h?.apparent_temperature) ? (h!.apparent_temperature as unknown[]) : [];
  let max: number | null = null;
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    const v = temps[i];
    if (typeof t !== "string" || !t.startsWith(dayIso + "T")) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const hour = Number(t.slice(11, 13));
    if (hour < DAYTIME_FIRST_HOUR || hour > DAYTIME_LAST_HOUR) continue;
    if (max === null || v > max) max = v;
  }
  return max;
}

/** Every local day present in the hourly data, "YYYY-MM-DD". */
export function forecastDays(json: unknown): string[] {
  const times = (json as OpenMeteoJson)?.hourly?.time;
  if (!Array.isArray(times)) return [];
  const days = new Set<string>();
  for (const t of times) if (typeof t === "string" && t.length >= 10) days.add(t.slice(0, 10));
  return [...days];
}

export function parseForecast(json: unknown, dayIso: string): ParsedForecast {
  const j = json as OpenMeteoJson;
  const c = j?.current ?? {};
  const apparent = c.apparent_temperature;
  return {
    day: dayIso,
    daytime_max_c: daytimeMax(json, dayIso),
    current_apparent_c: typeof apparent === "number" && Number.isFinite(apparent) ? apparent : null,
    precipitation_mm: num(c.precipitation, 0),
    wind_kmh: num(c.wind_speed_10m, 0),
    is_day: num(c.is_day, 1) === 1,
    weather_code: num(c.weather_code, 0),
    timezone: typeof j?.timezone === "string" ? j.timezone : null
  };
}

export type Sky = "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

/** WMO weather code to one plain word. */
export function skyWord(code: number): Sky {
  if (code <= 1) return "clear";
  if (code <= 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

/** Fixed condition words per WMO code group. The only words the state block may use. */
export const SKY_WORDS: Record<"en" | "ar", Record<Sky, string>> = {
  en: { clear: "clear", cloudy: "cloudy", fog: "fog", drizzle: "drizzle", rain: "rain", snow: "snow", storm: "storm" },
  ar: { clear: "صافي", cloudy: "غائم", fog: "ضباب", drizzle: "رذاذ", rain: "مطر", snow: "ثلج", storm: "عاصفة" }
};

/** Every WMO code Open-Meteo documents. Anything else is not a weather code. */
const WMO_CODES = new Set([0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]);

/** Plausible apparent temperatures on Earth, in C. */
const MIN_APPARENT_C = -90;
const MAX_APPARENT_C = 70;

/**
 * A city name the state block may carry: letters (any script), marks, spaces,
 * dots and hyphens, at most 32 characters. Anything else gives "" and the
 * city is left out. It is never cleaned up and kept.
 */
export function safeCity(city: unknown): string {
  if (typeof city !== "string") return "";
  const c = city.trim();
  return /^[\p{L}\p{M}][\p{L}\p{M} .-]{0,31}$/u.test(c) && [...c].length <= 32 ? c : "";
}

/**
 * The state block weather field (S10-10). Built only from a validated
 * temperature, a known WMO code mapped to a fixed word, and a safe city.
 * Anything else is "unavailable".
 */
export function stateWeather(parsed: ParsedForecast | null, city: string, lang: "ar" | "en"): string {
  const t = parsed?.current_apparent_c;
  const code = parsed?.weather_code;
  if (typeof t !== "number" || !Number.isFinite(t) || t < MIN_APPARENT_C || t > MAX_APPARENT_C) return "unavailable";
  if (typeof code !== "number" || !WMO_CODES.has(code)) return "unavailable";
  const text = `${Math.round(t)}C ${SKY_WORDS[lang][skyWord(code)]}`;
  const place = safeCity(city);
  return place ? `${text}, ${place}` : text;
}

/** Strip anything that could break the state block, and cap length. */
export function sanitizeText(s: unknown, max = 40): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/["'`\[\]{}<>\\]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

/** "34C clear, Muscat". Display helper only: the state block uses stateWeather. */
export function weatherText(parsed: ParsedForecast | null, city: string): string {
  const place = sanitizeText(city, 32);
  if (!parsed || parsed.current_apparent_c === null) return place ? `unknown, ${place}` : "unknown";
  const t = `${Math.round(parsed.current_apparent_c)}C ${skyWord(parsed.weather_code)}`;
  return sanitizeText(place ? `${t}, ${place}` : t, 60);
}

/** Fetch and return the raw JSON, or null on any failure (timeout 5s). */
export async function fetchForecast(
  lat: number,
  lon: number,
  fetchFn: typeof fetch = fetch
): Promise<unknown | null> {
  try {
    const res = await fetchFn(buildForecastUrl(lat, lon), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
