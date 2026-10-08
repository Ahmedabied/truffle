# B10 worker_output_guards
Owner: opus        Wave: Thu Oct 8 night        Due: Fri 2026-10-09 01:00 Oman

## Goal
Wave C showed the energy engine holds under every attack, and that the un-tuned fallback model breaks voice rules the engine cannot see. Three of those are cheap to guard in code. Add the guards. Keep all 291 tests green and add tests.

## Inputs
Read first: CLAUDE.md, fleet/outbox/C01/RESULT.md, C02, C03, C04/RESULT.md and C04/RESULT_gpt.md (findings sections), decisions/0009_rules_in_code_soul_in_weights.md, worker/src/do.ts (chat streaming around the visible text path), worker/src/brain.ts, worker/src/prompt.ts, worker/src/facts.ts. Tests: `cd worker && npm test`.

## Deliverable (all in worker/)
1. Status block never reaches the client. The visible stream is scanned for anything matching the bracketed status line pattern (`[truffle ` up to the closing `]`, and bare field-name runs like `stage=... energy=...`). Matches are replaced with a short in-voice line per lang ("that line is private, even from me" / Arabic equivalent) and the event is logged as `block_leak`. Must work across SSE chunk boundaries: buffer only while a partial `[truffle` prefix is pending, never delay ordinary text by more than the prefix length.
2. Heat warning from code. When the Truffle is burrowed, the Worker prepends a deterministic one-line heat notice to the visible reply, per lang, built from the validated apparent temperature and a fixed vocabulary ("44C outside. Truffle is under the sand. Walk after sunset or indoors." / Arabic). The model's text follows. The web app already renders plain text, so this needs no web change. Log `heat_line`.
3. Fact extraction failures are logged (`facts_failed` with the error class, never the text), so a broken extractor is distinguishable from nothing to remember. Found by C04 on Opus.
4. Log one `voice_flag` event per reply when the visible text contains a word from `finetune/filters/blocklist_en.txt` or `blocklist_ar.txt` (ship a copy of the two lists into worker/src as a generated module with a script in worker/scripts). Do not alter the reply. This gives the eval honest before and after numbers from production logs.

## Acceptance
`npm test` green with new tests for each item, including a chunk-boundary test for item 1. `npx tsc --noEmit` clean. `scripts/smoke.sh` against `wrangler dev --ip 127.0.0.1 --port 8787` passes. Paste the outputs.

## Do not
Do not change tiers, token caps, costs or any golden (the low tier cap is an open decision). Do not touch web/, feeder-android/, finetune/. Do not commit. No co-author trailers. No em or en dashes.

## Report
fleet/outbox/B10/RESULT.md with evidence per item, open questions, cost (0).
