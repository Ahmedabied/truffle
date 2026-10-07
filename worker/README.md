# worker

The Cloudflare Worker behind Truffle. One Durable Object per Truffle holds its state in SQLite and wakes up at the owner's local midnight. The energy rules live in `src/engine.ts` and are tested against `tests/golden/energy_cases.json`. Everything else here stores, schedules, fetches weather and calls the brain.

## Files

| File | What it does |
|---|---|
| `src/index.ts` | Hono routes, input checks, CORS, defaults from `request.cf` |
| `src/do.ts` | `TruffleDO`: SQLite tables, midnight alarm, catch-up, chat stream, demo controls |
| `src/engine.ts`, `src/config.ts` | The energy engine and its constants (packet B01) |
| `src/brain.ts` | Brain router: Modal first, Workers AI fallback ("half-awake"), fact extraction |
| `src/prompt.ts` | System prompt, memory window per tier, canned sleepy lines |
| `src/weather.ts` | Open-Meteo URL, parser, burrow input, the short weather text |
| `src/time.ts` | Local midnight math from an IANA timezone (Intl only) |
| `src/pairing.ts`, `src/words.ts` | 3-word phrases from 2,000 nouns, secrets, hashes |
| `src/ratelimit.ts` | Feed, chat and demo limits (pure helpers) |
| `src/limiter.ts` | `LimiterDO`: per-IP counter for demo spawns |

## Run it

```sh
cd worker
npm install
npm test            # vitest: golden engine cases plus worker unit tests
npm run typecheck
npx wrangler dev --ip 127.0.0.1 --port 8787
```

`--ip 127.0.0.1` matters on some Linux machines. Without it, workerd can fail with `bind(): Cannot assign requested address`.

The `AI` binding always calls the real Workers AI model, even in local dev. So the fallback brain is real when you test. It costs a few neurons per message.

## Environment

| Name | Where | What |
|---|---|---|
| `MODAL_URL` | secret | Base URL of the Modal vLLM endpoint. The Worker calls `${MODAL_URL}/v1/chat/completions`. Unset means every reply comes from Workers AI. |
| `MODAL_TOKEN` | secret | Bearer token for the Modal proxy. |
| `BRAIN_TIMEOUT_MS` | var | How long to wait for Modal's first token before falling back. Default 25000. |
| `ALLOWED_ORIGINS` | var, optional | Extra CORS origins, comma separated. `localhost`, `127.0.0.1` and `https://truffle.pages.dev` (plus its preview subdomains) are always allowed. |

Locally, copy `.dev.vars.example` to `.dev.vars` and fill it in. `.dev.vars` is gitignored. Never commit real values.

## Deploy

```sh
npx wrangler secret put MODAL_URL
npx wrangler secret put MODAL_TOKEN
npx wrangler deploy
```

## Routes

All bodies are JSON. Errors look like `{"error": "..."}` with a 4xx status.

The phrase names a Truffle. The secret proves you own it. `/pair` returns the secret once. Send it as the header `x-truffle-secret` (or a `secret` field in the body). `/feed` needs only the phrase, so a phone automation can call it. The worst a stranger with your phrase can do is feed your Truffle.

Phrases are three words, like `sand-moon-fig`. Spaces, capitals and dashes are all fine: `Sand Moon Fig` works too.

Set these once for the examples below:

```sh
B=http://127.0.0.1:8787
```

### GET /health

```sh
curl -s $B/health
# {"ok":true,"service":"truffle","modal":false}
```

### POST /pair

Creates a Truffle. Timezone, country, coordinates and city come from `request.cf`. When those are missing (some local setups), it uses Muscat. The language is Arabic for Arab League countries, else English. You can pass `lang` (`ar` or `en`) and `tz` to override.

```sh
curl -s -X POST $B/pair -H 'content-type: application/json' -d '{"lang":"en"}'
# {"phrase":"spaniel-raft-glider","secret":"<22 chars>","state":{...},"mood":"burrowed",
#  "tier":"asleep","tz":"Asia/Muscat","country":"OM","lang":"en","city":"Muscat",
#  "weather":{"text":"33C clear, Muscat","daytime_max_c":43.9,...}}
```

Save the phrase and secret:

```sh
P=spaniel-raft-glider
S=<the secret>
```

### POST /feed

`steps_today_total` is the absolute total since local midnight, not a delta. Optional fields:

- `day`: the local date the total belongs to, `YYYY-MM-DD`. Send it. A total for any other day than the Truffle's current day is ignored, so a late retry of yesterday's total never counts twice.
- `lat`, `lon`: together, as numbers. Stored rounded to 2 decimals. Every change is logged.
- `device_tz`: recorded for display only. The Truffle's timezone is fixed at `/pair` and decides its midnight.

Without `day`, a total that is too high for the time since local midnight (more than 4 steps a second on average) is ignored. The reply is a short status for the feeder, not the full state. `expected_day` and `active_tz` tell the feeder which day to count.

