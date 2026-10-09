# Offline v2 demo and chat policy

Date: 2026-10-09. Decision 0023. Local implementation and test evidence only.

## Delivered

`web/src/mock.ts` now runs the shared v2 food engine. It retains the bounded
stored balance, absolute capability thresholds and 1,000-point elapsed-day
upkeep at every stage. Ordinary chat uses the shared effort policy: medium,
short greetings low, and high only when explicitly requested and affordable.

The clock is actual wall time plus a persisted demo offset. The existing
midnight control advances a complete 24 hours. Settlement splits at pinned
Asia/Muscat midnights, so the step diary, age and reward streak close once per
local day. Midnight adds no food charge. Reload preserves the offset and
today's absolute feed total. Clock rollback cannot refund food or rewind the
diary. Heat is settled before changes and remains on across manual advances
until explicitly toggled off. Shelter pauses both upkeep and empty time.

Legacy saved mock states adopt v2 at the current demo time. They preserve
balances, history, age, graves and death. Unknown legacy empty duration starts
fresh for living pets. The tired and wilting screenshot scenes explicitly seed
24 and 48 hours of measured empty time, so settlement preserves their moods.

Generation, language and clock offset live in the existing mock scope's new
`.meta` local-storage key. Reset and new spore advance generation, and death
fences pending replies. New spore keeps graves; full reset clears the demo's
progress and returns its clock to now. Demo and main simulation storage stay
separate. This is local simulation metadata, never native ownership evidence
or a server-issued authority. No server gift job is simulated here.

Paid-tier sample events now say `brain: "sample"` and never identify authored
text as Modal or Workers AI output. Their simulated food charge remains part of
the engine demonstration. `?cold=1` only delays sample text; it does not claim
a real fallback or mark a sample half-awake. Replies no longer infer hunger
from low effort, invent walks, or add unsolicited walking requests. Brief and
empty-food replies welcome quiet company in English and Arabic.

During a sample reply, the admitted cost is held against maintenance and other
sample replies, then charged once immediately before the first visible token.
Cancellation before output releases it. Cancellation after a visible token
keeps the one charge. Reset invalidates the old stream. These local holds are
in memory; browser reload has no provider job to resume and no paid inference
to settle.

The Worker prompt now explains that the percentage is storage fullness,
capability comes from absolute food, and growth does not increase upkeep.
Canonical persona and language lines remain byte-for-byte unchanged. Prompt
tests establish the instructions sent, not measured model adherence.

## Routing review

Reviewed `worker/src/brain.ts`, the effort policy and router tests without
changing the router. Ordinary admitted tiers release a cold trained provider
after four seconds; admitted high effort allows eight. A shorter configured
timeout remains effective. The timer survives role events, reasoning and
whitespace until actual visible text arrives. The failed provider is cancelled
before fallback starts. Caller cancellation and the finite whole-reply limit
remain separate. No issue requiring a router change was found in this review.
This does not measure live trained-provider latency or model adherence.

## Validation

New `web/test/mock-v2.test.ts`: 21 cases covering saved-state migration, storage,
growth, elapsed time, local midnight, replay protection, heat, death, generation,
effort, sample provenance and cancellation. The initial 16 cases failed against
the old mock as expected. The existing three reward tests remain unchanged and
pass with v2.

Final local commands and results:

- `cd web && npm test`: 15 files, 313 tests passed.
- `cd web && npm run typecheck`: passed.
- `cd worker && npm test`: 25 files, 593 tests passed, including all 18 prompt
  cases and the 26 router and latency cases.
- `cd worker && npm run typecheck`: passed.
- `git diff --check` for the owned changes: passed.

The Worker suite reports existing Vite native-loader and Node experimental
SQLite warnings. No tests failed. A temporary web typecheck failure from an
import of Worker prompt types was corrected before the final passing run.

## Browser QA handoff

The browser smoke suite was not run in this assignment. Its ordinary chat case
currently expects `Cost 200`; ordinary v2 conversation costs 60, while an
explicit deep reply costs 200. The shared copy now says `Actual cost`.

Exact energy-equality assertions across time can now observe a one-point
display decrease from integer flooring, even over a short interval. Assertions
about gifts not charging food should isolate the action's charge or account
for elapsed maintenance. Heat-protected food remains exactly unchanged.
Manual advance now preserves a chosen heat setting. Debug `?cold=1` represents
sample delay only, not real fallback provenance. All sample scenes use v2
storage fullness, which differs from the old stage-capacity percentages.

No deploy, commit, phone session, training or provider call occurred here.
