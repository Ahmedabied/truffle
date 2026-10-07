const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const WEATHER_FIELDS =
  "apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day";

export const BURROW_APPARENT_C = 42;

export type WeatherSummary =
  | "clear"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "storm"
  | "unknown";

export interface ParsedForecast {
  daytimeMaxApparentC: number | null;
  currentApparentC: number | null;
  /** Millimetres over current.interval, not a probability or hourly rate. */
  precipitationNow: number | null;
  /** Kilometres per hour, using Open-Meteo's default units. */
  windNow: number | null;
  isDay: boolean | null;
  weatherCode: number | null;
  timezone: string | null;
  /** Short condition label from current.weather_code. */
  summary: WeatherSummary;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validDayIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]!;
}

function localSlot(value: unknown): { day: string; seconds: number } | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
  if (!match || !validDayIso(match[1]!)) return null;
  return {
    day: match[1]!,
    seconds: Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4] ?? 0),
  };
}

function summarize(code: number | null): WeatherSummary {
  switch (code) {
    case 0:
    case 1:
      return "clear";
    case 2:
    case 3:
      return "cloudy";
    case 45:
    case 48:
      return "fog";
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return "drizzle";
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
    case 80:
    case 81:
    case 82:
      return "rain";
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return "snow";
    case 95:
    case 96:
    case 97:
    case 99:
      return "storm";
    default:
      return "unknown";
  }
}

/**
 * Parse a default-unit, ISO8601 forecast returned with timezone=auto.
 * Timestamps are already local. Never parse them as UTC or host-local Dates.
 * Missing or non-finite measurements stay null. No caching or fetch occurs here.
 */
export function parseForecast(
  json: unknown,
  opts: { dayIso?: string } = {},
): ParsedForecast {
  if (opts.dayIso !== undefined && !validDayIso(opts.dayIso)) {
    throw new RangeError("dayIso must be a valid local date in YYYY-MM-DD form");
  }

  const data = record(json);
  const current = record(data.current);
  const hourly = record(data.hourly);
  const dayIso = opts.dayIso ?? localSlot(current.time)?.day;
  const times: unknown[] = Array.isArray(hourly.time) ? hourly.time : [];
  const temperatures: unknown[] = Array.isArray(hourly.apparent_temperature)
    ? hourly.apparent_temperature
    : [];
  let daytimeMaxApparentC: number | null = null;

  for (let index = 0; index < times.length; index += 1) {
    const slot = localSlot(times[index]);
    const temperature = finiteNumber(temperatures[index]);
    if (
      !slot ||
      slot.day !== dayIso ||
      slot.seconds < 6 * 3600 ||
      slot.seconds > 22 * 3600 ||
      temperature === null
    ) {
      continue;
    }
    daytimeMaxApparentC = daytimeMaxApparentC === null
      ? temperature
      : Math.max(daytimeMaxApparentC, temperature);
  }

  const rawCode = finiteNumber(current.weather_code);
  const weatherCode = rawCode !== null && Number.isInteger(rawCode) ? rawCode : null;
  return {
    daytimeMaxApparentC,
    currentApparentC: finiteNumber(current.apparent_temperature),
    precipitationNow: finiteNumber(current.precipitation),
    windNow: finiteNumber(current.wind_speed_10m),
    isDay: current.is_day === 1 ? true : current.is_day === 0 ? false : null,
    weatherCode,
    timezone: typeof data.timezone === "string" && data.timezone.length > 0
      ? data.timezone
      : null,
    summary: summarize(weatherCode),
  };
}

export function shouldBurrow(
  daytimeMaxApparentC: number | null,
  threshold = BURROW_APPARENT_C,
): boolean {
  return daytimeMaxApparentC !== null
    && Number.isFinite(daytimeMaxApparentC)
    && Number.isFinite(threshold)
    && daytimeMaxApparentC >= threshold;
}

/** Current apparent temperature, never the selected day's maximum. */
export function weatherText(parsed: ParsedForecast, city: string): string {
  const temperature = parsed.currentApparentC === null
    ? "?"
    : String(Math.round(parsed.currentApparentC));
  return `${temperature}C ${parsed.summary}, ${city}`;
}

export function buildForecastUrl(lat: number, lon: number): string {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new RangeError("Latitude must be finite and between -90 and 90");
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new RangeError("Longitude must be finite and between -180 and 180");
  }
  return `${FORECAST_ENDPOINT}?latitude=${lat}&longitude=${lon}`
    + `&hourly=${WEATHER_FIELDS}&current=${WEATHER_FIELDS}`
    + "&timezone=auto&forecast_days=2";
}

/** Optional transport adapter. The caller owns caching and outage fallback. */
export async function fetchForecast(lat: number, lon: number): Promise<ParsedForecast> {
  const response = await fetch(buildForecastUrl(lat, lon));
  if (!response.ok) {
    throw new Error(`Open-Meteo forecast failed: HTTP ${response.status}`);
  }
  return parseForecast(await response.json());
}
