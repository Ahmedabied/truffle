# B03 result: web ASCII world, chat, judge mode

## Blocker found in the Worker (read first)

Commit `74508eb` ("Worker: per-IP spawn limit on /pair...") deleted four routes from `worker/src/index.ts`: `GET /state`, `POST /feed`, `POST /chat`, `POST /spore`. Commit `7b64090` has all four. The deployed Worker at `https://truffle.ahmed-abied.workers.dev` is the new build. All four return `404 {"error":"not found"}` there now:

```
GET /state?phrase=a-b-c -> 404 {"error":"not found"}
POST /feed -> 404 {"error":"not found"}
POST /spore -> 404 {"error":"not found"}
POST /chat -> 404 {"error":"not found"}
$ for r in 7b64090 74508eb; do git show $r:worker/src/index.ts | grep -c 'app.post("/chat"\|app.get("/state"\|app.post("/feed"\|app.post("/spore"'; done
7b64090: 4
74508eb: 0
```

The web app cannot chat, poll or plant a spore against prod until those routes come back. I did not touch worker/. Before that commit landed, the same flows worked end to end (see "Real Worker runs" below).

## What was done

All writes are in `web/` (spike untouched) and `fleet/outbox/B03/`. No git commands that change state were run. No runtime dependencies were added.

- `web/src/api.ts`: typed client for every route. Chat SSE is read with fetch and a ReadableStream. The parser handles `\r\n`, split chunks and multi-line data. Requests time out after 12 s. The chat stream times out after 90 s of silence. `connect()` checks `GET /health` (3 s). If that fails, or with `?mock=1`, it uses the offline demo.
- `web/src/mock.ts`: offline demo backend. It imports the real `worker/src/engine.ts`, so tiers, moods, feeding, midnight, death and spores follow the exact Worker rules. Only the replies are canned (en and ar, per tier). It emits the same SSE event sequence as B02 (`brain`, `token`, `done`). Every fifth reply, or `?cold=1`, is slow and half-awake to exercise the yawn. Debug parameters: `scene=`, `hour=`, `rain=1`, `wind=`.
- `web/src/scene/`: `grid.ts` is the S08 cell probe (40 `M` at 100 px, then a spacing correction, refit on resize and fonts ready). `sky.ts` gives the local hour in the Truffle's tz and the palettes. `world.ts` does composition and the loop. Layers from back to front: stars, clouds (count by weather code, drift by wind), sun or moon on an arc by local hour, heat shimmer on burrowed days, horizon, sand with tufts for OM AE SA QA KW BH (and on burrowed days) or grass elsewhere, rain when `precipitation_mm > 0` (slanted above 20 km/h), past gravestones as a row of `n`, the Truffle, and the HUD (block-glyph bar, percent, stage, steps, tier word). The loop is a 12 fps rAF deadline that drops missed frames. It does one `textContent` write per frame, and only when the string changed. A state change also draws at once.
- `web/src/sprites.ts`: S08 art per stage (Spore, Sprout, Truffle, Elder) with eye and mouth templates per mood. Asleep and affectionate Truffle are the S08 sprites (lean, raised arm, `<3`). Tired gets heavy lids. Wilting gets a curled leaf and the world turns grey (CSS grayscale on the grid). Yawn gets closed eyes, a mouth that opens and closes, and a stretch `~`. Burrowed shows a mound, a curled `(-.-)` underground, `z/zz/zzz`, and shimmer. Dead shows a gravestone with RIP and the stage, with days and lifetime steps engraved below it. The favourite memory is shown under the world in HTML.
- `web/src/chat.ts`: single input line with `dir="auto"`. Replies reveal by grapheme (Intl.Segmenter) at 40, 25 or 12 ms for low, medium and high, times 1.5 when tired or wilting. The speed tier is computed with the engine's `decideTier`, which is the same rule the Worker uses. Asleep shows one grey line and blurs the input. Yawn starts when no token arrives within 3 s, or when the `brain` event says `half_awake`, and holds at least 1.5 s. A "half-awake (fallback brain)" pill appears in the header. The explanation line is built from the done event, for example `Energy 45% so medium effort. Thinking off. Cost 60.` It adds "You asked for high." when the request was capped, and a line when `partial` is true. A stream that closes without `done` or `error` shows the calm error line instead of hanging.
- `web/src/main.ts`: boot. Pairs if no phrase is stored. On 401 or 404 it drops the stored pair and pairs again. Polls `/state` every 30 s, after each chat, and when the tab becomes visible. Language toggle (ar/en): UI is RTL in Arabic, the world stays LTR. The language is sent with every chat. Text size control (0.85x to 1.5x, stored). Reduced motion is the system preference OR a stored checkbox. Settings panel: phrase as text, copy button, text size, motion, API base (saved, then reload), "plant a new spore" when dead, "forget this Truffle". Judge mode at `/demo` or `?demo=1`: steps slider 0 to 15000 (350 ms debounce), next midnight, heat toggle (aria-pressed), reset, an "ask for effort" select to show capping, and the explanation line. In demo mode the controls sit right under the world. Demo creds are stored separately with `expires_ms`.
- `web/src/copy.ts`: all UI copy in English and Gulf Arabic. Stage, tier and mood words in both. Explanation builders for chat, steps, midnight, growth and heat. No shaming words. Death reads "Truffle went back to the soil".
- `web/index.html`, `web/src/style.css`: mobile first, max width 520 px, 44 px touch targets, light and dark schemes. The S08 font stacks are used: mono for the grid, Noto Sans Arabic first for chat.
- `web/wrangler.jsonc`: Workers static assets, name `truffle-web`, `assets.directory: ./dist`, `not_found_handling: single-page-application` so `/demo` serves the app. Not deployed.
- `web/vite.config.ts`: adds `server.fs.allow: [".", "../worker/src"]` so the dev server can serve the engine import.
- `web/README.md` updated.

