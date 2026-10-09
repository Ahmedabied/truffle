# Fleet 25 assignment 01: proposed energy v2 contract

Reviewed 2026-10-09. Read-only application review. This file is the only output
written by this assignment. No source, golden, deployment, paid inference or
device check was changed or run. This is a proposed contract for the integrating
agent's decision record, specification and implementation.

## Recommendation

Adopt a single conserved food balance, gentle continuous maintenance, bounded
extra capacity, and stage-independent effort eligibility. The integrating agent
confirmed the following proposed values during this review: 1,000 points per
elapsed 24 hours, an extra `min(12,000, stage energy_max)` of capacity, absolute
effort thresholds of 20 / 1,500 / 3,600, and death after 96 nonheat hours
continuously empty. There is no protected chat floor.

These constants are product choices for an initial trial. In particular,
1,000/day is not a user-fixed requirement or measured biological/compute rate.
Retaining death is a deliberate choice: gentle maintenance and a corrected
clock improve ordinary rest, but do not make indefinite rest consequence-free.
The earlier exploration's reversible dormancy proposal would require a separate
decision; it is not silently included here.

The smallest coherent change is one versioned engine path, one settlement
entry point shared by all Durable Object operations, and an energy reservation
attached to the existing chat ticket. Do not add a second wallet, digestion
timer, background inference, expiring food, or a daily gift of points.

## Evidence in the current checkout

- `worker/src/engine.ts:174` credits increasing absolute daily totals and
  preserves energy until the stage cap. Energy does not reset at midnight.
- `engine.ts:219` subtracts 1,500 / 3,000 / 5,000 / 7,000 at midnight.
  `engine.ts:220` counts empty midnight snapshots. A positive feed currently
  does not immediately reset that counter.
- `engine.ts:145` divides energy by the current stage cap for effort. Growth
  from 99,999 lifetime steps and 12,000 energy to Elder with 12,001 energy
  changes high eligibility to medium.
- `worker/src/do.ts:212` stops a catch-up batch after 14 midnights. `open()`
  nevertheless returns that partially caught-up state to feeds/chats. The
  alarm has a continuation, but request admission has no equivalent barrier.
- `do.ts:237` prunes weather relative to the requested present even when the
  settlement cursor is still behind. A continuation can lose forecasts it has
  not used yet.
- Chat admission persists a quota ticket, not a food reservation. Completion
  reloads current state and `chargeChat()` clamps at zero. Continuous
  maintenance would make it possible to report a 200-point charge after less
  than 200 remains.
- `explorations/energy-carryover/models.ts` is an offline comparison, not a DO
  implementation. Its pantry candidates retain stage-ratio tiers. Its gentle
  pantry candidate also has the rejected floor. None is the exact proposed
  combination above. Existing scenario numbers must not be relabelled as v2
  execution results.

## Normative rules

### Food, growth and spending

1. An accepted increasing feed credits exactly one point per new step. Keep
   the current pinned-zone calendar-day envelope, monotone daily total,
   jump/rate checks and source fences. Carryover means already accepted food
   survives midnight. It does not recover yesterday's unsent steps.
2. The total capacity is 12,000 / 24,000 / 32,000 / 42,000 for Spore / Sprout /
   Truffle / Elder. There is one balance. Extra capacity may be called stored
   food in explanatory copy, but has no independent earning, transfer or
   charging rules. Apply the cap after the accepted feed's stage growth.
3. Preserve lifetime thresholds and the existing heat rule: protected-day
   feeds add food and today's steps, but do not advance lifetime growth.
   Capacity never shrinks on normal growth. A larger capacity cannot remove
   food, increase maintenance, or reduce reply eligibility.
4. Clamp newly accepted food at total capacity. Record or derive that event's
   discarded overflow for verification. Full storage is an honest cap, not a
   reason to ask the person for more steps. Never reconstruct old overflow
   from lifetime steps.
