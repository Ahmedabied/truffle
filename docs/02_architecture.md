# 02 - Architecture

Status: **settled 2026-10-07**. Ahmed's instruction: all app infrastructure on Cloudflare for speed and future features (country detection, weather switching). The model does **not** run on Cloudflare; it runs on a serverless GPU.

## Diagram

```
+-------------------+     steps_today_total      +----------------------------------------+
| Samsung phone     | -------------------------> | Cloudflare Worker  (worker/)           |
| Health Connect    |   POST /feed {phrase,..}   |  - routes, pairing, rate limit          |
| Tasker (day 1) or |                            |  - geo from request.cf                  |
| Kotlin feeder app |                            |  - weather (Open-Meteo), cached per day |
+-------------------+                            |  - brain router (Modal -> Workers AI)   |
                                                 +-------------------+--------------------+
+-------------------+   GET /, /demo, WS/SSE     |                   |
| Cloudflare Pages  | <--------------------------+   Durable Object  v  one per Truffle
| ASCII world (web/)|                            |  TruffleDO (SQLite storage, alarm)      |
| vanilla TS        | --------------------------> |  - energy engine (pure, tested)         |
+-------------------+   POST /chat               |  - memory facts, history7, gravestones  |
                                                 |  - midnight alarm (local tz)            |
                                                 +-------------------+--------------------+
                                                                     |
                                   OpenAI-compatible /v1/chat        v
                        +--------------------------------------------+-----------------------+
                        | Modal (brain-modal/)                       | Workers AI (fallback)  |
                        | vLLM + Gemma 4 31B IT (FP8) + Truffle LoRA | @cf/google/            |
                        | scale-to-zero, memory snapshots            | gemma-4-26b-a4b-it     |
                        | enable_thinking per request                | "half-awake" mode      |
                        +--------------------------------------------+------------------------+
```

## Components

### worker/ (Cloudflare Worker + Durable Object)

- **Runtime**: Workers, TypeScript, Hono for routing (small). `wrangler.jsonc` with a Durable Object binding `TRUFFLE` (class `TruffleDO`, SQLite backend), an AI binding for the fallback, and secrets `MODAL_URL`, `MODAL_TOKEN`.
- **Routes**:
  - `POST /pair` -> creates a Truffle, returns `{phrase, tz, country, lang}`. Timezone, country and lang defaults from `request.cf.timezone / country`. Coordinates from `request.cf.latitude/longitude` until the feeder sends better ones.
  - `POST /feed` `{phrase, steps_today_total, lat?, lon?, device_tz?}` -> engine `feed`. Rate limit 60/hour per phrase. Returns the new state summary so the feeder can show it.
  - `POST /chat` `{phrase, message, requested_tier?, lang?}` -> engine decides tier -> brain router -> reply + state. Streams via SSE so the typing effect is real.
  - `GET /state?phrase=` -> full world state for rendering.
  - `POST /demo/spawn`, `POST /demo/slider`, `POST /demo/midnight`, `POST /demo/heat`, `POST /demo/reset` -> judge mode. Demo DOs carry a `demo=true` flag and a 24h self-delete alarm.
  - `POST /spore` -> new spore after death.