```sh
curl -s -X POST $B/feed -H 'content-type: application/json' \
  -d "{\"phrase\":\"$P\",\"steps_today_total\":4500,\"day\":\"2026-10-08\"}"
# {"energy":4500,"energy_max":6000,"stage":"Spore","mood":"content","tier":"high","steps_today":4500,
#  "burrowed":false,"expected_day":"2026-10-08","active_tz":"Asia/Muscat"}
```

An ignored total comes back with `"ignored": "<reason>"` and changes nothing. The 61st feed within an hour returns `429`.

### GET /state

```sh
curl -s "$B/state?phrase=$P" -H "x-truffle-secret: $S"
```

Returns `state` (the engine state), `mood`, `tier`, `energy_max`, `energy_pct`, `tz`, `country`, `lang`, `city`, `local_day`, `next_midnight_ms` and `weather` (`text`, `apparent_c`, `daytime_max_c`, `precipitation_mm`, `wind_kmh`, `is_day`, `weather_code`). Weather is refreshed at most every 30 minutes.

### POST /chat (Server-Sent Events)

`message` is required (1 to 1,000 characters). `requested_tier` (`asleep`, `low`, `medium`, `high`) can only lower the effort. The engine caps it by energy. `lang` switches the language and is remembered.

```sh
curl -sN -X POST $B/chat -H "x-truffle-secret: $S" -H 'content-type: application/json' \
  -d "{\"phrase\":\"$P\",\"message\":\"My name is Ahmed. How are you?\",\"lang\":\"en\"}"
```

```text
event: brain
data: {"brain":"workers-ai","half_awake":true}

event: token
data: {"t":"Nice"}

event: token
data: {"t":" to"}

...

event: done
data: {"tier":"high","brain":"workers-ai","half_awake":true,"spent":200,"summary":{...same shape as /state...}}
```

Events:

- `brain` comes once, when a brain starts answering. `brain` is `modal`, `workers-ai` or `none` (asleep: a canned line, no model call). `half_awake` is true for the fallback.
- `token` carries visible text. Reasoning is never sent.
- `done` carries the tier used, the energy spent and the new state.
- `error` means the brain failed. Nothing is charged.

A Truffle answers one message at a time. A second `/chat` while one is streaming returns `429`. So does the 61st chat within an hour. The cost is charged once, when the reply is done. If the brain fails before any text, nothing is charged. If it fails mid-reply, the partial reply is charged and `done` says `"partial": true`.

A dead Truffle returns `409`. Plant a new spore first.

### POST /spore

After death: a fresh Spore. Gravestones are kept.

```sh
curl -s -X POST $B/spore -H "x-truffle-secret: $S" -H 'content-type: application/json' -d "{\"phrase\":\"$P\"}"
```

### Judge mode

`/demo/spawn` makes a demo Truffle. It needs no pairing and deletes itself after 24 hours. Each IP can spawn 5 per hour and 20 per day (`429` after that). It skips real midnights and the real heat check: the controls drive it. The other demo routes refuse to touch a real Truffle.

```sh
D=$(curl -s -X POST $B/demo/spawn -H 'content-type: application/json' -d '{"lang":"en"}')
P=$(echo "$D" | python3 -c 'import json,sys;print(json.load(sys.stdin)["phrase"])')
S=$(echo "$D" | python3 -c 'import json,sys;print(json.load(sys.stdin)["secret"])')
H=(-H "x-truffle-secret: $S" -H 'content-type: application/json')

curl -s -X POST $B/demo/slider   "${H[@]}" -d "{\"phrase\":\"$P\",\"steps\":6000}"   # today's total
curl -s -X POST $B/demo/midnight "${H[@]}" -d "{\"phrase\":\"$P\"}"                # time travel one night
curl -s -X POST $B/demo/heat     "${H[@]}" -d "{\"phrase\":\"$P\",\"on\":true}"      # today is a burrowed day
curl -s -X POST $B/demo/reset    "${H[@]}" -d "{\"phrase\":\"$P\"}"                # back to a fresh spore
```

Four midnights at zero energy kill it. `/spore` brings a new one.

## How time works

Each Truffle has one alarm, set to its next local midnight (`src/time.ts`, DST safe). The alarm runs every midnight it missed, oldest first, at most 14 per run, and comes back a second later if more are owed. Each processed day key is stored, so a double fire never burns twice. The timezone is fixed when the Truffle is paired. The feeder's `device_tz` never moves the alarm, so a clock change cannot skip or double a burn. Moving a Truffle to a new timezone is an open decision. Requests also catch up on missed midnights before they read or write state.

Weather comes from Open-Meteo for the stored coarse point (2 decimals). The daytime (06:00 to 22:00 local) max apparent temperature for each forecast day is cached. A day is burrowed when that max is at least 42C. If the forecast is missing, the day is not burrowed.

## Data kept per Truffle

Engine state, a phrase-derived object id, a hash of the secret, tz, country, language, one coarse point, city, up to 60 memory facts, the last 20 chat turns, and a 200-row event log. No step records, no location trail, no device ids.
