# B06 worker_hardening
Owner: opus        Wave: Thu Oct 8 midday        Due: Thu 2026-10-08 16:00 Oman

## Goal
Apply the S10 red-team items and the S03 retry that need no owner decision. Keep every existing test green. Add tests for every new rule.

## Inputs
Read first: CLAUDE.md, docs/01_product_spec.md, docs/02_architecture.md, fleet/outbox/S10/RESULT.md (findings 01, 05, 07, 08, 09, 10, 11), fleet/outbox/S10/proposed_goldens.json, fleet/outbox/S03/RESULT.md (section 3, thinking controls), fleet/outbox/B02/RESULT.md. Code: worker/src/*.ts, worker/test/*. Repo: ~/Desktop/Truffle. Run tests with `cd worker && npm test`.

## Deliverable (all in worker/)
1. Feed admission (S10-07, S10-08). Route rejects non-object bodies, totals that are not nonnegative safe integers (strings, null, fractions, booleans, NaN, Infinity, exponent overflow), totals above 50,000 per day, and a jump that implies more than 20 steps per second since the last accepted feed for that day. Body cap 8 KiB. User message cap 2048 characters. Rejections are 400 with a calm JSON error and retry guidance, never a zero day, never a brain or weather call. Engine: fractions and unsafe integers are a no-op; add the two proposed goldens `S10_feed_fraction_is_noop` and `S10_feed_unsafe_integer_is_noop` to tests/golden/energy_cases.json (these add behaviour, they do not change an existing case).
2. Uniform 401 (S10-01). Unknown phrase and wrong owner secret return the same status, same body, same timing class. Do not allocate a DO or fetch weather for an unknown phrase. Keep the existing IP limits.
3. Weather text (S10-10). The state block weather field is built only from validated numbers and an allowlisted condition vocabulary (fixed strings per WMO code group, Arabic and English). Anything else serialises as `unavailable`. Golden 30 must stay byte-identical.
4. Facts as untrusted data (S10-10, S10-11). Facts are JSON-encoded inside a clearly delimited untrusted section of the prompt, never as system instructions. Extraction stores at most 3 facts per reply, 160 characters each, 60 per life. Instruction-like facts (anything containing a state block, `tier=`, `system`, `ignore`, or bracket-delimited policy text) are dropped. Death wipes all facts and the active conversation; only the chosen favourite memory survives on the gravestone. Live `newSpore` returns 409 at the route (engine untouched).
5. Coordinates (S10-09). Validate finite latitude and longitude in range, round to two decimals, store only the current point, never a trail. Coordinate-triggered weather refresh uses the daily cache and is bounded to 1 per hour per Truffle. Do NOT change the burrow latching policy; that is an open decision.
6. Demo bounds (S10-05). Demo Truffles get at most 30 chat replies per day. Verify the stored demo flag on every demo control; never trust a client `demo` field.
7. Empty reply retry (S03). When a Workers AI reply has an empty visible text (all tokens spent in `reasoning_content`), retry once with `chat_template_kwargs.enable_thinking=false` and the same max_tokens. Count the retry in the chat log and charge the user once.

## Acceptance
`npm test` green including all 30 original goldens, the 12 edge tests, and new tests per item above. `scripts/smoke.sh` against `wrangler dev --ip 127.0.0.1 --port 8787` still passes. Paste the test summary and the smoke output into the report.

## Do not
Do not touch web/, feeder-android/, finetune/. Do not change any existing golden case. Do not change burrow policy, timezone policy, or the tier shown in the state block (open decisions). Do not add co-author trailers. Do not commit; leave the work on the tree, the integrator commits.

## Report
fleet/outbox/B06/RESULT.md: what was done per item, evidence (commands + output pasted), open questions, cost (should be 0). No secrets anywhere.
