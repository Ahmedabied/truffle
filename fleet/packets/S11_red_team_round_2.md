# S11 red_team_round_2
Owner: astra (gpt:deep)        Wave: Thu Oct 8 afternoon        Due: Thu 2026-10-08 19:00 Oman

## Goal
Red-team the hardened Worker that landed this morning (B06). S10 found the holes; B06 claims to close most of them. Find what is still open, what B06 opened, and whether any fix is wrong.

## Inputs
Read first: fleet/outbox/S10/RESULT.md (your predecessor), fleet/outbox/B06/RESULT.md (what was changed and why), decisions/0012_memory_as_untrusted_section.md, docs/01_product_spec.md, docs/02_architecture.md. Code: worker/src/*.ts, worker/test/*.ts, tests/golden/energy_cases.json. Deployed API: https://truffle.ahmed-abied.workers.dev (routes in worker/README.md). Repo: ~/Desktop/Truffle.

## Scope
1. Facts as untrusted data: can a chat message plant a fact that changes a later reply's behaviour, tier, or language? Can the fact filter be bypassed with Arabic, Unicode, or JSON tricks? Does the JSON section itself break the prompt?
2. Feed admission: the 50,000 cap, the 20 steps per second jump rule from local midnight, the day envelope, and replay across midnight. Find a legitimate walking pattern the rules reject, and an abusive one they accept.
3. Uniform 401: timing or body differences between unknown phrase, wrong secret and missing secret. Measure against production, 20 samples each, report medians.
4. Demo bounds and the coordinate rules.
5. The empty-reply retry: can it be made to double-charge or double-call?
6. Anything in B06's own open questions that looks wrong.

## Constraints
Production spawns are limited to 5 per hour per IP: create at most 2 Truffles and reuse them. Keep chat calls under 30 total (they cost Workers AI neurons). No load tests, no bodies over 64 KB, no third-party targets. Reason from the code for everything else and say which findings are code-read and which are live-verified.

## Deliverable
fleet/outbox/S11/RESULT.md: ranked findings with severity, reproduction, effect, proposed fix and owner, acceptance test. Proposed new goldens or DO tests in fleet/outbox/S11/proposed_tests.md. No secrets or phrases in the report.