5. Effort eligibility uses available points, independent of stage: below 20 is
   asleep; 20 through 1,499 is low; 1,500 through 3,599 is medium; 3,600 and up
   is high. A requested lower tier caps effort. Existing prices and actual
   model limits remain 20/60/200 and 120/400/1,200 output tokens, with thinking
   only at high. No food is protected from an affordable requested reply.
6. Ordinary conversation explicitly requests medium or the lower available
   tier, as now accepted in decision 0023. A short greeting can choose low;
   deep effort is explicit. This request policy is separate from maximum
   eligibility and avoids making a well-fed greeting automatically cost 200.
   Keep the admitted tier, prompt, output limits and charged cost in agreement.
7. Only real requested replies incur the chat charge. Memory extraction, if
   performed under existing policy, stays included. Presence, animation,
   authored gifts, settings, reading history, safety/heat notices and canned
   resting replies are free. Do not claim maintenance represents background
   research or actual GPU work.

### Elapsed time, empty duration and heat

8. Settle through an operation's authoritative timestamp before reading or
   mutating its balance. The nonheat maintenance rate is `1000 / 86400000`
   points per millisecond at every stage. Midnight only closes calendar
   history, steps, age, affection and moments, then establishes the next day's
   protection. It performs no extra food debit.
9. Keep exact integer fixed-point accounting. A convenient denominator is
   `D = 86_400_000` units per point, so maintenance is exactly 1,000 units per
   millisecond and the largest balance is 3,628,800,000,000 units, safely below
   JavaScript's integer limit. Public whole-point energy is derived by floor;
   never rebuild the canonical balance from that rounded value. Bound a
   duration to the funded interval before multiplying, so pathological large
   timestamp gaps cannot overflow intermediate arithmetic.
10. Settle the old protection state up to a heat transition, then apply the
    new state. During heat, neither food nor empty duration decreases/increases
    respectively. A missing forecast preserves the last known protection.
    Fresh weather cannot retroactively charge an interval previously sheltered
    by known protection. Split offline work at local-day boundaries and any
    actual intraday protection transition.
11. Exact zero available food starts an empty interval; less than 20 points
    merely prevents a paid reply. There is no food debt while empty. A positive
    accepted feed resets empty duration immediately, including during heat.
    Duplicate, lower, rejected, wrong-day and wrong-zone feeds do not reset it.
    Releasing held food after an empty failed reply also ends an empty interval
    because available food becomes positive again.
12. Accumulate actual nonheat empty milliseconds, not midnight observations.
    Death occurs at 96 hours, with an exact event time at millisecond
    resolution. A feed at that deadline is too late because settlement precedes
    feeding. A feed one millisecond before it can save the pet. `zero_days`
    may remain a compatibility/display derivation `floor(empty_ms / D)`; it
    must not drive accounting. Reset tired/wilting state immediately on food.
13. Death is terminal for the same pet. Write one gravestone and fence the
    old generation once. Retain existing dead pets and gravestones unchanged;
    neither migration nor a feed revives them. Explicit planting remains the
    only new-life operation. Preserve existing owner identity, histories,
    facts and turns during migration; only an actual death/new-life transition
    uses the separately specified memory policy.
14. Repeated settlement at the same instant is a no-op. Clamp a backward clock
    to the stored cursor without rewinding it, crediting time or changing the
    feed's pinned calendar authority. DST affects which day closes, not the
    rate per actual elapsed hour.

## Migration and stale catch-up

Use fixed server cutover `C = 2026-10-09T07:30:00Z`, now declared in decision
0023. New pets created at or after C initialize directly into v2.
Prefer deploying a v2-aware build before a future `C`; an old build must not
continue writing unversioned post-cutover burns. If rolling deployment or an
old in-flight handler can do that, an explicit migration fence is required.
Do not infer whether a historical burn occurred from its resulting balance.

For a legacy living row, use this deterministic state machine:

