import { describe, expect, it } from "vitest";
import { buildForecastUrl, daytimeMax, forecastDays, parseForecast, sanitizeText, skyWord, weatherText } from "../src/weather";

// Real Open-Meteo response for Muscat, recorded 2026-10-07 23:45 local (see README).
import fixtureJson from "./fixtures/open-meteo-muscat.json";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fixture: any = fixtureJson;

describe("buildForecastUrl", () => {
  it("asks for the documented fields", () => {
    const u = new URL(buildForecastUrl(23.588, 58.3829));
    expect(u.origin + u.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(u.searchParams.get("latitude")).toBe("23.5880");
    expect(u.searchParams.get("hourly")).toBe("apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day");
    expect(u.searchParams.get("current")).toBe("apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day");
    expect(u.searchParams.get("timezone")).toBe("auto");
    expect(u.searchParams.get("forecast_days")).toBe("2");
  });
});

describe("parseForecast on the recorded Muscat fixture", () => {
  const p = parseForecast(fixture, "2026-10-07");
  it("reads current conditions", () => {
    expect(p.current_apparent_c).toBe(33.1);
    expect(p.precipitation_mm).toBe(0);
    expect(p.wind_kmh).toBe(3.8);
    expect(p.is_day).toBe(false);
    expect(p.weather_code).toBe(0);
    expect(p.timezone).toBe("Asia/Muscat");
  });
  it("daytime max is 06:00-22:00 inclusive", () => {
    expect(p.daytime_max_c).toBe(43.9);
    // brute-force check against the raw hours
    const h = fixture.hourly;
    const vals = h.time
      .map((t: string, i: number) => [t, h.apparent_temperature[i]] as const)
      .filter(([t]: readonly [string, number]) => t.startsWith("2026-10-07T") && +t.slice(11, 13) >= 6 && +t.slice(11, 13) <= 22)
      .map(([, v]: readonly [string, number]) => v);
    expect(vals).toHaveLength(17);
    expect(Math.max(...vals)).toBe(p.daytime_max_c);
  });
  it("has both forecast days", () => {
    expect(forecastDays(fixture)).toEqual(["2026-10-07", "2026-10-08"]);
    expect(daytimeMax(fixture, "2026-10-08")).toBeTypeOf("number");
    expect(daytimeMax(fixture, "2026-10-09")).toBeNull();
  });
  it("text for the state block", () => {
    expect(weatherText(p, "Muscat")).toBe("33C clear, Muscat");
  });
});

describe("edges", () => {
  it("ignores night hours", () => {
    const j = {
      hourly: {
        time: ["2026-07-01T05:00", "2026-07-01T06:00", "2026-07-01T22:00", "2026-07-01T23:00"],
        apparent_temperature: [50, 30, 31, 55]
      }
    };
    expect(daytimeMax(j, "2026-07-01")).toBe(31);
  });
  it("survives garbage", () => {
    const p = parseForecast({ nope: 1 }, "2026-07-01");
    expect(p.daytime_max_c).toBeNull();
    expect(p.current_apparent_c).toBeNull();
    expect(weatherText(p, "Muscat")).toBe("unknown, Muscat");
    expect(parseForecast(null, "2026-07-01").daytime_max_c).toBeNull();
  });
  it("maps WMO codes", () => {
    expect([0, 2, 45, 53, 63, 81, 73, 95].map(skyWord)).toEqual(["clear", "cloudy", "fog", "drizzle", "rain", "rain", "snow", "storm"]);
  });
  it("sanitizes city names", () => {
    expect(sanitizeText('Mus"cat]\n[evil="1"', 40)).toBe("Muscat evil=1");
    expect(sanitizeText("x".repeat(100), 10)).toHaveLength(10);
    expect(weatherText({ ...parseForecast(fixture, "2026-10-07") }, "A\"B]")).toBe("33C clear, AB");
  });
});
