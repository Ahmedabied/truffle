# Fleet 25 / 18: natural companion adversarial review

Date: 2026-10-09. Scope: decision 0023, English/Arabic intent and pure companion lifecycle. No paid network calls, phone access, commit, or deployment.

## Changes

- Added `web/test/companion-adversary.test.ts`: 105 practical cases covering direct walk/grocery plans, polite quiet requests, explicit rest, reported returns, negation, past tense, quoted/reported speech, uncertainty, questions, persistence, pending welcomes, hidden/heat suppression, and fresh movement during anticipation.
- Expanded `web/src/companion/intent.ts` using complete-message rules. Examples now recognized include “I'm heading to the grocery store,” “I'm going out for a walk,” “أنا رايح للبقالة,” and “سأذهب للمشي.” Arabic contracted prepositions and common supermarket wording are handled.
- Recognized polite quiet requests such as “Could you stop reminding me?” and “من فضلك لا تذكرني بالمشي.” These clear pending automatic welcomes and persist across reload. Removed permissive quiet suffixes that previously accepted “Stop reminding me, said my friend” or “I don't want reminders, but actually keep reminding me.”
- Clear rest/staying-home messages cancel an existing outing without disappointment, follow-up notes, or a replacement plan. Future uncertainty and another person's rest do not cancel it.
- Natural returns such as “I'm home now,” “I'm back from the grocery store,” and “رجعت البيت الحين” consume an existing outing with a happy reaction, without an additional authored chat response.
- Fixed `web/src/companion/state.ts`: fresh accepted/server or verified native movement during anticipation now changes its expression to happy. It retains the existing expiry and pulse accounting, so it does not prolong the animation or create an extra note. Hidden and sheltered states still suppress it.

The existing warm, non-pressuring companion copy was reviewed and left unchanged. No controller, global copy, gift, health, or energy implementation was edited. The existing controller's accepted-chat tests continue to verify one normal chat request and one accepted-intent callback.

## Evidence

- Initial new suite: 37 expected behavioral failures and 55 passes. This demonstrated the intent/quiet/rest omissions, false-positive quiet preferences, and movement-priority bug before fixes.
- Added return cases next: six expected failures before their implementation.
- Final full web test command: `npm test -- --reporter=dot`: **18 files, 427 tests passed**, including all 105 new adversarial cases.
- `npm run typecheck`: passed.

## Limits

The local classifier deliberately remains a small affirmative grammar. Unsupported wording continues through ordinary chat rather than creating a speculative persistent outing. This review did not make a model call or evaluate a live model's conversational warmth. No phone-only behavior was claimed as tested.