1. **Legacy catch-up:** run unchanged v1 calendar ticks with boundary times
   `<= C`, starting at the existing `last_tick_ms`. Persist each batch of at
   most 14 boundaries and its cursor. If `C` is exactly midnight, that boundary
   belongs to v1 and must not also run as v2. The old rules can legitimately
   exhaust a stale living pet before cutover; this consequence needs a migration
   fixture and explicit acceptance, not a hidden grace/refund.
2. **Initialize v2:** once legacy calendar work reaches C, preserve the
   resulting balance, lifetime, stage, day totals, histories, age, affection,
   owner, facts, turns, moments and gravestones. Convert the integer balance
   exactly to fixed-point; the newly available capacity starts empty. Set the
   settlement cursor to C. For living pets reset the new empty duration to
   zero at C; old `zero_days` cannot prove a continuous empty interval. Dead
   rows remain terminal and do not acquire a new life or a fresh food balance.
3. **v2 catch-up:** settle all intervals from C through request time, splitting
   at calendar/protection boundaries. Persist cursor, balance and empty duration
   together. Materialize any death transition exactly once.
4. **Admission barrier:** only now admit today's feed/chat or return a summary
   labelled current. This includes the existing phrase-only feed route after
   its normal validation, not just owner-authenticated reads. A feed must never
   land in an old accounting day and subsequently be reset by continuation.

A synchronous loop over persisted 14-boundary batches is the simplest bounded
batch implementation for ordinary gaps. For a separate overall work limit,
return a retryable catch-up response, persist progress and schedule an immediate
continuation. Never silently skip remaining boundaries. Calendar-only empty
days can later be fast-forwarded only with equivalent history/age/affection/
moment semantics. Weather entries must not be pruned until the cursor has
passed their days. Fetching today's forecast cannot recreate missing history.

Migration must reload and validate the current row after any awaited owner
check or network operation before it writes. Weather already rereads after
network awaits; the energy path needs the same freshness discipline. No stale
snapshot may replace a feed or chat reservation accepted during that await.

## Chat reservation contract

Reserve the admitted cost synchronously in the existing generation-fenced
ticket before calling a provider. The canonical food total includes this
uncharged held amount; available food is total minus the hold. Maintenance and
other admissions cannot spend the hold. Capacity checks include it, so reserving
food does not create capacity for a second credit. An available balance of zero
can accumulate empty time; the short bounded provider ticket is not a survival
floor and never cancels that clock.

Persist enough state to resolve a crash: ticket id, generation, cost, deadline,
and whether a visible provider reply committed the charge. The robust small
rule is to commit the reserved cost exactly once immediately before emitting
the first guarded visible provider text. A heat line, whitespace or a leaked
state block is not paid output. This preserves the current rule that visible
partial replies cost the admitted amount and makes restart recovery unambiguous.
Completion writes its final/partial result but does not debit again.

An empty failure releases the hold exactly once. A timeout/restart releases an
uncommitted hold, but keeps a committed visible charge. Settle time before
resolving either path. Stale completion cannot release a newer ticket, charge a
new pet, or write old facts/turns. A new life must not inherit old held food.
Resolve an unversioned pre-cutover ticket explicitly during migration; its
absence of durable visibility state must not lead to a guessed retrocharge.

At all times, in the same fixed-point unit:

`opening + accepted credits = total unspent (including hold) + maintenance + committed reply charges + discarded overflow`

Reserving and releasing move no value across that equality. A commit reduces
total by the exact cost. `Math.max(0, balance - cost)` is not a substitute for
a valid reservation.

## Suggested engine API boundary

Keep current exported legacy behavior and v1 goldens intact. Add an explicit
v2 discriminator and canonical accounting fields. Suggested pure operations:

```ts
energyCapacityV2(stage): number
initializeV2(legacyState, cutoverMs): V2State
settleV2(state, toMs, heldCost, favouriteMemory): Settlement
closeDayV2(state, nextBurrowed): V2State
feedV2(state, absoluteDailyTotal): FeedResult
decideTierV2(state, requested, heldCost): TierDecision
commitReservedChatV2(state, cost): V2State
```

