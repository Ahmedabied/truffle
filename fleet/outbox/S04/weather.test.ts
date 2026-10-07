import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildForecastUrl,
  fetchForecast,
  parseForecast,
  shouldBurrow,
  weatherText,
} from "./weather.ts";
import type { ParsedForecast, WeatherSummary } from "./weather.ts";

function fixture(city: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${city}.json`, import.meta.url), "utf8"));
}

const cases = [
  {
    file: "muscat", city: "Muscat", day: "2026-10-07", tomorrow: "2026-10-08",
    max: 43.9, nextMax: 40.6, current: 33.5, wind: 2.8,
    code: 0, isDay: false, timezone: "Asia/Muscat", text: "34C clear, Muscat",
  },
  {
    file: "riyadh", city: "Riyadh", day: "2026-10-07", tomorrow: "2026-10-08",
    max: 37.5, nextMax: 38.5, current: 31.1, wind: 5.1,
    code: 0, isDay: false, timezone: "Asia/Riyadh", text: "31C clear, Riyadh",
  },
  {
    file: "phoenix", city: "Phoenix", day: "2026-10-07", tomorrow: "2026-10-08",
    max: 39.7, nextMax: 39.9, current: 39.0, wind: 1.4,
    code: 0, isDay: true, timezone: "America/Phoenix", text: "39C clear, Phoenix",
  },
  {
    file: "berlin", city: "Berlin", day: "2026-10-07", tomorrow: "2026-10-08",
    max: 20.5, nextMax: 16.2, current: 14.9, wind: 7.1,
    code: 1, isDay: false, timezone: "Europe/Berlin", text: "15C clear, Berlin",
  },
  {
    file: "kuala_lumpur", city: "Kuala Lumpur", day: "2026-10-08", tomorrow: "2026-10-09",
    max: 37.8, nextMax: 39.5, current: 30.9, wind: 1.6,
    code: 1, isDay: false, timezone: "Asia/Kuala_Lumpur", text: "31C clear, Kuala Lumpur",
  },
];

for (const city of cases) {
  test(`${city.city} fixture: local today, tomorrow, current fields and state text`, () => {
    const input = fixture(city.file);
    const before = JSON.stringify(input);
    const expected: ParsedForecast = {
      daytimeMaxApparentC: city.max,
      currentApparentC: city.current,
      precipitationNow: 0,
      windNow: city.wind,
      isDay: city.isDay,
      weatherCode: city.code,
      timezone: city.timezone,
      summary: "clear",
    };
    assert.deepEqual(parseForecast(input), expected);
    assert.deepEqual(parseForecast(input, {}), expected);
    assert.deepEqual(parseForecast(input, { dayIso: city.day }), expected);
    const tomorrow = parseForecast(input, { dayIso: city.tomorrow });
    assert.deepEqual(tomorrow, { ...expected, daytimeMaxApparentC: city.nextMax });
    assert.equal(weatherText(tomorrow, city.city), city.text);
    assert.equal(shouldBurrow(expected.daytimeMaxApparentC), city.file === "muscat");
    assert.equal(shouldBurrow(tomorrow.daytimeMaxApparentC), false);
    assert.equal(JSON.stringify(input), before, "parser must not mutate its input");
  });
}

function hourlyForecast(time: unknown[], temperatures: unknown[]): unknown {
  return {
    timezone: "Asia/Muscat",
    current: { time: "2026-10-08T00:15", apparent_temperature: 34, weather_code: 0 },
    hourly: {
      time,
      apparent_temperature: temperatures,
      // The fixed clock window includes nighttime slots too.
      is_day: time.map(() => 0),
    },
  };
}

test("06:00 and 22:00 are included; adjacent times and dates are excluded", () => {
  for (const temperatures of [[100, 100, 42, 41, 100, 100, 100], [100, 100, 41, 42, 100, 100, 100]]) {
    const input = hourlyForecast([
      "2026-10-07T12:00", "2026-10-08T05:59", "2026-10-08T06:00",
      "2026-10-08T22:00", "2026-10-08T22:00:01", "2026-10-08T23:00",
      "2026-10-09T12:00",
    ], temperatures);
    assert.equal(parseForecast(input).daytimeMaxApparentC, 42);
  }
});

test("burrow starts at exactly 42.0, without rounding 41.9 up", () => {
  assert.equal(shouldBurrow(42.0), true);
  assert.equal(shouldBurrow(41.9), false);
  assert.equal(shouldBurrow(42.1), true);
  assert.equal(shouldBurrow(40, 40), true);
  assert.equal(shouldBurrow(39.9, 40), false);
  for (const value of [null, NaN, Infinity, -Infinity]) {
    assert.equal(shouldBurrow(value), false);
  }
  assert.equal(shouldBurrow(43, NaN), false);
});

test("a day with no hourly slots in the window has a null maximum and does not burrow", () => {
  const parsed = parseForecast(hourlyForecast([
    "2026-10-08T05:00", "2026-10-08T23:00", "2026-10-09T12:00",
  ], [50, 50, 50]));
  assert.equal(parsed.daytimeMaxApparentC, null);
  assert.equal(shouldBurrow(parsed.daytimeMaxApparentC), false);
  assert.equal(parseForecast(fixture("muscat"), { dayIso: "2026-10-09" }).daytimeMaxApparentC, null);
});

test("null, non-finite and non-numeric hourly values do not become temperatures", () => {
  const time = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00"]
    .map((hour) => `2026-10-08T${hour}`);
  assert.equal(parseForecast(hourlyForecast(time, [null, NaN, Infinity, "60", -5, -2])).daytimeMaxApparentC, -2);
  assert.equal(parseForecast(hourlyForecast(time, [null, NaN, Infinity, "60"])).daytimeMaxApparentC, null);
});

test("malformed local timestamps cannot enter the daytime window", () => {
  const input = hourlyForecast([
    "2026-10-08T12:00Z", "2026-10-08T12:00+04:00", "2026-10-08T06:99",
    "2026-10-08T24:00", "2026-10-08", null, "2026-10-08T10:00:00",
  ], [100, 100, 100, 100, 100, 100, 41.9]);
  assert.equal(parseForecast(input).daytimeMaxApparentC, 41.9);
});

test("a missing current day does not fall back to the host clock", () => {
  const input = { hourly: { time: ["2026-10-08T12:00"], apparent_temperature: [43] } };
  assert.equal(parseForecast(input).daytimeMaxApparentC, null);
  assert.equal(parseForecast(input, { dayIso: "2026-10-08" }).daytimeMaxApparentC, 43);
});

test("malformed payloads preserve missing data instead of inventing clear, dry weather", () => {
  const missing: ParsedForecast = {
    daytimeMaxApparentC: null, currentApparentC: null, precipitationNow: null,
    windNow: null, isDay: null, weatherCode: null, timezone: null, summary: "unknown",
  };
  for (const input of [null, undefined, [], "bad", 42, {}, { current: [], hourly: false }]) {
    assert.deepEqual(parseForecast(input), missing);
  }
  assert.deepEqual(parseForecast({
    current: { apparent_temperature: "34", precipitation: NaN, wind_speed_10m: Infinity, is_day: "0", weather_code: 1.5 },
  }), missing);
  assert.equal(weatherText(missing, "Muscat"), "?C unknown, Muscat");
});

test("explicit dates must be real YYYY-MM-DD dates", () => {
  for (const dayIso of ["2026-2-01", "2026-02-29", "2026-04-31", "2026-00-01", "2026-13-01", "2026-10-00", ""] ) {
    assert.throws(() => parseForecast({}, { dayIso }), RangeError);
  }
  assert.doesNotThrow(() => parseForecast({}, { dayIso: "2028-02-29" }));
});

test("every documented weather code maps to a short condition with CURRENT temperature", () => {
  const groups: [WeatherSummary, number[]][] = [
    ["clear", [0, 1]], ["cloudy", [2, 3]], ["fog", [45, 48]],
    ["drizzle", [51, 53, 55, 56, 57]], ["rain", [61, 63, 65, 66, 67, 80, 81, 82]],
    ["snow", [71, 73, 75, 77, 85, 86]], ["storm", [95, 96, 97, 99]],
  ];
  for (const [summary, codes] of groups) {
    for (const weather_code of codes) {
      const parsed = parseForecast({ current: { apparent_temperature: 33.5, weather_code } });
      assert.equal(parsed.summary, summary, `weather code ${weather_code}`);
      assert.equal(parsed.weatherCode, weather_code);
      assert.equal(weatherText(parsed, "Muscat"), `34C ${summary}, Muscat`);
    }
  }
  const unknown = parseForecast({ current: { apparent_temperature: -2.6, weather_code: 999 } });
  assert.equal(unknown.summary, "unknown");
  assert.equal(unknown.weatherCode, 999);
  assert.equal(weatherText(unknown, "Berlin"), "-3C unknown, Berlin");
});

test("current precipitation and wind preserve provider units without rounding", () => {
  const parsed = parseForecast({ current: { precipitation: 0.2, wind_speed_10m: 12.7, is_day: 1 } });
  assert.equal(parsed.precipitationNow, 0.2);
  assert.equal(parsed.windNow, 12.7);
  assert.equal(parsed.isDay, true);
});

test("URL contains the exact five fields for hourly and current, two days and auto timezone", () => {
  const url = new URL(buildForecastUrl(23.588, 58.383));
  assert.equal(url.origin + url.pathname, "https://api.open-meteo.com/v1/forecast");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    latitude: "23.588", longitude: "58.383",
    hourly: "apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day",
    current: "apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day",
    timezone: "auto", forecast_days: "2",
  });
  assert.equal(new URL(buildForecastUrl(33.448, -112.074)).searchParams.get("longitude"), "-112.074");
  assert.doesNotThrow(() => buildForecastUrl(-90, 180));
  for (const [lat, lon] of [[91, 0], [-91, 0], [0, 181], [0, -181], [NaN, 0], [0, Infinity]]) {
    assert.throws(() => buildForecastUrl(lat!, lon!), RangeError);
  }
});

test("fetch adapter uses the URL builder and returns the parsed forecast", async (t) => {
  const input = fixture("muscat");
  const mocked = t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, buildForecastUrl(23.588, 58.383));
    return new Response(JSON.stringify(input), { status: 200 });
  });
  assert.deepEqual(await fetchForecast(23.588, 58.383), parseForecast(input));
  assert.equal(mocked.mock.callCount(), 1);
});

test("fetch adapter surfaces HTTP errors for the caller's cached fallback", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("unavailable", { status: 503 }));
  await assert.rejects(fetchForecast(23.588, 58.383), /HTTP 503/);
});

test("fetch adapter surfaces invalid JSON without turning it into safe weather", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("not json", { status: 200 }));
  await assert.rejects(fetchForecast(23.588, 58.383), SyntaxError);
});
