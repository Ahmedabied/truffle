# B13 RESULT: moments, share card, app hand-off

Builder: Opus. Date: 2026-10-08, night wave. No commit, no deploy. Files touched are all in web/, outside web/src/scene/.

## What was done

1. **Moments.** `web/src/moments.ts` defines `Moment` and `MomentKind` exactly as decision 0017 writes them. It also has pure helpers:
   - `momentsOf(summary)` reads `summary.moments` as optional (missing means none), keeps valid known kinds and sorts by ascending id.
   - `pickNew(moments, lastId, now)` decides what to show:
     - It shows every moment above the remembered id, in order. At most the newest 3 show in one go.
     - First sight with moments already present: only the newest shows, and only if it is under 6 hours old. No flood on a returning phone.
     - First sight with no moments: the page remembers id 0, so every later moment shows.
     - Ids that went backwards (a reset Truffle): treated as first sight.
   - The last id is stored in localStorage under `truffle.moment.last.<phrase>`.

   In `main.ts`, every `render()` runs `onMoments()`. Each new moment does two things in turn:
   - It calls `world.celebrate(kind, value)` when that is a function, inside try/catch. It is skipped under reduced motion.
   - It shows one fixed line under the HUD for 6 s, with a fade-in that reduced motion turns off.

   The line has role status. Tapping the HUD (role button, Enter or Space) opens "Moments", the last 5, newest first. The line re-renders when the language switches.
2. **Copy.** `copy.ts` gets `momentLine(lang, kind, value)` and `momentNum` (Latin digits in English, Arabic-Indic in Arabic), plus new keys: moments, momentsShow, momentsEmpty, share, shareMaking, shareFailed, shareTag, openApp, getApp. The moment lines are lowercase, with no exclamation marks, no emoji and no dashes, and they carry the number:
   - en: `best day this week. 7,420 steps.` / ar: `أفضل يوم هالأسبوع. ٧٬٤٢٠ خطوة.` (matches the packet exactly)
   - stage_up `it grew. sprout now.`, beat_avg7 `past your usual day. 6,100 steps.`, day_10k `ten thousand today. 10,240 steps.`, streak `7 walking days in a row.`, lifetime `50,000 steps together so far.`, heat_day_indoor `a hot day, and you still moved. 2,300 steps.`, each with an Arabic twin.
3. **Share card.** `web/src/share.ts` draws a 1080 x 1350 PNG on an offscreen canvas:
   - The world as text, using each layer's computed colour and opacity.
   - The world's gradient, parsed from computed style.
   - The newest moment line and the HUD line.
   - "truffle, a pet that eats steps" and the host. On localhost the host falls back to `truffle-web.ahmed-abied.workers.dev`.
   - Arabic runs right to left on the card.

   Input order: `world.frame()` if B15 adds one (it handles a canvas, a string or a record of layer strings), else the `<pre>` layers, else a `<canvas>` inside `#world`. Delivery uses `navigator.share({files})` when `canShare` allows it, and a download otherwise. An AbortError counts as cancelled. No libraries. The share button sits under the HUD.
4. **Creds from the app.** `web/src/handoff.ts`:
   - `parseCredsHash` checks the phrase against `^[a-z]{2,20}(-[a-z]{2,20}){2}$`. It checks the secret as base64url, 8 to 128 chars, which also admits the offline demo's secret. It splits on the first dot.
   - `takeCredsFromHash` runs in `main.ts` right after the storage helper is defined, before app state, pairing or anything else reads the URL. It stores `{phrase, secret}` under `truffle.creds`, the same key and shape `ensurePaired` uses. Then it calls `history.replaceState` to drop the fragment. A malformed `#creds=` is stripped too and saves nothing.
5. **App hand-off.**
   - `offerApp(ua, {demo, mock, paired})` is true only on Android, outside the app (no `TruffleApp/` in the UA), for a real paired Truffle. Judge mode and the offline demo never get it.
   - When true, the page shows "Open in the Truffle app" and "Get the Android app" (the releases page link). The `truffle://pair?creds=...` link is built only at click time, so the secret never sits in the DOM.
   - Inside the WebView, `html.in-app` hides the controls marked `.pairing`: the phrase label and row with Copy, and the "Forget" button. The app link is never shown there.