- **TruffleDO**: holds state in SQLite tables `state`, `facts`, `history`, `gravestones`, `log`. One alarm: next local midnight (computed from IANA tz). The alarm handler runs the midnight tick, fetches tomorrow's weather, decides `burrowed`, reschedules.
- **Engine**: `worker/src/engine.ts`, pure functions over a plain state object. No fetch, no Date.now inside (time is passed in). This is what the golden tests hit.
- **Brain router**: tries Modal with a 25s timeout for first token. On timeout or 5xx it falls to Workers AI with the same system prompt and returns `half_awake: true`. Logs which brain answered (for the write-up's honesty section and for the Sentry-style stats we may show).
- **Prompt builder**: system prompt = Truffle's fixed persona header (short, the LoRA carries the voice) + the **state block** + memory facts allowed by tier + language instruction. `enable_thinking` only for tier high. `max_tokens` by tier.
- **Fact extraction**: after medium/high replies, one cheap Workers AI call with a strict JSON schema: `{facts: string[]}` (max 3). Stored with `day_written`.

### web/ (Cloudflare Pages)

- Vanilla TypeScript + Vite. One page. `<pre>` ASCII grid sized to the viewport (portrait first).
- Scene layers and timing in `web/src/scene/*`. The world is a 100 x 68 luminance raster dithered into glyphs (decision 0011); the Truffle is a lit model in `web/src/scene/pet.ts`, shaded per cell for every stage and mood.
- State polling every 30s plus after each chat. SSE for chat.
- Sky colour from local hour (the user's tz from `/state`). Clouds drift with Open-Meteo wind speed. Rain glyphs when precipitation > 0.
- Judge mode UI at `/demo`: slider, midnight, heat, reset, and a small "what's happening" line explaining the engine's decision ("energy 42% -> medium, thinking off").
- Accessibility: `prefers-reduced-motion`, font size control, Arabic RTL for chat text (the ASCII world stays LTR).

### feeder-android/ (Kotlin)

- Minimal app: pairing phrase field, "Feed now" button, status line, hourly background sync.
- Health Connect: `aggregate(StepsRecord.COUNT_TOTAL)` from local midnight to now. Permissions: `READ_STEPS` plus `READ_HEALTH_DATA_IN_BACKGROUND` (Android 15+) for the WorkManager hourly job. Rationale activity declared (required by Health Connect).
- Posts `steps_today_total` with device tz and (optional, user-enabled) coarse location.
- Sideloaded APK via GitHub Release. Not on Play, so no Play declaration form.
- **Day-1 bridge**: Tasker + the TaskerHealthConnect plugin (sideloaded from its GitHub releases) reading aggregated steps and firing an HTTP Request action to `/feed` every hour and on screen-on. This gets real steps flowing Thursday while the Kotlin app is built.
- Samsung Health must be allowed to write to Health Connect (Samsung Health > Settings > Health Connect > Allow all). First-run checklist in the README.

### brain-modal/ (Modal)

- One Modal app, class-based with `@modal.cls(gpu="L40S")` (48GB) running vLLM `serve` in OpenAI-compatible mode.
- Model: `RedHatAI/gemma-4-31B-it-FP8-dynamic` (weights ~31GB) cached in a Modal Volume. LoRA: `--enable-lora --lora-modules truffle=/vol/adapters/truffle --max-lora-rank 16`.
- Flags: `--reasoning-parser gemma4 --chat-template tool_chat_template_gemma4.jinja --max-model-len 16384`. Thinking controlled per request with `chat_template_kwargs: {enable_thinking: bool}`.
- Memory snapshots enabled for fast cold starts. `scaledown_window` 300s during build days, 900s during judging week. `min_containers=0`.
- Auth: a bearer token checked by a small proxy function in front of vLLM (Modal web endpoint), so the Worker is the only caller.
- **Plan B** if LoRA on the FP8 checkpoint fails to load in current vLLM: merge the LoRA into bf16 weights on the training GPU, upload to a private HF repo, serve `google/gemma-4-31B-it` merged weights with `--quantization fp8` on `A100-80GB`. Decision point: Thursday noon (fleet spike S01).
- **Plan C** (last resort for the demo): serve the un-tuned FP8 31B on Modal and carry the persona in the system prompt; keep the fine-tune as a documented experiment with its eval table. The post stays honest about which ran.

### Weather

- Open-Meteo `/v1/forecast?latitude=&longitude=&hourly=apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day&current=apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day&timezone=auto&forecast_days=2`. No key. Free tier < 10k calls/day. Cached in the DO for 30 minutes (current) and per day (burrow decision).

### Geo and language

- `request.cf.country`, `city`, `latitude`, `longitude`, `timezone`, `region` are available on every request with no permission prompt. Used for defaults only. The feeder can override coordinates and tz.

## Data and privacy

- Stored per Truffle: phrase hash, tz, country, lang, one coarse lat/lon, energy state, 7-day step history, up to 60 memory facts, gravestones, a short event log (last 200 events, for the stats panel and the write-up).
- Never stored: raw step records, a location trail, device identifiers, the chat transcript beyond the last 20 turns.
- Demo Truffles self-delete after 24h.

## Stretch: quests from OpenStreetMap (Saturday only)

- Overpass query within 1.5 km of the coarse point for `leisure=park`, `natural=beach`, `tourism=viewpoint`, `historic=*`, `amenity=place_of_worship`, `amenity=cafe`. Pick 3, pass as a list to the brain with "write a small quest for one of these, name the place exactly". Validate the named place against the list; discard if it invents one. Fallback quests need no places ("find three leaf shapes").

## Failure modes we design for

| Failure | Behaviour |
|---|---|
| Modal cold (5 - 90s) | UI shows yawn animation; first message answered by Workers AI with `half_awake` marker; next message warm |
| Modal down | Workers AI for everything, marker shown, event logged |
| Open-Meteo down | Keep yesterday's burrow decision; if none, `burrowed=false`; note in log |
| Health Connect permission revoked (auto-revoke after unuse) | Feeder shows a red line and a button to re-grant; Truffle says it is hungry, never that it is "broken" |
| Phrase guessed | Rate limit + the worst someone can do is feed your Truffle |
| DO alarm missed | Alarm handler catches up: runs as many midnights as were missed, each with that day's cached weather or `burrowed=false` |
