# S04: Open-Meteo forecast and burrow threshold

## Outcome

Complete. All files are under `fleet/outbox/S04/`. Nothing was written to `worker/`. No packages were installed. No git operations were run.

- Five live forecasts were fetched with curl. Their response bodies are saved unchanged as JSON fixtures.
- The pure parser uses local clock strings. Its window includes both 06:00 and 22:00.
- All 19 tests pass on Node v22.23.3. No type-stripping flag was needed.
- Muscat crosses 42C apparent on October 7. It does not cross on October 8.
- Keep the specified 42C threshold for now. This is a two-day sanity check, not a seasonal validation or a medical safety standard.

## Exact request and documentation check

Checked the [Open-Meteo forecast documentation](https://open-meteo.com/en/docs) on 2026-10-07.

Exact Muscat URL:

```text
https://api.open-meteo.com/v1/forecast?latitude=23.588&longitude=58.383&hourly=apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day&current=apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day&timezone=auto&forecast_days=2
```

`buildForecastUrl(lat, lon)` substitutes the coordinates. It rejects non-finite or out-of-range coordinates. Exact URLs for all five requests are in `fixtures/fetch-metadata.json`.

The current parameter names are `weather_code` and `wind_speed_10m`. Both requested groups support all five fields. `forecast_days=2` is valid. Defaults are Celsius, millimetres and kilometres per hour. The request uses default ISO8601 timestamps, not Unix timestamps.

The documentation says:

> If timezone is set, all timestamps are returned as local-time and data is returned starting at 00:00 local-time.

> If auto is set as a time zone, the coordinates will be automatically resolved to the local time zone.

It describes `utc_offset_seconds` as the applied timezone offset. The top-level `timezone` field is the resolved timezone identifier. Both fields are present in every live fixture.

Do not parse `hourly.time` with the host timezone. Do not append `Z`. Do not add `utc_offset_seconds` to these strings again. They already represent the resolved local clock. The parser compares their local date and clock components directly. It does not filter by hourly `is_day`, since the product rule uses a fixed clock window.

### Observed response shape

These are the actual Muscat current fields and metadata:

```json
{
  "utc_offset_seconds": 14400,
  "timezone": "Asia/Muscat",
  "timezone_abbreviation": "GMT+4",
  "current_units": {
    "time": "iso8601",
    "interval": "seconds",
    "apparent_temperature": "°C",
    "precipitation": "mm",
    "weather_code": "wmo code",
    "wind_speed_10m": "km/h",
    "is_day": ""
  },
  "current": {
    "time": "2026-10-07T23:30",
    "interval": 900,
    "apparent_temperature": 33.5,
    "precipitation": 0.00,
    "weather_code": 0,
    "wind_speed_10m": 2.8,
    "is_day": 0
  }
}
```

The response also has `latitude`, `longitude`, `elevation`, `generationtime_ms`, `hourly_units` and `hourly`. Returned coordinates identify a model grid cell and can differ slightly from the request.

`hourly.time` is an array of local ISO8601 strings. Each requested hourly field is a parallel array. Muscat's first timestamp is `2026-10-07T00:00`. Its last is `2026-10-08T23:00`. All five fixtures have 48 aligned hourly entries. This count is an observation for these dates, not a hardcoded parser requirement.

`current.time` is the local validity time. The docs describe current conditions as model data with a 15-minute basis. They are not a live station observation. `current.interval` specifies the duration used for backward-looking sums or averages. All fixtures report 900 seconds. `precipitationNow` preserves the current precipitation amount in mm. It is not a probability or an mm/hour rate. Hourly precipitation is the preceding hour's sum.

### Short weather labels

| Label | WMO codes |
|---|---|
| clear | 0, 1 |
| cloudy | 2, 3 |
| fog | 45, 48 |
| drizzle | 51, 53, 55, 56, 57 |
| rain | 61, 63, 65, 66, 67, 80, 81, 82 |
| snow | 71, 73, 75, 77, 85, 86 |
| storm | 95, 96, 97, 99 |

The current documentation includes code 97, heavy thunderstorm. Missing or unrecognized codes produce `unknown`. They must not silently become clear weather. Every documented code has a test.

## Live results

Requests began at `2026-10-07T19:43:32Z`. This was `2026-10-07T23:43:32+04:00` in Oman. The metadata file records each request time, URL, byte count and resolved timezone.

"Today" means the date of that city's `current.time`. Kuala Lumpur was already on October 8. Its tomorrow is October 9. All maxima below use 06:00 through 22:00 inclusive. Each selected day has 17 hourly slots. Burrow means an unrounded maximum of at least 42C.

Generated with:

```sh
cd /home/abied/Desktop/Truffle
node fleet/outbox/S04/report.ts
```

| City | Local today | Daytime max apparent C | Current apparent C | Burrow today | Local tomorrow | Tomorrow max apparent C | Burrow tomorrow |
|---|---|---:|---:|---|---|---:|---|
| Muscat | 2026-10-07 | 43.9 | 33.5 | yes | 2026-10-08 | 40.6 | no |
| Riyadh | 2026-10-07 | 37.5 | 31.1 | no | 2026-10-08 | 38.5 | no |
| Phoenix | 2026-10-07 | 39.7 | 39.0 | no | 2026-10-08 | 39.9 | no |
| Berlin | 2026-10-07 | 20.5 | 14.9 | no | 2026-10-08 | 16.2 | no |
| Kuala Lumpur | 2026-10-08 | 37.8 | 30.9 | no | 2026-10-09 | 39.5 | no |

| City | Current local validity time | Resolved timezone | utc_offset_seconds | Fixture bytes |
|---|---|---|---:|---:|
| Muscat | 2026-10-07T23:30 | Asia/Muscat | 14400 | 2550 |
| Riyadh | 2026-10-07T22:30 | Asia/Riyadh | 10800 | 2536 |
| Phoenix | 2026-10-07T12:30 | America/Phoenix | -25200 | 2542 |
| Berlin | 2026-10-07T21:30 | Europe/Berlin | 7200 | 2562 |
| Kuala Lumpur | 2026-10-08T03:30 | Asia/Kuala_Lumpur | 28800 | 2557 |

Muscat's October 7 maximum occurs at 11:00 and 12:00. Its October 8 maximum occurs at 12:00. `weatherText` returns `34C clear, Muscat` for this fixture. It rounds the current 33.5C value. It does not display the 43.9C daily maximum.

### Curl acquisition evidence

Five parallel Python subprocesses invoked curl with the same flags. They saved stdout bytes without reformatting. Each body was checked for `current` and `hourly` before saving. This is the exact Muscat command, with shell quoting around its URL:

```sh
curl --fail --silent --show-error --location --max-time 60 'https://api.open-meteo.com/v1/forecast?latitude=23.588&longitude=58.383&hourly=apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day&current=apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day&timezone=auto&forecast_days=2'
```

The other coordinate pairs were `(24.713, 46.675)`, `(33.448, -112.074)`, `(52.520, 13.405)` and `(3.139, 101.687)`. These are recorded in their URLs. The saved JSON files are test fixtures, not disposable raw data.

A separate Python validation checked all five requested current fields. It also checked the length of every hourly array against `hourly.time`. All five responses passed with 48 aligned entries.

## Is 42C apparent sane for Muscat?

### October

Provisionally yes. This live snapshot gives a burrow day at 43.9C and a non-burrow day at 40.6C. The threshold is not always on or always off in this two-day sample.

The [Weather2Travel Muscat climate guide](https://weather2travel.com/oman/muscat/climate/?Units=0) lists an October average daytime maximum of 34C. Its average nighttime minimum is 24C. It rates heat and humidity as "very high". The guide attributes its long-term monthly averages to CRU, the Met Office and the Netherlands Meteorological Institute. It does not state the averaging years on the page.

These are air-temperature averages, not apparent-temperature averages. They cannot establish a 42C apparent exceedance rate. The two recorded days support keeping the tunable product constant. They do not establish behavior across the full week or month. Today's late-evening model response also does not reproduce the forecast that was available at midnight.

### July

The same climate guide lists July's average daytime maximum as 38C and its nighttime minimum as 29C. It rates heat and humidity as "extreme". This supports expecting more heat-protection days in July than in October.

A 42C apparent cutoff looks like a plausible protective product threshold for July. Frequent burrowing would be consistent with the product's summer purpose. It remains unvalidated. I did not obtain a July hourly apparent-temperature history or an official apparent-temperature climatology. I cannot state how many July days would burrow.

[Open-Meteo defines apparent temperature](https://open-meteo.com/en/docs) using wind chill, relative humidity and solar radiation. Monthly air-temperature means cannot be converted to this metric with a fixed adjustment. Do not equate 42C apparent with a universal heat-index, WBGT or medical danger threshold. A non-burrow result is not a guarantee that outdoor activity is safe.

Recommendation: keep `BURROW_APPARENT_C = 42`. Later, evaluate local hourly apparent-temperature histories for both July and October. Measure the fraction of days that cross the same 06:00 to 22:00 window before retuning.

## Files and integration contract

- `weather.ts`: pure `parseForecast`, `shouldBurrow`, `weatherText` and `buildForecastUrl`. It also exports a small `fetchForecast` adapter.
- `weather.test.ts`: 19 native `node:test` tests. Five use the recorded city fixtures.
- `fixtures/muscat.json`, `riyadh.json`, `phoenix.json`, `berlin.json`, `kuala_lumpur.json`: unchanged provider response bodies.
- `fixtures/fetch-metadata.json`: capture provenance and exact request URLs.
- `report.ts`: reproduces the results table without network access.
- `test-output.txt`: the full baseline test output pasted below.

`parseForecast(json, { dayIso })` selects a local date. Both the options object and `dayIso` may be omitted. The default is the day of `current.time`, never the host clock. An invalid explicit calendar date throws `RangeError`. Selecting tomorrow changes only the hourly maximum. The current fields remain current.

Unknown or non-finite numeric data remain `null`. The parser skips invalid hourly entries and takes the maximum of available valid entries. A day with no valid entries in the selected window has a `null` maximum. `shouldBurrow(null)` is false. `isDay` is a boolean for valid API values 0 and 1. It is `null` when unavailable. `timezone` is a string or `null`.

`summary` contains the short current condition label. Unknown weather codes yield `unknown`. A missing current temperature displays `?C`, not a fabricated zero. The parser expects the default units and local ISO8601 timestamps produced by the URL builder.

The transport adapter rejects HTTP failures and invalid JSON. It returns a parsed forecast for the current local day. Use `buildForecastUrl` plus a caller-owned fetch when both local days are needed from one response.

### Integration risks and open items

- No caching was added. The Durable Object owns caching and the outage policy.
- A parsed `null` maximum is missing data, not evidence of safe conditions. The caller should log missing data and apply its cached-decision fallback before accepting a new decision.
- A partially missing day uses the available valid slots. The requested return shape does not include a completeness flag. If completeness is required, validate the hourly coverage in the caller.
- A single `utc_offset_seconds` value should not drive Durable Object midnight scheduling. Use the returned IANA timezone with the dedicated scheduling logic.
- The raw fixtures represent one live model snapshot. July frequency and full-season threshold suitability remain open.
- Native Node execution strips types. This work did not run a separate TypeScript type checker. No compiler was installed.

Cost: $0 paid. Five public Open-Meteo forecast requests. No GPU or paid weather API use.

## Verification

Baseline command:

```sh
cd /home/abied/Desktop/Truffle
node --test fleet/outbox/S04/weather.test.ts
```

Exact baseline output:

```text
TAP version 13
# Subtest: Muscat fixture: local today, tomorrow, current fields and state text
ok 1 - Muscat fixture: local today, tomorrow, current fields and state text
  ---
  duration_ms: 2.346368
  type: 'test'
  ...
# Subtest: Riyadh fixture: local today, tomorrow, current fields and state text
ok 2 - Riyadh fixture: local today, tomorrow, current fields and state text
  ---
  duration_ms: 0.269456
  type: 'test'
  ...
# Subtest: Phoenix fixture: local today, tomorrow, current fields and state text
ok 3 - Phoenix fixture: local today, tomorrow, current fields and state text
  ---
  duration_ms: 0.288627
  type: 'test'
  ...
# Subtest: Berlin fixture: local today, tomorrow, current fields and state text
ok 4 - Berlin fixture: local today, tomorrow, current fields and state text
  ---
  duration_ms: 0.21365
  type: 'test'
  ...
# Subtest: Kuala Lumpur fixture: local today, tomorrow, current fields and state text
ok 5 - Kuala Lumpur fixture: local today, tomorrow, current fields and state text
  ---
  duration_ms: 0.299125
  type: 'test'
  ...
# Subtest: 06:00 and 22:00 are included; adjacent times and dates are excluded
ok 6 - 06:00 and 22:00 are included; adjacent times and dates are excluded
  ---
  duration_ms: 0.173313
  type: 'test'
  ...
# Subtest: burrow starts at exactly 42.0, without rounding 41.9 up
ok 7 - burrow starts at exactly 42.0, without rounding 41.9 up
  ---
  duration_ms: 0.135454
  type: 'test'
  ...
# Subtest: a day with no hourly slots in the window has a null maximum and does not burrow
ok 8 - a day with no hourly slots in the window has a null maximum and does not burrow
  ---
  duration_ms: 0.159296
  type: 'test'
  ...
# Subtest: null, non-finite and non-numeric hourly values do not become temperatures
ok 9 - null, non-finite and non-numeric hourly values do not become temperatures
  ---
  duration_ms: 0.291031
  type: 'test'
  ...
# Subtest: malformed local timestamps cannot enter the daytime window
ok 10 - malformed local timestamps cannot enter the daytime window
  ---
  duration_ms: 0.235193
  type: 'test'
  ...
# Subtest: a missing current day does not fall back to the host clock
ok 11 - a missing current day does not fall back to the host clock
  ---
  duration_ms: 0.607973
  type: 'test'
  ...
# Subtest: malformed payloads preserve missing data instead of inventing clear, dry weather
ok 12 - malformed payloads preserve missing data instead of inventing clear, dry weather
  ---
  duration_ms: 0.128304
  type: 'test'
  ...
# Subtest: explicit dates must be real YYYY-MM-DD dates
ok 13 - explicit dates must be real YYYY-MM-DD dates
  ---
  duration_ms: 0.314671
  type: 'test'
  ...
# Subtest: every documented weather code maps to a short condition with CURRENT temperature
ok 14 - every documented weather code maps to a short condition with CURRENT temperature
  ---
  duration_ms: 0.19083
  type: 'test'
  ...
# Subtest: current precipitation and wind preserve provider units without rounding
ok 15 - current precipitation and wind preserve provider units without rounding
  ---
  duration_ms: 0.059452
  type: 'test'
  ...
# Subtest: URL contains the exact five fields for hourly and current, two days and auto timezone
ok 16 - URL contains the exact five fields for hourly and current, two days and auto timezone
  ---
  duration_ms: 0.35064
  type: 'test'
  ...
# Subtest: fetch adapter uses the URL builder and returns the parsed forecast
ok 17 - fetch adapter uses the URL builder and returns the parsed forecast
  ---
  duration_ms: 12.325588
  type: 'test'
  ...
# Subtest: fetch adapter surfaces HTTP errors for the caller's cached fallback
ok 18 - fetch adapter surfaces HTTP errors for the caller's cached fallback
  ---
  duration_ms: 0.236336
  type: 'test'
  ...
# Subtest: fetch adapter surfaces invalid JSON without turning it into safe weather
ok 19 - fetch adapter surfaces invalid JSON without turning it into safe weather
  ---
  duration_ms: 0.321534
  type: 'test'
  ...
1..19
# tests 19
# suites 0
# pass 19
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 95.941574
```

Host-timezone independence checks also passed:

```sh
TZ=Pacific/Honolulu node --test fleet/outbox/S04/weather.test.ts
TZ=Asia/Tokyo node --test fleet/outbox/S04/weather.test.ts
```

Both runs reported 19 tests, 19 passes and 0 failures. Their total durations were 98.608177 ms and 94.86628 ms, respectively.
