# Aggressive-user review

Date: 2026-10-09. Local app: `http://localhost:5191`. Independently explored the UI before inspecting implementation. Tested Chromium in an isolated profile/context, both `/demo?mock=1` and `/?mock=1`, plus the real transport with entirely synthetic credentials and intercepted `localhost:8787` routes. No public backend mutations, deployment, real credential reads, or production edits.

## Findings requiring attention

### P2 — A running real-pet session has no recovery affordance after a 404

1. Save synthetic real credentials under `truffle.creds`; mock health/state as 200 and open `/` successfully.
2. Change the mocked `/state` response to 404 and trigger a visibility-change refresh.
3. The explanation becomes generic “Something went wrong. Nothing changed.”, while `#recovery` stays hidden and Settings remains closed.
4. The `authLost` flag stops subsequent polling. A manual reload is still needed to retry this specific failure.

The startup credential-loss problem and ordinary 503 recovery were fixed and verified below; this is the narrower running-session authentication-loss branch. Show Retry and an appropriate identity/settings message there too. Reported immediately before this checkpoint. Source: `poll()` in `web/src/main.ts`.

### Resolved P1 — Startup 404 discarded the saved real identity

Original reproduction: saved synthetic real credentials, `/health` 200, `/state` 404, then `/pair` failure. Startup deleted the original credential before attempting the replacement, yet displayed “Nothing changed.” The implementation owner fixed this. A durable browser regression now confirms startup 404 preserves the credential, never calls `/pair`, and exposes Retry.

### Resolved P2 — Boot/network refresh errors needed a recovery path

Originally, a temporary boot failure left Send disabled with no Retry, and 503 polling errors left the old state silently visible. Browser regressions now verify boot Retry works after the server recovers, refresh failures show a stale-state notice, and Retry clears the notice on success. The real-pet 404 branch above remains a separate case.

### P3 — Arabic leaves English explanation and accessibility text behind

1. In English demo, Reset so the explanation reads “A fresh spore. Steps will wake it.”
2. Switch to Arabic.
3. The controls and HUD become Arabic but that explanation remains English. A pre-existing chat error also stays English.
4. The chat region is always named “Chat”. The world’s formerly English accessible description was fixed during this review; its Arabic regression passes.

Preserve actual chat response text, but rebuild generated explanations/errors from semantic state when the language changes. Localize the chat-region label. English weather text also remains mixed into the Arabic HUD.

### P3 — A malformed saved preference can prevent all recovery controls from loading

Repro in an isolated test context: set `truffle.lang` to the valid JSON string `"fr"`, then load the demo. Only the header appears; the page throws `Cannot read properties of undefined (reading 'title')`. Validate stored enum/number values and fall back to defaults. This needs a stale/malformed local preference, so it is a robustness issue rather than an ordinary interaction failure.

## Issues found, fixed by the implementation owner, and independently retested

| Issue | Minimal original reproduction | Retest |
| --- | --- | --- |
| Pending slider undid Reset | Move slider to 10,000, Reset within 350ms, wait: pet returned to 10,000/Sprout | Pass: zero-energy Spore and zero slider remain |
| Pending slider fed the next day | Move slider to 8,000, immediately Next midnight | Pass: new day remains at zero, queued feed is canceled |
| Canceled chat recreated an error | Set 12,000 steps; let feed finish; Send; Reset after 150–200ms; wait | Pass: reply/status stay blank, no stale charge |
| Canceled chat after first token leaked callbacks | Reset while a sample reply is appearing | Pass: old reply stays cleared |
| Reset retained an old chat cooldown | Mock chat 429 with 60-second wait, then Reset | Pass: input re-enables and countdown stays cleared |

## Verified behavior

`web/test/browser.smoke.mjs` runs 20 genuine browser scenarios; final run: **20/20 passed**. It checks the fixed races, rapid slider changes, heat/progress persistence, no repeated moment on reload, separate main/demo mock progress, 320px English/Arabic layout at maximum app text size, preference persistence, actual canvas pixels under reduced motion, OS reduced-motion UI, downloadable PNG with explicit demo provenance, 429/500/401 chat recovery, invalid API-address rejection, boot Retry, background stale-state/retry, startup 404 identity preservation, and Arabic world descriptions.

Run against a local Vite server:

```sh
PLAYWRIGHT_MODULE=/home/abied/.npm/_npx/9833c18b2d85bc59/node_modules/playwright \
CHROME_BIN=/usr/bin/google-chrome \
node web/test/browser.smoke.mjs
```

The harness accepts `TRUFFLE_TEST_URL` for another loopback address, or an installed `playwright` module if `PLAYWRIGHT_MODULE` is omitted. It blocks nonlocal requests. The implementation owner is adding an explicit Playwright development dependency/npm script separately. The remaining findings above are separate manual reproductions, not covered by the passing 20 checks.

Additional manual checks: 320px layout still fits when body text is enlarged to 32px; downloaded demo PNG visibly says “simulated steps · demo Truffle”; heat state, chosen language, motion preference, font scale, and simulated progress survive reload. The original duplicated error in DOM text was one visible error plus the screen-reader copy, not two visible messages.

## Product suggestions from the skeptical-user pass

- Explain the ordinary root page’s offline simulation clearly. A small “offline demo” badge accompanies a seeded substitute pet; the fuller simulation explanation is hidden with judge controls. Offer an explicit demo choice and retain the last known real-pet state when reconnecting.
- Make the main purpose of walking/energy legible at first visit. The scene is atmospheric, but the HUD is a dense run of six facts and the clickable moments affordance is subtle. A short “Steps wake Truffle” explanation and a named “Recent moments” control would help discovery.
- Give Share a brief visible completion state after a download. The exported card itself successfully explains demo provenance, but the page provides little feedback after the click.
- Reconcile a rejected downward step-slider move immediately after release. The engine correctly keeps cumulative steps monotonic, but the focused control can temporarily display a smaller value than the actual HUD; the explanation is the only clue.

This is desktop Chromium emulation, not physical Samsung/iOS testing or a claim about mobile GPU performance. Native share sheets, assistive technology pronunciation, and actual OS browser zoom remain device checks.
