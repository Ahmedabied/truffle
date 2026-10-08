# B09 worker_hardening_round_2
Owner: opus        Wave: Thu Oct 8 evening        Due: Thu 2026-10-08 21:00 Oman

## Goal
Apply the S11 red-team findings that need no owner decision. Keep all 238 tests green and add a test per finding.

## Inputs
Read first: CLAUDE.md, fleet/outbox/S11/RESULT.md (findings 01, 02, 05, 06, 08, 09, 11 and the Verified section), fleet/outbox/S11/proposed_tests.md (test IDs D01, D02, D03, D07, M03, P01, D09, R02), decisions/0013_state_block_shows_charged_tier.md, fleet/outbox/B06/RESULT.md. Code: worker/src/*.ts, worker/test/*.ts. Repo: ~/Desktop/Truffle. Tests: `cd worker && npm test`.

## Deliverable (all in worker/)
1. S11-01 and S11-02, chat identity and fencing. Every admitted chat gets an id and the pet generation at admission. Quota (demo replies, rate) is reserved at admission. Only that id may complete, charge, write the transcript, run fact extraction or release the lock. A deadline cancels the old inference (AbortController on the brain fetch) before a new slot opens. A completion from an older generation (after death, new spore or demo reset) is discarded: no energy charge, no transcript, no facts. Tests D01, D02, D03.
2. S11-06, visible text predicate. One shared predicate for "the reply has visible text" used by retry, success and error paths. Charge only when visible text exists. Empty then visible: two calls, one charge. Both empty: two calls, no charge, not counted as a demo reply. Whitespace then exception: no charge. Test D07.
3. S11-08, rolling memory. Adding a 61st distinct fact evicts the oldest. Duplicates do not evict. Bound stays 60. Test M03.
4. S11-09, decision 0013. `stateBlock` takes the admitted tier; the DO passes the tier it charges. Memory window, token cap, thinking and cost follow it. Original 30 goldens unchanged (they pass no requested tier). Test P01.
5. S11-11, weather single flight. One in-flight forecast refresh per object, bounded failure backoff (start 5 minutes, double to 1 hour), responses fenced by coordinate revision so an old point's forecast cannot overwrite a newer one. Feed never calls the forecast directly. Test D09.
6. S11-05, auth lookups. Rate-limit failed phrase lookups per IP before any object access (30 per minute, then 429). Keep byte-identical 401 bodies. Remove the "same timing class" claim from worker/README.md and the code comments; say bodies are identical and lookups are rate-limited. Test R02 for the limiter.

## Acceptance
`npm test` green, count pasted. `npx tsc --noEmit` clean. `scripts/smoke.sh` against `wrangler dev --ip 127.0.0.1 --port 8787` passes, output pasted.

## Do not
Do not change burrow or missing-forecast policy (S11-03, owner decision pending). Do not make `day` required yet (S11-04 waits for the feeder B07 to ship the envelope). Do not change the 50,000 cap (S11-10, owner decision). Do not touch web/, feeder-android/, finetune/. Do not edit any existing golden. Do not commit. No co-author trailers. No em or en dashes.

## Report
fleet/outbox/B09/RESULT.md: per item what was done, evidence, open questions, cost (0).
