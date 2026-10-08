# B08 web_feed_errors_and_phone_prep
Owner: opus        Wave: Thu Oct 8 afternoon        Due: Thu 2026-10-08 18:00 Oman

## Goal
Make the web app read the Worker's new error contract and get it ready for the first phone check.

## Inputs
Read first: CLAUDE.md, docs/01_product_spec.md (UI copy rules), fleet/outbox/B03/RESULT.md, fleet/outbox/B06/RESULT.md (items 1, 2, 4, 6), decisions/0012_memory_as_untrusted_section.md, worker/src/index.ts and worker/src/do.ts (the error shapes: `error`, `hint`, `retry_after_s`, 400/401/409/429), web/src/api.ts, web/src/chat.ts. Repo: ~/Desktop/Truffle. Run tests with `cd web && npm test`, build with `npm run build`.

## Deliverable
1. `api.ts`: ApiError carries `hint` and `retry_after_s` when the body has them. Feed, chat and spore callers show the Worker's calm text, Arabic or English per the UI language, and for 429 or a 400 with `retry_after_s` show "try again in N s" and disable the button until then. 401 says the phrase was not recognised and opens Settings. 409 on spore says the Truffle is alive.
2. Demo page: when the 30 replies per day cap returns 429, show it in Truffle's voice, not as an error box.
3. Facts, weather, chat text and gravestones are rendered with `textContent`, never `innerHTML`. Grep and fix every case.
4. Phone prep: add a `?fps=1` query flag that shows a small frame-time readout in the HUD line (compose ms and paint ms, last second average), so Ahmed can read the frame rate on his Samsung. Default off.
5. Tests for the error parsing and the retry countdown. Existing tests still pass. `npm run build` output size pasted.

## Acceptance
`npm test` green, `npm run build` green, verified in headless Chrome against `npx vite preview` with a mocked 429 and 400 (screenshot in docs/assets/2026-10-08_web_errors_*.png). No innerHTML left for user or model text.

## Do not
Do not touch worker/, feeder-android/, finetune/, or the scene code in web/src/scene/ beyond the fps readout hook. Do not change the Arabic stage names (open decision). Do not commit; the integrator commits. No co-author trailers. No em or en dashes in UI copy.

## Report
fleet/outbox/B08/RESULT.md: what was done per item, evidence, open questions, cost (0).
