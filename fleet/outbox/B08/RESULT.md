# B08 RESULT: web reads the Worker error contract, phone prep

Status: **done, all 5 items**. Nothing committed. Nothing deployed. Cost: 0 (no GPU, no model calls; every Worker response in the browser check was mocked locally, production was not called).

Tests: **0 before** (web had no test runner), **54 after**, all green. Typecheck clean. Build green.

## Files

| File | Change |
|---|---|
| `web/src/errors.ts` | **New.** `ApiError` now carries `hint` and `retry_after_s`. `apiErrorFrom` parses the B06 body. `describeError` turns an error into one calm line in the UI language, plus a wait, a "open Settings" flag and a "say it in Truffle's voice" flag. `waitText` ("Try again in N s.", Arabic forms). `Cooldown`, a wall clock countdown. `joinCalm` merges `error` and `hint` without repeated sentences. Pure, no DOM. |
| `web/src/fps.ts` | **New.** `fpsEnabled`, `FpsMeter` (one second window), `fpsText`. |
| `web/src/api.ts` | `ApiError` comes from `errors.ts` (re-exported). `errorOf` reads the body text and uses `apiErrorFrom`. |
| `web/src/chat.ts` | Chat failures go through `describeError`. Demo reply cap shows in Truffle's voice. 429 or 400 with a wait starts a countdown in the status line and disables the input and Send. 401 opens Settings. 409 on chat says to plant a new spore. |
| `web/src/main.ts` | `failed(e, ctx)` uses `describeError`. Judge controls and spore buttons share one countdown (`#judge button, #judge input, #sporeBtn, #sporeBtn2`). 401 opens Settings. Spore calls pass the `spore` context, so 409 says the Truffle is alive. `?fps=1` setup. HUD text moved into `#hudText`. |
| `web/src/mock.ts` | The offline mock throws a real `ApiError(409)` for a dead chat (it was a plain `Error` with a status field). |
| `web/src/scene/world.ts` | Only the fps hook: a `timing` callback, null by default, called at the end of `draw()`. No other scene change. |
| `web/index.html` | `#hud` holds `#hudText` and a hidden `#fps` span. |
| `web/src/style.css` | `.fps` style, only when not hidden. |
| `web/package.json`, `web/package-lock.json` | `vitest@5.0.3` (same version as `worker/`) and `"test": "vitest run"`. The packet says `cd web && npm test`, but no test script existed. |
| `web/vitest.config.ts` | **New.** Node environment, `test/**/*.test.ts`. |
| `web/test/errors.test.ts`, `fps.test.ts`, `no_html_sinks.test.ts` | **New.** |
| `docs/assets/2026-10-08_web_errors_*.png` | 7 screenshots (below). |

