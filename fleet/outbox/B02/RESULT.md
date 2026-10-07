# B02 RESULT: worker routes, TruffleDO, brain router

Status: **done**. The full flow runs end to end under `wrangler dev`, using the real Workers AI fallback brain. B01's engine landed before I started, so every e2e below uses the real engine. Not deployed: deploying is the integrator's job. Cost: a few Workers AI neurons for the local chats (well under $0.01). No GPU.

## What was built

| File | What |
|---|---|
| `worker/src/index.ts` | Hono app. CORS for localhost, `truffle.pages.dev` and `ALLOWED_ORIGINS`. Every route from docs/02. Hand-written input checks. Defaults from `request.cf`, with Muscat as the fallback. |
| `worker/src/do.ts` | `TruffleDO` on SQLite. Tables: `state` (engine JSON plus meta JSON), `facts`, `turns` (last 20), `log` (last 200). RPC methods: `pair`, `getState`, `feed`, `chat` (SSE byte stream), `spore`, `setSteps`, `forceMidnight`, `setHeat`, `reset`. Also the midnight `alarm()`. |
| `worker/src/limiter.ts` | `LimiterDO`: per-IP fixed windows for demo spawns (S10-05). New `v2` migration in wrangler.jsonc. |
| `worker/src/brain.ts` | `askBrain`: Modal first, Workers AI fallback, reasoning stripped. `extractFacts` uses `json_schema`. |
| `worker/src/prompt.ts` | `buildSystemPrompt`, `factsForTier`, 6 canned sleepy lines each for en and ar. |
| `worker/src/weather.ts` | `buildForecastUrl`, `parseForecast`, `daytimeMax`, `weatherText`, `sanitizeText`, `fetchForecast`. |
| `worker/src/time.ts` | **S05's version adopted** (stricter than mine). I appended `daysBetween` and `nextDayKey`. |
| `worker/src/pairing.ts`, `words.ts` | 2,000 nouns. CSPRNG phrase without modulo bias. Normalise and validate. SHA-256 phrase hash. 16-byte base64url secret, stored only as a hash. |
| `worker/src/ratelimit.ts`, `types.ts` | Pure limit helpers. Shared types. |
| `worker/test/*.test.ts` | Tests for time (S05 port plus mine), weather (on a real recorded fixture), pairing, prompt memory window, brain fallback routing, rate limit. |
| `worker/README.md` | How to run and deploy, env vars, curl for every route, the SSE format. |

The DO stays thin. Every rule (tier, charge, feed, midnight, burrow threshold, death, spore, state block) is a call into `engine.ts`.

## Evidence

### Typecheck and tests

```text
$ npm run typecheck
> tsc --noEmit
(no output)

$ npm test
 Test Files  9 passed (9)
      Tests  128 passed (128)

per file: golden 31, engine 13 (B01) | time 28 (S05 port), time-b02 15, brain 9,
          weather 9, prompt 12, pairing 6, ratelimit 5
```

### End to end under `wrangler dev --ip 127.0.0.1 --port 8787`

Runs from Oct 7 23:50 to Oct 8 00:10, Oman time. Secrets are redacted below. Each is a throwaway local-dev Truffle.

```text
$ curl -s $B/health
{"ok":true,"service":"truffle","modal":false}

$ curl -s -X POST $B/pair
{"phrase":"spaniel-raft-glider","secret":"<redacted>","state":{"energy":0,...,"burrowed":true,...},
 "mood":"burrowed","tier":"asleep","tz":"Asia/Muscat","country":"OM","lang":"ar","city":"Muscat",
 "local_day":"2026-10-07","next_midnight_ms":1791403200000,
 "weather":{"text":"33C clear, Muscat","apparent_c":33.1,"daytime_max_c":43.9,...}}
   -> real Open-Meteo: Oct 7 daytime max 43.9C >= 42, so burrowed at pairing.

$ chat while energy is 0 (asleep tier, no model call)
event: brain  data: {"brain":"none","half_awake":false}
event: token  data: {"t":"(شخير صغير يطلع من الرمل)"}
event: done   data: {"tier":"asleep","brain":"none","half_awake":false,"spent":0,...}

$ feed 4200
{"energy":4200,"energy_max":6000,"stage":"Spore","mood":"burrowed","tier":"high","steps_today":4200,"burrowed":true}
   -> burrowed day: fed, not grown (lifetime_steps stays 0)

$ state with a wrong secret
{"error":"wrong secret"}

$ chat, high tier, real Workers AI fallback (22.4 s with thinking on)
event: brain  data: {"brain":"workers-ai","half_awake":true}
event: token  data: {"t":"Nice"} ... 
event: done   data: {"tier":"high","brain":"workers-ai","half_awake":true,"spent":200,...}
REPLY: Nice to meet you Ahmed. I am doing okay, just cozy under the sand. It is quite hot out
there, so maybe save the walking for the evening or stay indoors for now.

$ chat, requested medium, memory recall (0.7 s)
"tier":"medium","brain":"workers-ai","half_awake":true,"spent":60
REPLY: Yes Ahmed, I remember. You love walking in wadis.

$ CORS preflight from http://localhost:5173  -> 204, Allow-Origin echoed, x-truffle-secret allowed
$ CORS on the SSE response                   -> Content-Type: text/event-stream; Allow-Origin present
$ Origin https://evil.example                -> no Allow-Origin header
$ 62 feeds in a row                          -> request 61 overall: 429 "rate limit: 60 feeds per hour, retry in 3552s"
```