`settleV2` handles one interval whose heat flag is constant and reports a new
death/event timestamp. The DO owns dated-feed validation, calendar/weather
segmentation, migration cursors and persistent tickets. `closeDayV2` handles
calendar effects without calling v1 burn/death logic or simulating artificial
heat. Feed and chat operations require an already-settled state. Keep ticket
ownership and charge/visibility transitions atomic with the balance save.

Use total capacity in v2 summary percentages and cap copy. Consumers must not
clamp a 15,000-point Sprout back to the old 12,000 ready cap. Explicitly expose
held/available food in API details if needed; do not let a pending hold look
like a final charge or an extra spendable balance. A demo's next-day button
must advance a virtual day through settlement, not merely call calendar close;
otherwise it stops demonstrating maintenance.

## Required tests before shipping

The following are proposed assertions, not tests run by this assignment.

| Case | Required result |
| --- | --- |
| 1,000 accepted at 23:59, inspected 00:02 | 997.916666… exact points; today's steps reset; no midnight debit |
| Same feed at 00:01, inspected 00:02 | 999.305555… points; difference is exactly two elapsed minutes |
| New pet receives 15,000, then three elapsed nonheat days | Sprout; total 12,000; no lost 3,000 overflow; no chat assumed |
| Elder receives 10,000 at noon, ten low replies, next midnight plus a full quiet day, low check-in | 8,280 total; alive; useful paid check-in admitted |
| Same scenario with ten medium replies and medium check-in | 7,840 total; request policy is explicit |
| Each lifetime growth boundary | Balance gains accepted delta up to larger cap; identical maintenance and no lower effort eligibility |
| Eligibility boundaries | 19 asleep; 20 low; 1,499 low; 1,500 medium; 3,599 medium; 3,600 high in every stage |
| Exact empty transition inside settlement | Empty clock starts at food exhaustion, not last read or midnight |
| 95h 59m 59.999s empty then positive feed | Alive, empty duration reset immediately; duplicate feed cannot reset |
| 96h empty then feed | Dead before feed; one gravestone; identity/history policy preserved |
| Four heat days, positive and empty balances | No maintenance or empty-time advance; missing weather retains shelter |
| Small balance, long empty interval, fresh feed | Fresh food has no old debt; 1 to 19 points feed survival without model admission |
| One settlement versus thousands of reads | Exact canonical equality, including fractional balances and depletion |
| Berlin 23/25-hour days and pinned-zone travel | Correct calendar close; elapsed-hour rate; unchanged dated-feed protection |
| 22+ days offline, mixed heat and missing forecasts | Same result as chronological settlement; no feed/chat before final cursor |
| Migration immediately before/at/after midnight | Each v1/v2 interval and calendar boundary applied once; no invented credit |
| Legacy living with zero_days=3; legacy dead | New living clock starts at C; dead record stays dead; old gravestones unchanged |
| Restart in each migration phase/batch | Resumes persisted cursor without duplicate burn, history close or memory wipe |
| Admitted reply spans drain, feed, heat, midnight | Held cost conserved; feed retained; admitted cost commits once |
| Empty failure, partial output, timeout, restart, duplicate finish | Empty hold released; visible charge retained; no stale-generation mutation |
| Full cap with held reply, then accepted feed | Hold counts toward cap; no capacity exploit or double credit |
| Clock reversal and repeated alarms | No rewind, negative duration, duplicate charge or duplicate death |

Add the new fixtures under an explicit v2 contract and decision record. Run
legacy goldens unchanged, new engine cases, and real DO admission/migration tests.
The prior simulation's 45 checks are useful evidence for the ideas, but do not
verify this combination, its reservations, or its migration. Physical phone
verification is unavailable here. The recorded 81-step feed is acceptance and
replay evidence only, not calibrated walking accuracy.