Nothing outside `web/`, `docs/assets/` and `fleet/outbox/B08/` was changed. The harness and its log are in `fleet/outbox/B08/raw/` (gitignored, like B03's).

## Per item

### 1. Error contract in `api.ts` and the callers

- `ApiError(status, message, hint?, retry_after_s?)`. `hint` is kept only if it is a non-empty string. `retry_after_s` is kept only if it is a positive finite number. It is rounded up and capped at 7 days. A body that is not a JSON object falls back to `statusText`.
- What the person sees (`describeError`):

| Case | English | Arabic |
|---|---|---|
| network or timeout | existing `networkError` line | existing Arabic line |
| 401 (any call) | "That phrase was not recognised. Check it in Settings." and Settings opens | "ما تعرّفنا على هذي العبارة. شيّك عليها في الإعدادات." and Settings opens |
| 409 on spore | the Worker text: "This Truffle is still alive. A new spore can only be planted after it dies." | "ترافل هذا لسه حي. البذرة الجديدة تنزرع بس بعد ما يموت." |
| 409 on chat (dead) | "Plant a new spore to talk again." | existing Arabic placeholder |
| 400 | the Worker `error` plus `hint` | "ما تغيّر شي. الطلب ما انقبل." |
| 429 | the Worker `error` (plus `hint` if any) | "ترافل يبي استراحة شوي." (or "واجد ترافلات جديدة من هنا." for the spawn limit) |
| 429 "one at a time" | the Worker text, no countdown | "ترافل لسه يرد على رسالتك الأخيرة. وحدة وحدة." |
| 500, 404, anything else | calm generic line, never the raw server string | calm generic line |

- The Worker only writes English, so Arabic uses fixed client lines per case. English shows the Worker's own calm text.
- **Countdown:** a 429, or a 400 with `retry_after_s`, shows "Try again in N s." and disables the button until then. Chat: the status line under the input counts down; input and Send stay off. Judge controls and spore buttons: the `why` line counts down; all judge buttons, the slider and the spore buttons stay off. When a countdown is shown, the Worker's own "Try again in 1 min." or "Sync again in 5 s." sentence is left out, so there is one number on screen, not two. Repeated sentences between `error` and `hint` are dropped ("Nothing changed." was in both).
- If a 429 has no `retry_after_s` (the spawn limit), the wait is read from the Worker's "Try again in 42 min." text.
- **"Feed" callers:** the web app never calls `/feed`. That is the feeder's route (B07). The web's step path is the judge slider (`/demo/slider`), which uses the same step admission and the same 400 shape. It is handled as above.
- **Format choice to confirm:** the packet says "try again in N s". I show seconds up to 90 s, minutes up to 90 min, then hours. "Try again in 86377 s." for the demo cap would not be readable. The countdown ticks every second either way.

### 2. Demo reply cap in Truffle's voice

On the demo page, a chat 429 that is the 30 replies cap (Worker text mentions replies, or the wait is an hour or more) is shown as a normal grey reply, not the warning colour:

- en: "I talked so much today that my voice is a whisper now. Let me rest a little, then come back."
- ar: "سولفت واجد اليوم وصوتي صار همس. خلني أرتاح شوي، وبعدين ارجع."

The status line under the input says "Try again in 24 h." and the input stays off until then. The same 429 on the real page is a plain rate line.

### 3. No HTML sinks

`grep` for `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `createContextualFragment` and `DOMParser` over `web/src` and `web/index.html` found **no cases** before this change. Facts never render in the web app except the gravestone memory. That memory, weather text, chat text and the ASCII world (gravestones included) were already set with `textContent`. Nothing needed fixing. To keep it that way, `test/no_html_sinks.test.ts` scans every `.ts` and `.html` file in the web app and fails on any sink. The browser check also feeds `<img src=x onerror=...>` as the gravestone memory and `<b>41C</b>` as weather text: both render as plain text, no element is created, the handler never runs.

### 4. `?fps=1`

- Off by default (the span is hidden and not rendered). With `?fps=1` the HUD line ends with `| 18 fps · compose 1.9 ms · paint 0.5 ms`, updated once a second, averaged over the last second.
- compose = `composeAll` time. paint = palette and DOM writes plus a forced style and layout pass (`offsetHeight`), measured in `World.draw` through the new `timing` hook. Browser raster and composite happen later and are not in it. The forced layout only runs when the flag is on.
- fps counts every `draw()` call: the 12 fps loop plus the extra draws after each state render. Headless Chrome showed 17 to 18. Read it on the Samsung as "frames drawn", not as display refresh.

### 5. Tests and build

Before (no runner in `web/`):

```text
$ cd web && npm test
No test files found, exiting with code 1
```

Test-first: the three test files were written first and ran red (`Test Files 2 failed | 1 passed (3)`: `src/errors` and `src/fps` did not exist), then the modules made them pass.

After:

```text
$ npm run typecheck
> tsc --noEmit
(no output)

$ npm test
 RUN  v5.0.3 /home/abied/Desktop/Truffle/web
 Test Files  3 passed (3)
      Tests  54 passed (54)
   Duration  153ms

per file: errors 32 (body parsing, retrySeconds, waitText, describeError per status and language,
          Cooldown countdown with fake timers, joinCalm), fps 4,
          no_html_sinks 18 (one per source file plus a count check)
```

Build:

```text
$ npm run build
dist/index.html                  4.40 kB │ gzip:  1.38 kB
dist/assets/index-C4e9fbWK.css   4.79 kB │ gzip:  1.79 kB
dist/assets/index-BkRVQxCb.js   67.14 kB │ gzip: 27.21 kB
✓ built in 57ms
```

HEAD (built from `git archive HEAD` in a scratch dir for comparison): JS 61.43 kB (25.01 kB gzip), CSS 4.65 kB. So this change adds about 5.7 kB of JS (2.2 kB gzip).

## Browser check (acceptance)

`npx vite preview --port 4173` on the built `dist/`, headless Chrome 390 x 844 at DPR 2 with mobile emulation, driven over CDP (same method as B03's `raw/cdp.py`). The API base is set to a same-origin path, `http://localhost:4173/__mock`, and every request under it is answered by the CDP `Fetch` domain. So the app runs its real backend code path (`mock() === false`) against mocked Worker responses. The state fixtures are taken from the app's own offline engine. Harness: `fleet/outbox/B08/raw/cdp_errors.py`. Log: `fleet/outbox/B08/raw/run.txt`.

```text
PASS demo page boots against the mocked Worker (not the offline mock)
PASS demo 429: reply in Truffle voice: I talked so much today that my voice is a whisper now. Let me rest a little, then come back.
PASS demo 429: not styled as an error
PASS demo 429: input and Send disabled
PASS demo 429: countdown line: Try again in 24 h.
  saved docs/assets/2026-10-08_web_errors_429_demo_voice.png
PASS 429 chat: Worker text shown, its own wait left to the countdown: Truffle needs a break: 20 messages per hour.
PASS 429 chat: "Try again in N s": Try again in 4 s.
PASS 429 chat: Send disabled during countdown
  saved docs/assets/2026-10-08_web_errors_429_chat_countdown.png
PASS 429 chat: countdown ticks (Try again in 3 s.)
PASS 429 chat: Send enabled again after the wait
PASS 429 chat: countdown line cleared
PASS 400 slider: why line: That is 9000 new steps since the last sync, more than 20 a second. Nothing changed. Your steps are still on your phone. Fix the request and sync again. Try again in 5 s.
PASS 400 slider: Worker hint shown
PASS 400 slider: judge controls disabled during countdown
  saved docs/assets/2026-10-08_web_errors_400_retry_countdown.png
PASS 400 slider: controls enabled again after the wait
PASS 400 slider: countdown removed from the why line
PASS 400 chat: error and hint, no countdown
PASS 400 chat without retry: input stays usable
PASS 429 Arabic: calm Arabic line
PASS 429 Arabic: Arabic countdown: جرّب بعد 12 دقيقة.
  saved docs/assets/2026-10-08_web_errors_429_arabic.png
PASS 401 chat: phrase not recognised
PASS 401 chat: Settings opened
PASS 401 chat: no new Truffle paired behind the user
  saved docs/assets/2026-10-08_web_errors_401_settings.png
PASS 401 boot: HUD says phrase not recognised
PASS 401 boot: Settings open, no new pair
PASS 401 boot: saved phrase kept for the person to decide
PASS 409 spore: Truffle is alive
  saved docs/assets/2026-10-08_web_errors_409_spore_alive.png
PASS fps readout hidden by default (not rendered)
PASS fps=1: readout: 18 fps · compose 1.9 ms · paint 0.5 ms
  saved docs/assets/2026-10-08_web_errors_fps_readout.png
PASS markup in memory and weather renders as text
PASS no uncaught page exceptions (0)
31 of 31 checks passed
```

The 400 slider case is a mocked jump-cap style body. The real Worker skips the jump cap for demo Truffles (B06 item 1), so on the live judge page a 400 with a wait is unlikely. The code path is shared with chat and spore, so it is covered either way.

Screenshots looked at by eye: the voice reply is grey, Send is dimmed, the countdown sits under the input; Arabic flows RTL with the Arabic countdown; Settings is open under the 401 line; the fps readout sits at the end of the HUD line in a monospace face. An earlier run showed a stray `|` after the HUD when fps was off (author `display` beat `[hidden]`); fixed with `.fps:not([hidden])` and the check now asserts `display: none`.

Dash check: no em or en dash in `web/src`, `web/index.html` or `web/test` (the tests match them with `–—` escapes).

## Behaviour change to confirm

**401 on the real page no longer pairs a new Truffle silently.** Before, any 401 or 404 on `/state` (poll or boot) deleted the saved phrase and paired a fresh Truffle. The packet asks that 401 says the phrase was not recognised and opens Settings, so on the real page it now does that, keeps the saved phrase, and stops polling. The person can fix the API address or press "Forget this Truffle on this browser" to start again. On the **demo page** an expired demo still gets a fresh one at once, since demo Truffles die after 24 h by design and the judge should not have to do anything. A 404 (older Worker) keeps the old re-pair behaviour on both pages.

## Open questions

1. Wait format: seconds up to 90 s, then minutes, then hours (item 1 above). Easy to switch to seconds only.
2. 401 on the real page: message and Settings, no silent re-pair (above). If the integrator prefers the old auto re-pair for real Truffles too, it is one branch in `poll()` and one in `ensurePaired()`.
3. Arabic lines are client copy, not the Worker's text. If the Worker grows an Arabic `error` later (by Truffle `lang`), `describeError` can prefer it.
4. The fps number counts all draws, not just loop ticks (item 4).
5. `web/package-lock.json` grew by vitest's tree (about 290 lines). No runtime dependency was added; the bundle is unchanged by it.

## Cost

0. No GPU, no model calls, no production requests.