**The real midnight alarm fired live** at 00:00 Oman on the first Truffle:

```text
before: energy 4020, steps_today 4300, age_days 0, burrowed true (43.9C day)
after:  {'energy': 4020, 'age_days': 1, 'steps_today': 0, 'history7': [4300], 'avg7': 4300,
         'affection': 1, 'burrowed': False, 'zero_days': 0} 2026-10-08 next=1791489600000 daytime_max=40.6
```

The day closed and affection rose. The burn was skipped because the closing day was burrowed. The new day is not burrowed (40.6C). The next alarm is the following Muscat midnight.

Judge mode (demo Truffle):

```text
slider 6000            -> Sprout, energy 6000, tier medium
midnight               -> energy 3000, affection 1, age 1
heat on                -> burrowed True, mood burrowed
slider 9000 (burrowed) -> energy 12000, lifetime_steps still 6000 (fed, not grown)
midnight               -> energy 12000 (no burn on the burrowed day), burrowed False
reset, then 4 midnights at 0 energy -> zero_days 1,2,3,4; dead True, gravestone written
chat when dead         -> 409 {"error":"truffle is dead; POST /spore to plant a new one"}
spore                  -> fresh Spore, gravestone kept
demo midnight on a real Truffle -> {"error":"not a demo truffle"}
unknown phrase         -> {"error":"no truffle with that phrase"}
```

S10 fixes (run at 00:05 Oman, Oct 8):

```text
feed 5000, day=2026-10-07 (replay) -> ignored "day 2026-10-07 is already closed", energy 0
feed 5000, no day                  -> ignored "total is too high for the time since local midnight; send the day field"
feed 300, no day                   -> energy 300
feed 4500, day=2026-10-08          -> energy 4500, expected_day 2026-10-08, active_tz Asia/Muscat
day=2026-02-30                     -> 400 "day must be a real date, YYYY-MM-DD"
device_tz Pacific/Honolulu         -> before: Asia/Muscat 1791489600000 / after: Asia/Muscat 1791489600000
two chats at once                  -> one 429 "Truffle is still answering your last message. One at a time, please."
                                      one streamed and charged once: "tier":"medium",...,"spent":60
6 demo spawns from one IP          -> 200 x5, then 429 "Too many demo Truffles from here. Try again in 60 min."; other IP -> 200
Arabic chat after the prompt change -> "هلا والله! أنا بخير ومستانس، الجو اليوم مشمس وجميل. كيف حالك أنت؟"
```

## Integrator requests applied