## Evidence

```
$ npm run typecheck
> tsc --noEmit
(no output, exit 0)

$ npm run build
dist/index.html                  4.32 kB │ gzip:  1.36 kB
dist/assets/index-BK2Xp3Vh.css   4.37 kB │ gzip:  1.66 kB
dist/assets/index-CQtXe7ZZ.js   39.21 kB │ gzip: 15.50 kB
✓ built in 85ms
```

Bundle: **39.2 KB JS** (15.5 KB gzip). The limit is 100 KB. That includes the engine and the offline demo.

Headless Chrome 390 x 844, DPR 2, mobile emulation, `npm run dev` on 5173, offline demo. The harness is `raw/cdp.py`. Full log: `raw/mock_run.txt`.

```
PASS content scene boots in mock mode
PASS grid is exactly 40 x 28
PASS offline demo marker is visible
PASS grid width fits the viewport, no overflow
PASS content face drawn
PASS world is LTR
PASS grid mutations in 2 s at 12 fps cap: 2      (unchanged frames are skipped)
PASS reply starts typing
PASS explanation line after reply: Energy 45% so medium effort. Thinking off. Cost 60.
PASS reply revealed progressively (7 then 74 chars)
PASS mock charged 60 for medium
PASS asleep mood
PASS asleep reply is one grey line
PASS input loses focus after asleep reply
PASS burrowed: mound and heat shimmer
PASS dead: gravestone with age and steps engraved
PASS plant a new spore button visible when dead
PASS chat input disabled when dead
PASS new spore planted
PASS gravestones kept after new spore
PASS wilting greys the world
PASS affectionate hearts and wind-slanted rain
PASS elder flower
PASS Arabic: UI RTL, world stays LTR
PASS Arabic text in the input resolves RTL via dir=auto
PASS English text in the input resolves LTR via dir=auto
PASS Arabic reply renders RTL
PASS yawn face while waiting over 3 s
PASS half-awake marker shown
PASS reduced motion: frame is static (no drift, no rain fall)
PASS reduced motion: reply appears without a per-letter reveal
PASS demo page boots
PASS judge controls shown at /demo
PASS slider feeds 12000 steps (debounced)
PASS grew to Sprout
   why: 12,000 steps today. Energy 100%. Next reply: high effort. It grew into a Sprout.
   why: Midnight passed. Burned 3000. Energy 75%. You beat your average, so affection went up.
PASS heat toggle burrows
PASS world redraws as burrowed after heat toggle
   why: Heat day. Truffle burrows. No growth today and it cannot die today.
PASS midnights with no steps kill the demo Truffle
   why: Four empty midnights in a row. Truffle went back to the soil. It has a small stone now.
PASS reset gives a fresh spore
PASS no page exceptions or console errors (0)
40 of 40 checks passed
```

### Real Worker runs

1. Local `wrangler dev` on 8787, before `74508eb` (`raw/real_run_local8787.txt`). Real pair, state, an asleep chat, demo spawn, slider and midnight all went through the UI:
```
PASS real: main page pairs and loads state
   summary: {"mood": "asleep", "tier": "asleep", "energy_pct": 0, "tz": "Asia/Muscat", "country": "OM", "lang": "ar", "city": "Muscat"} {"text": "33C clear, Muscat", "apparent_c": 32.8, "daytime_max_c": 40.6, "precipitation_mm": 0, "wind_kmh": 4.5, "is_day": false, "weather_code": 0}
PASS real: not in mock mode
   reply: خخ... يحلم بصوت خطواتك... خخ...
   why: الطاقة 0٪ فترافل نايم. ما فيه نداء للنموذج. التكلفة 0.
PASS real: demo spawns
PASS real: slider drives /demo/slider
   why: 9,000 steps today. Energy 75%. Next reply: high effort. It grew into a Sprout.
   why: Midnight passed. Burned 3000. Energy 50%. You beat your average, so affection went up.
```
The high-tier chat on local dev produced no text. With curl, local dev sent `event: brain {"brain":"workers-ai","half_awake":true}` and then closed the stream with no `token`, `done` or `error`. That is likely Workers AI in local dev. The client now shows the error line in that case.

