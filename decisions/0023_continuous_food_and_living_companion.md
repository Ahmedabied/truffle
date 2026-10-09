# 0023 Continuous food and a living companion

Date: 2026-10-09. Status: accepted for implementation under Ahmed's explicit
"go for it" after the missing-feature audit. Extends 0021 and 0022. The initial
food rate is a game-design trial, not a health recommendation or measured need.

## Food that lasts past midnight

Version 2 consumes 1,000 food points per actual elapsed 24 hours at every stage.
Midnight only closes the step diary, updates age and affection, and changes the
weather day. There is no midnight food debit and growth does not increase upkeep.
Heat shelter pauses both maintenance and the empty-food survival clock. Uncertain
weather keeps the last established shelter protection under decision 0019.

Keep one conserved integer food balance. Capacity is the old stage capacity plus
`min(12,000, old stage capacity)` for stored food: 12,000 / 24,000 / 32,000 / 42,000.
No separate pantry transfer can create or lose points. Accepted overflow up to
that bound survives midnight. Excess beyond the stated capacity is not credited.
Past discarded overflow is not invented or refunded. Today's absolute step
total still resets daily; stored food does not. Historical unsent uploads remain
outside this change and must not bypass the dated, pinned-zone feed contract.

Food enables actual model conversation, explanations and planning. Existing
20 / 60 / 200 reply costs remain. Eligibility is absolute: low from 20, medium
from 1,500, high from 3,600. Growth cannot downgrade intelligence at an unchanged
balance. No protected chat floor blocks the first small walk from buying a reply.
Ordinary conversation defaults to medium or the lower available tier; deep
thinking is an explicit choice. A short greeting can choose low. The user can
see the choice and its maximum cost before sending.

Bound the wait for the trained provider's first visible text to four seconds
for ordinary replies and eight seconds for explicit deep replies. Then use the
existing honestly labelled fallback. These are routing deadlines, not promises
about total response time. Preserve cancellation, the finite whole-reply limit,
and one charge for a visible reply. Do not race two paid providers in parallel.

The pet survives until it has spent 96 actual, non-sheltered hours continuously
without food. Positive feeding clears this clock immediately. Keep death,
gravestones and explicit new-spore recovery; do not silently resurrect dead pets.
Empty time starts when food actually runs out, not at the next midnight. Integer
remainders preserve sub-point consumption across repeated reads. Clock rollback
does not consume, duplicate or refund food. There is no debt while empty.

## Migration and in-flight work

The one global cutover is `2026-10-09T08:43:00Z`. Existing v1 state first closes
only the v1 midnights at or before that instant, preserving its rules and records.
It then adopts v2 at the cutover, or its creation time if later. Living pets start
a fresh measured empty clock because v1 midnight counts cannot reconstruct exact
empty duration. Existing energy, owner, memories, history and graves survive.
Do not charge both versions for the same interval. Legacy golden cases remain
unchanged and continue testing v1; add an explicit v2 suite.

Catch-up must reach the operation's timestamp before today's feed or chat is
admitted. Persist bounded continuation if necessary. Keep historical weather
until all intervals that use it are settled. A paid chat holds its admitted food
in a persistent generation-fenced reservation. Maintenance cannot spend it.
Charge once for visible output; return an unused reservation on empty failure,
cancellation or expiration. Death, reset and new life fence stale completions.

## Reactions and natural outings

Use a separate transient companion presentation state, never counterfeit server
energy or health. Confirmed fresh step increases can make Truffle happy. A native
foreground positive-step signal can make the current verified pet react promptly,
without claiming GPS, outdoors, exact activity or steps that have been credited.
Only a successfully verified native owner import enables this document's native
event scope. Never expose a general JavaScript credential bridge.

Explicit walk or errand plans, including clear English or Arabic chat intent,
make Truffle anticipate an outing. Negation, past events, quotations and uncertain
plans must not start one. Normal chat still makes exactly one request. Give a
small, dismissible acknowledgement, preserve explicit intent through a reload,
and welcome a return without inventing where the person went. Heat and rest
responses stay gentle. No notification escalation, guilt or sound.

## Actual gifts made while away

Store an owner-authenticated away job on the server. After at least ten minutes
away, an alarm creates a fresh procedural ASCII drawing and a short authored
note, using a fresh job seed and bounded non-sensitive pet/outing context. Shapes
and details are composed anew instead of selecting one of twelve fixed drawings.
This is real background creation, but it is not a model-generated gift. Say so
honestly in details. It incurs no paid inference and no fictitious food charge.
Actual model-made gifts remain an optional future extension until the unreconciled
provider ledger and a global spending gate make them safe to enable.

Schedule explicit outings and best-effort browser-away events. Returning early
cancels an unstarted job. At most one gift per pinned local day, and keep twelve
server gifts. A reload, midnight, retry or simultaneous tab must not mint extras.
Generation fences and ownership protect jobs and collections. Preserve existing
local keepsakes; new server gifts appear in the world, Pocket and the chat-area
gift view. A page closed before it can send an away event cannot promise a job.
Rest days qualify. A demo previews the same generator with explicit provenance.

## Validation and release

Test conservation, DST, heat transitions, long catch-up, clock rollback, growth,
duplicate feeds, migration, late/empty chat and reservation races. Test intent
false positives, pet switching, stale native events and gift day/generation races.
Review English/Arabic, reduced motion, keyboard navigation and small screens.
Keep the existing full mushroom, edge-to-edge world and 60 fps target. Android
builds run on the workstation from GitHub. Phone-only endurance, accuracy and
notification delivery remain unverified while the phone is disconnected.