- **feed() security review:** `/feed` returns only `{energy, energy_max, stage, mood, tier, steps_today, burrowed}` plus `expected_day`, `active_tz` and `ignored`. `device_tz` is validated with `isValidTimeZone` in the route and again in the DO. An invalid value is logged and ignored. `lat` and `lon` are range-checked in both places, NaN is rejected, and every change is logged (`coords`). `requested_tier` is validated at the route.
- **S05:** its `time.ts` is now `worker/src/time.ts`, and its 28 tests are ported to vitest. I followed its alarm design: idempotent `last_midnight_key`, per-day cached weather, at most 14 ticks per run, debt kept and resumed via `setAlarm(now + 1000)`, rescheduling inside `alarm()`, and a `try/catch` that retries in 60 s. Ticks are committed before any network await. I also made the weather refresh re-read the row after `fetch`, so a concurrent `/feed` is never overwritten.
- **S10-02:** `day` must equal the DO's own local day key or the total is ignored, with no state change. Without `day`, a 4 steps/second cap since local midnight blocks yesterday's total replayed right after midnight.
- **S10-03:** tz is pinned at `/pair`. `device_tz` is stored as `meta.device_tz` (display and log only) and never moves the alarm. **Owner-driven tz migration is a Thursday decision** (needs a decision record).
- **S10-04:** `chat_lock_until` (now + 60 s) is set before any model call. A second chat gets 429 with a friendly line, and the lock is released in `finally`. The charge happens in exactly one place, guarded by a once-flag. A failure before the first token costs nothing. A mid-reply failure charges once and sends `done` with `partial: true`. Client disconnects no longer abort the charge. Real and demo Truffles share the per-Truffle cap of 60 chats per hour.
- **S10-05:** `LimiterDO` keyed by `cf-connecting-ip` allows 5 spawns per hour and 20 per day. It counts before any TruffleDO is created. The 24 h self-delete is unchanged.
- **S09:** I added the persona line "The bracketed status line is private. Never quote it or its field names." The header is still 6 lines.

## Workers AI: what I measured and what I guessed

Measured with a throwaway probe Worker against the real `@cf/google/gemma-4-26b-a4b-it` (scratchpad only, nothing committed):

1. **Thinking is ON by default.** The schema default is `enable_thinking: true`, and with no kwargs the stream carried 197 `reasoning_content` chunks. Low and medium send `chat_template_kwargs: {enable_thinking: false}`. S09 confirmed no leaks in 20 replies.
2. **Reasoning arrives in `choices[0].delta.reasoning_content`**, apart from `content`. The parser reads only `delta.content`, so reasoning never reaches the client.
3. **Reasoning tokens count against `max_tokens`.** With thinking on and `max_tokens: 300`, 277 tokens went to reasoning. So when thinking is on, I add `THINKING_BUDGET_TOKENS = 1024` on top of the tier limit (Modal too). **Guess:** that 1024 is enough. A high-tier fallback chat took 22 s.
4. The stream ends with a legacy chunk `{"response":"","usage":...}` and then `[DONE]`. Both shapes are handled.
5. `response_format: {type:"json_schema", json_schema:{name, strict, schema}}` works with no stream. The content is a JSON string in `choices[0].message.content`.

Guesses that are not verified:

- I send `temperature: 1.0, top_p: 0.95` to Workers AI and add `top_k: 64` for Modal only (`top_k` is not in the Workers AI schema). I have not checked that Workers AI honours these.
- **`ThoughtStripper`** removes inline `<think>`/`<thought>` blocks. I never saw them on Workers AI. It is a guard for Modal templates.
- **Modal's first-token timeout** counts any SSE event, reasoning included, as "awake". It has never run against a real Modal endpoint (MODAL_URL was unset). It is covered only by the mocked tests.
- Returning a `ReadableStream` from a DO RPC method works in local workerd. I have not checked it on the deployed runtime.

## Open questions

1. **State block tier vs. used tier.** `engine.stateBlock` writes `tier=` from `decideTier(state)` with no request. If the user asks for a lower tier, the model sees `tier=high` but gets the low budget. I kept the block verbatim, as the packet asked. B01 or the integrator should decide whether `stateBlock` takes the decided tier.
2. **Weather fallback for a missing forecast.** The packet says to use that day's cached decision or `false`. docs/02 says to keep yesterday's decision. I followed the packet and S05 (`false`, logged as `catchup_weather_missing`). S10-06 suggests "protected rest when unknown". This needs a decision.
3. **Demo Truffles** ignore real heat (they start unburrowed, and the heat toggle drives them). Demo midnights pass `burrowed_tomorrow=false`.
4. **The pairing hash** is `SHA-256("truffle:" + phrase)`, salted for domain separation. Fine for new Truffles, but anything else that derives DO ids must use the same function.
5. **`wrangler dev` needs `--ip 127.0.0.1`** on this laptop. Without it, workerd fails with `bind(): Cannot assign requested address`. The README says so.
6. **Not live-tested:** the >14-midnight debt path and the alarm retry. Their logic follows S05, but only the normal midnight was observed firing. A workers-pool DO test harness (`@cloudflare/vitest-pool-workers`) was not added, so DO behaviour is covered by the e2e above, not by unit tests.
7. Other S10 items (8 to 20) are left for Thursday, as instructed.

No secrets were written to any file. `.dev.vars` was not created, `wrangler deploy` was not run, and there were no git operations.