2. Deployed Worker, by curl, before the routes were removed. A demo Truffle, 9000 steps, a high tier, then the SSE stream:
```
high 75 Sprout
event: brain
data: {"brain":"workers-ai","half_awake":true}
event: token
data: {"t":"I"}
event: token
data: {"t":" am"}
...
```
3. Deployed Worker through the UI (`npm run dev` with `VITE_API_BASE=https://truffle.ahmed-abied.workers.dev`, `raw/real_prod_run.txt`). Pair and demo spawn and slider worked. Chat failed with the 404 from the blocker above. A fetch from inside the page returned `404 {"error":"not found"}`. Rerun once `/chat`, `/state` and `/spore` are back.

## Screenshots (fleet/outbox/B03/raw/, gitignored, 390 x 844 at DPR 2)

- `01_content.png`: day, Muscat sand with tufts, sun, two clouds, content Truffle, HUD `45% Truffle 4120st medium`, the localized HUD line below, and the "offline demo" pill.
- `02_content_after_chat.png`: an English medium reply typed out, with the explanation line under the input.
- `03_asleep.png`: night sky, stars and moon, flattened sleeping Truffle with floating `z`, grey sleepy line, "Truffle is asleep. A walk wakes it." placeholder.
- `04_burrowed.png`: hot sky, rows of `~` shimmer, no tufts, mound `_.-^^-._` with `(-.-)` under it and `z`. HUD says "burrowed from the heat".
- `05_dead.png`: grey dusk, gravestone `RIP / Truffle`, `12 days` and `34120 steps` engraved below, one small past stone `n`, "It remembered: ..." line, "Plant a new spore" button, disabled input reading "Plant a new spore to talk again."
- `06_new_spore_with_stones.png`: a fresh Spore after planting, with two small stones in the sand.
- `07_wilting.png`: greyed world, small eyes, `~~` mouth, curled leaf.
- `08_affectionate_rain.png`: dusk rain slanted by 30 km/h wind, four clouds, leaning Truffle with rising `<3`.
- `09_elder_dawn.png`: dawn palette, Elder with cracks and flower.
- `10_arabic.png`: UI in Arabic and RTL (header, HUD words, reply, placeholder, button, explanation), world still LTR.
- `11_yawn.png`: yawn face `-  -` with `()` mouth and "Truffle is waking up..." after 3 s of waiting.
- `12_half_awake_marker.png`: the "half-awake (fallback brain)" pill after the reply.
- `13_demo_fresh.png`: `/demo` with a fresh Spore asleep and the judge controls under the world.
- `14_demo_heat.png` (full page): a Sprout at 75%, heat day on, explanation line.
- `15_demo_dead.png` (full page): Sprout gravestone (7 days, 12000 steps), the explanation of four empty midnights, and the spore button.
- `20_real_main.png`, `21_real_demo.png`: real Worker runs (the chat error in 21 is the 404 blocker).

## Differences between the brief's contract and B02's real routes (I followed B02)

- `/state`, `/pair`, `/demo/*` return `{state: {engine fields}, mood, tier, energy_max, energy_pct, tz, country, lang, city, demo, local_day, next_midnight_ms, weather, expires_ms?}`. The engine fields are nested under `state`, not flat. There is no `state_block`, `brain_last` or `half_awake` in the summary, so the half-awake pill comes only from chat events.
- Weather fields are `apparent_c`, `daytime_max_c`, `precipitation_mm`, `wind_kmh`, `is_day`, `weather_code`, `text`. The brief had `current_apparent_c`, `precipitation_now`, `wind_now`.
- Chat SSE: `event: brain {brain, half_awake}` first, `event: token {"t": ...}` (not `text`; both are accepted), `event: done {tier, brain, half_awake, spent, partial, summary}`, and `event: error {error}`. The brain name for asleep is `"none"`.
- `/demo/heat` takes `{phrase, on: boolean}`, not `burrowed`.
- `/pair` and `/demo/spawn` accept optional `tz` and `lang` in the body. The client sends the browser's tz. Both are rate limited per IP (5 per hour, 20 per day, 429 with a readable message, which the UI shows).
- `/chat` on a dead Truffle is 409. A second chat while one streams is 429.
- `/demo/midnight` always starts the new day not burrowed, so heat must be toggled again after time travel. The explanation reflects that.

## Open questions

1. **CORS for the deployed site.** The Worker allows localhost, 127.0.0.1 and `*.truffle.pages.dev`. A Workers static assets site at `truffle-web.ahmed-abied.workers.dev` must be added to `ALLOWED_ORIGINS`, or the app falls back to the offline demo. The same goes for phone testing over the LAN with `npm run dev`: the origin is the laptop's IP, which is not allowed.
2. The grid HUD row is ASCII English (`45% Truffle 4120st medium`). Arabic never goes inside the grid (S08 finding). Arabic HUD words are in the HTML line under the world. Is that acceptable for "Arabic HUD words"?
3. Arabic stage names I chose: بذرة, برعم, فقعة, معمّرة. Please check them.
4. Phone checks are the integrator's: font fallback widths, 12 fps feel, TalkBack, RTL keyboard.
5. The offline demo shows canned replies. It is clearly marked, but judges who land there will not see the real brain. The prod build points at the deployed Worker by default.

Cost: $0.