6. **Mock.** `mock.ts` now carries `moments` in its summary.
   - A small stand-in for `momentsFor` covers stage_up, best_day, beat_avg7, day_10k, heat_day_indoor, lifetime and streak at midnight. It uses once-per-day guards and persists in localStorage.
   - A new debug knob `?moment=<kind>[&mv=<value>]` adds one fresh moment. The README documents it.
7. **Kept:** the DOM sink test is green; the new code uses only textContent, createElement and replaceChildren. Reduced motion is kept, and RTL is kept (the moment line and list are `dir="auto"` inside the RTL app).

## Commands and output

```
$ cd web && npm test
 Test Files  6 passed (6)
      Tests  123 passed (123)
```
That is the old suite (57 now, because the sink scan covers the 3 new source files: 54 + 3) plus 66 new tests:
- `test/handoff.test.ts`: the parser with 16 refusal cases, the hash strip, UA detection, the offer rules, and a link round trip.
- `test/moments.test.ts`: momentsOf, pickNew (in order, no repeats, first sight, burst cap, reset), recent, and the copy voice rules for all 7 kinds in both languages.
- `test/share.test.ts`: gradient parsing (hex and rgb), host fallback, file name, and the tagline.

```
$ npx tsc --noEmit && echo TSC_OK
TSC_OK
$ npm run build
dist/index.html                  5.24 kB │ gzip:  1.60 kB
dist/assets/index-CngvN20F.css   5.65 kB │ gzip:  2.04 kB
dist/assets/index-S1aiYp2k.js   79.12 kB │ gzip: 31.84 kB
✓ built in 99ms
```

Browser checks were run on vite dev (port 5199, now stopped) through chrome-devtools in an isolated context at 412 x 915 mobile:
- `/?mock=1&moment=best_day&hour=10`: the line shows under the HUD. See `moment_line_en.png`.
- `/?mock=1&moment=day_10k`, in Arabic, with the HUD tapped open: Arabic line plus the list of 2. See `moment_line_ar_with_list.png`.
- `window.truffle.card()` (a new read-only hook that returns the card as a data URL) was decoded to `share_card_en.png` and `share_card_ar.png`. `file` reports `PNG image data, 1080 x 1350`.
- App WebView UA (`... TruffleApp/0.2`) at `/?mock=1#creds=sand-moon-fig.Ab3_x-9QzLm2Rt7Yp0Kq1w`:
  ```
  {"href":"http://localhost:5199/?mock=1","stored":"sand-moon-fig","storedSecretLen":22,"inAppClass":true,
   "phraseRowVisible":false,"forgetVisible":false,"appBtnVisible":false,"getAppVisible":false,"shareVisible":true}
  ```
  The fragment is gone, the creds are stored and the pairing UI is hidden. No console errors or warnings.
- Judge mode `/demo?mock=1&scene=fresh`, slider to 10,500. The lines play in order, 6 s each:
  ```
  ["(hidden)","it grew. sprout now.","ten thousand today. 10,500 steps.","10,000 steps together so far."]
  ```

## Screenshots (this folder)

- `moment_line_en.png`: the moment line under the HUD, English.
- `moment_line_ar_with_list.png`: the Arabic line and the open moments list, RTL.
- `share_card_en.png`, `share_card_ar.png`: the 1080 x 1350 share cards.

## Open questions

1. **Value meanings.** For best_day, beat_avg7, day_10k and heat_day_indoor, I read `value` as steps today, and for lifetime as the mark crossed. If B12 uses a different meaning (for example avg7 for beat_avg7), only `momentLine` needs a change.
2. **Phrase check.** The web checks the phrase's format, not the 2,000-word list, to keep 21 KB of words out of the bundle. A wrong word gets the Worker's calm 401 through the existing flow.
3. **Untested branch.** The Android Chrome "Open in the Truffle app" branch is covered by unit tests but not by a browser screenshot, because it is hidden on the offline demo by design. It needs a live Worker (or a phone) to see it.
4. **Celebration under reduced motion.** `world.celebrate` is not called under reduced motion. If B15 wants a still celebration there, drop the `!reduced()` guard in `nextMoment()` in main.ts.
5. **When B12 lands.** When B12 adds `moments` to `StateSummary` in types.ts, `momentsOf` still works unchanged. The mock's return type `StateSummary & { moments: Moment[] }` stays compatible as long as B12's Moment has the same shape.
6. **Packet conflict.** The packet's `truffle://pair?creds=` puts the secret in a query string of a custom-scheme URL. That follows decision 0016: the scheme is handled on the device and never reaches a server. No http(s) URL carries the secret.
