# Energy that survives yesterday

Date: 2026-10-09. Status: **exploration, not an accepted spec or implementation**.
Scope: the current engine, three offline alternatives, useful energy work and
safe migration. No engine/spec/golden edits, paid inference, device claims or
deployments were made for this exploration.

## Recommendation

Start with **gentle continuous carryover**: keep one step-based energy balance,
consume a flat **1,000 points per actual 24 hours** across every stage, settle
elapsed time before reads and mutations, and stop treating local midnight as
a charge. Midnight should close the steps calendar. Growth should not raise
the person's daily maintenance obligation.

This is model A below. It already passes the important user-value test: an
Elder gets 10,000 steps, answers ten ordinary requests, then has a full calendar
rest day and can still answer a check-in with **7,840 energy remaining**. The
current engine ends that same scenario at zero. Extra storage is useful for
large capped days, but is not needed to fix this ordinary rest failure.

Separately, choose **reversible dormancy** as the humane low-energy outcome.
The comparative simulations retain death so its consequences remain visible;
they do not establish that death is desirable. Lower burn, a reserve floor and
a more accurate starvation clock all delay loss, but none makes irreversible
memory loss compatible with unrestricted rest. A dormancy decision should
preserve the pet and its memories, stop model calls at insufficient energy,
and wake on the next accepted feed. It needs explicit product/spec treatment,
not a quiet change to a golden. Existing gravestones must remain untouched.

Do not make a 1,000-point protected chat floor the default. The simulated floor
preserves some food after heavy chat but makes a person's first 1,000-step walk
buy **no conversation at all**. It also fails to prevent eventual depletion.

## What the engine actually does

[engine.ts](../../worker/src/engine.ts) already carries energy across midnight.
It resets `steps_today`, not `energy`. An Elder fed 15,000 keeps 8,000 after the
first midnight. The user's concern is real, but a literal daily reset is not
the cause.

The sharp edges are:

1. Maintenance is charged in one midnight lump: 1,500 / 3,000 / 5,000 / 7,000
   for Spore / Sprout / Truffle / Elder. A just-received late feed may be eaten
   immediately. Two minutes later, the same feed can survive almost a day.
2. Cap overflow is discarded. A new pet receiving 15,000 grows to Sprout with
   a 12,000 cap, so 3,000 accepted steps provide growth but no stored energy.
3. `zero_days` counts zero **midnight snapshots**, not continuous starvation.
   Feeding an empty Elder 7,000 every day, with no chat, still kills it on
   midnight four. It ate 28,000 accepted steps in that sequence.
4. Growth raises both the cap and maintenance. At 99,999 lifetime steps,
   12,000 energy allows high effort. One more step produces 12,001 energy,
   but Elder's larger denominator drops the tier to medium and raises the
   next burn from 5,000 to 7,000.
5. An uncapped request automatically spends the highest allowed tier, even
   if it is a short hello. Stored energy can therefore buy expensive answers
   the person did not need.

The current pause dialog rests the screen. It is **not** a server-side pause
of energy consumption. Heat protection does pause burn and `zero_days`; that
behavior must survive any change.

## The three coherent alternatives tested

The [generated JSON](../../explorations/energy-carryover/results.json) contains
all trajectories, source hashes, assumptions and check names. The
[runner](../../explorations/energy-carryover/run.mjs) imports the real current
engine. Alternative models remain separate throwaway code.

| Model | Maintenance | Capacity | Chat policy |
|---|---|---|---|
| Current | Existing stage cost at midnight | Current stage cap | Existing automatic tier |
| A. Gentle continuous | Flat 1,000 / elapsed 24h | Current stage cap | Existing tier and costs |
| B. Stored food, existing appetite | Existing stage rate / elapsed 24h | Current cap plus bounded pantry | Existing tier and costs |
| C. Stored food, gentle appetite, protected chat | Flat 1,000 / elapsed 24h | Current cap plus bounded pantry | Chat cannot consume the last 1,000 |

For B/C, pantry size is `min(12,000, energy_max)`. It stores only accepted
overflow in the same energy unit. Food automatically fills available energy
as it is consumed. This is one conserved balance with a visible reserve,
not a second earned currency. No forced digestion delay, invented daily
gift, simulated background task or perishable expiry is needed.

All proposals pause maintenance and empty time during heat. They consume no
future debt while empty. For comparison they declare death only after **96
actual nonheat hours continuously empty**, and a positive feed resets that
clock immediately. This is a deliberate change from four midnight snapshots.
The comparison therefore changes the starvation rule as well as consumption;
the table must not be read as an isolated rate experiment.

The 1,000 rate, 12,000 storage limit, 1,000 chat floor and 96-hour grace are
**product choices**. No biological, calorie, medical, outdoor-detection or
provider-price claim is made. There is no reason to run background inference
to make fictional maintenance seem physically real.

## Measured scenarios

All points below are simulated accepted steps, not a measured phone walk.
Times are Asia/Muscat unless a DST test says otherwise. Replies are successful
budget events; no answer quality was evaluated.

| Scenario | Current | A | B | C |
|---|---:|---:|---:|---:|
| Empty Elder, 1,000 steps at 23:59, balance at 00:02 | 0 | 997.92 | 985.42 | 997.92 |
| Same feed at 00:01, balance at 00:02 | 1,000 | 999.31 | 995.14 | 999.31 |
| Elder 10k + 10 auto replies, active day closes, one full rest day, check-in | 0, asleep | 7,840, medium | 0, asleep | 7,840, medium |
| New pet receives 15k, balance after 3 elapsed days, no chat | 3,000 | 9,000 | 6,000 | 12,000 |
| New pet's 15k discarded at the cap | 3,000 | 3,000 | 0 | 0 |
| New pet's 15k, time until energy empty | 84h | 288h | 120h | 360h |
| Same fixture, time until retained death rule fires | 156h | 384h | 216h | 456h |
| Elder 3,500/day + 10 auto replies/day, day-14 balance | Dead since day 4 | 19,780 | 0, alive but repeatedly empty | 19,780 |

The late-feed timing gap falls from 1,000 to about **1.39 points** under flat
continuous maintenance. That residual is two minutes of actual elapsed time,
not a calendar penalty. C's chat floor would still suppress those small
balances, which is why it is not recommended as the default.

A 15,000-step first feed lasts 12 days without chat under A. C extends it to
15 days by retaining the 3,000 overflow. Those are long reserves. If a later
playtest finds them too passive, change the documented product rate against
the same scenarios; do not quietly restore an Elder exercise tax.

Frequent company matters. Starting from a full Elder, with 3,500 accepted
steps daily and **30 chats spread over ten hours each day**, after 14 days:

| Model | Balance with automatic tier | Energy spent on those 420 replies | Balance when each short request explicitly caps at low | Low-request spend |
|---|---:|---:|---:|---:|
| A | 15,940 | 46,060 | 28,900 | 8,400 |
| C | 16,000 | 49,000 | 40,900 | 8,400 |

Stored food kept the high tier available longer, so C spent 2,940 more on the
same number of automatic replies. A pantry is not a substitute for an honest
effort choice. Default ordinary company to a clearly labelled concise budget,
with longer/thinking answers available when requested and affordable. This
is a proposed interaction policy; the real answer-quality tradeoff of 120
versus 400 output tokens remains untested here. It must not be presented as
a proven quality improvement.

The separate [public walkthrough](public-walkthrough/chat-and-gift.json)
recorded a high-tier fallback reply taking 52.9 seconds to first visible text
and 55.9 seconds to complete, spending 200 points. Its half-awake disclosure
was visible. The artifact also records a later harness failure; it is evidence
for that reply's measured timing, not a wholly passing walkthrough. This is
another reason to offer deliberate extra thought. No lower-tier latency gain
was measured here, and no provider or timeout configuration was changed.

There is also a limit to protected food. Starting an Elder with 2,000 and no
new steps, A's 100 requested low chats over ten hours exhaust it at 8.64h;
without chat it lasts 48h. C admits 41 replies and lasts 28.32h. Its last
1,000-point floor delays depletion but cannot stop it. Under the retained
death rule C still dies at 124.32h. A floor is not a noncoercion policy.

## What the energy is useful for

The real work is already partly present. [config.ts](../../worker/src/config.ts)
sets 20/60/200 points for replies with 120/400/1,200 output-token caps. High
effort enables thinking. Memory windows expand from one day to seven days to
the available stored facts. [do.ts](../../worker/src/do.ts) calls the real
brain, charges a visible reply once, and performs real fact extraction after
successful medium/high replies. A failed empty reply is not charged. A
visible partial reply is charged once and marked partial under current policy.

Useful jobs fit the user's request, not a daily chore list:

- Explain or translate something the person asks about, in Truffle's voice.
- Help make a concrete small plan from constraints the person supplies, such
  as fitting errands around a free hour. Do not invent local opening hours,
  routes or a live weather lookup the system did not perform.
- Reflect on a thought from a walk when the person chooses to share it.
- Use a fact the person agreed to remember to make a later answer relevant.
  Remembering must be visible and editable. Reading stored facts is not a
  separate continuous inference job and should not silently incur a new fee.

Memory extraction can remain included in the disclosed reply price. It must
not become a second surprise charge, a background daily task or a reason to
harvest facts that the person did not want retained. The existing automatic
extraction does not by itself prove consent or a useful memory experience.

Animation, authored keepsakes, viewing the world, safety/heat notices, settings
and a friendly canned resting line cost zero. Nothing should claim Truffle
spent the day researching or making a gift unless a real authorized job ran
and produced a reviewable result. Current keepsakes already follow this rule.

At 3,500 steps/day, flat 1,000 maintenance leaves an average 2,500-point budget
before capacity losses. That can cover **12 high, 41 medium, or 125 low**
requests at current prices. These are alternative upper budgets, not additive
quotas or a promise of the tier always being available.

## Small concrete specification for a follow-up change

This is a proposal for a decision record, not authorization to edit the engine.

1. Preserve accepted-step conversion, lifetime growth, stage capacities and
   the dated, pinned-zone absolute-total feed contract. Keep existing effort
   prices while testing the simpler low/medium user choice.
2. Add a versioned settlement timestamp and an exact fractional-energy
   remainder. Consume 1,000 per 86,400,000 elapsed milliseconds on unprotected
   intervals. Split settlement at heat transitions and calendar boundaries.
   Persist before returning a state or admitting a mutation. Repeating the
   same timestamp must cost nothing. Clamp clocks that move backwards.
3. Midnight closes history, steps and affection. It never subtracts another
   daily burn. Heat pauses both burn and the empty-duration clock, including
   offline catch-up. Missing weather retains known protection, as today.
4. Never accrue maintenance debt while empty. Preserve integer outward energy
   with an exact stored fractional remainder. A new step must not be eaten by
   old unpaid time. Opening balance + accepted credits must equal remaining
   balance + maintenance + charged replies + explicitly discarded overflow.
5. Decide dormancy explicitly. Preferred: zero energy rests peacefully with
   identity and memories intact, and accepted food wakes it. If death is kept,
   use actual 96 nonheat empty hours, reset on a positive feed, and accurately
   describe the irreversible rest consequence. Do not imply a floor fixes it.
6. Do not add a pantry in the first implementation unless retaining capped
   days is part of the accepted requirement. If it is, use B/C's bounded extra
   storage with A's rate and **without** C's floor. It receives only real
   accepted overflow, auto-refills energy, conserves points across growth,
   and cannot be spent twice. No extra currency or forced wait is needed.

Capacity stays meaningful. Under minimal A the stage caps remain
6,000 / 12,000 / 20,000 / 30,000. A full Elder's new steps still count for
lifetime growth but add no food. Optional storage makes those total limits
12,000 / 24,000 / 32,000 / 42,000, after which further overflow is also lost.
At the trial 1,000 rate a full Elder funds 30 maintenance-only days under A,
or 42 with storage. Never suggest that more steps are needed while full.

Plain-language display can say: “Yesterday's walking still feeds me. I have
9,000 left.” Only say “from yesterday” if a dated credit ledger actually proves
that provenance. Without it, say “Food carries across days. I have 9,000 left.”
Show today's steps separately from stored energy. A fullness percentage is
not a sufficient explanation of carryover.

The growth tier drop remains in all tested models: 12,000/20,000 is high,
12,001/30,000 is medium. Flat maintenance removes the increased survival
obligation, not this effort downgrade. A later stage-independent threshold
decision could remove it, but it affects trained state-block expectations,
UI and golden tests. Do not describe all growth behavior as fixed here.

## Migration and accounting boundaries

Use additive versioned fields in the existing stored JSON, with a single
server cutover timestamp. At first v2 settlement, materialize old rules only
through the cutover, then mark the new settlement cursor and apply new rules
only after it. Never first catch up to “now” under v1 and then charge that
same interval under v2. Work in the real DO serialization/transaction pattern.

Keep energy, lifetime steps, stage, history, affection, owner, language,
moments, gravestones and stored facts. Initialize a new pantry to zero if
chosen. Do not refund historical cap losses or infer them from lifetime steps;
the data does not establish how much was discarded versus spent. For living
pets, start any new empty clock at the cutover instead of translating
`zero_days * 24h`: old zero snapshots do not establish an actual empty interval.
Existing dead pets and gravestones require no reset or resurrection.

The DO's catch-up currently processes at most 14 missed midnights per batch.
A new settlement path must not admit a current feed/chat until its accounting
cursor reaches that request's timestamp. Keep a continuation cursor for old
intervals. Replaying alarms or fetching state repeatedly cannot charge twice.

Continuous burn also introduces a completion race: an admitted reply can
finish after maintenance has consumed its budget. Reserve the admitted cost
under its existing generation-fenced chat ticket, exclude it from maintenance,
and either commit it once on visible output or release it on a truly empty
failure. Preserve the existing rule for visible partial replies. Expiration,
restart and death/dormancy transitions must resolve or fence the reservation.
The offline model does **not** test this DO implementation.

A long offline outing has another boundary. The current feeder contract
rejects yesterday's first upload after pinned midnight. Energy carryover only
preserves steps the Worker already accepted. It cannot recover unsent steps.
Keep that replay protection. Historical feed support would need a separate
bounded per-day high-water ledger, source fencing and unambiguous day windows;
simply accepting yesterday's total against today's baseline would double-credit.

## Verification and proposed executable cases

Executed from the repository root:

```text
node explorations/energy-carryover/run.mjs
PASS 45 exploratory checks. Results: explorations/energy-carryover/results.json
```

Executed from `worker/` against unchanged production files:

```text
npm test -- test/golden.test.ts test/engine.test.ts test/feed-safety.test.ts test/time-b02.test.ts
Test Files  4 passed (4)
Tests       72 passed (72)
```

The exploratory checks cover late feeds, cap loss, 15k then rest, moderate
Elders, daily feeding despite death, 30-chat days, chat drain, four protected
heat days, 8-day offline versus hourly settlement, a 22-day catch-up split at
the production 14-day boundary, growth, repeated absolute totals, wrong day
and zone, 23/25-hour Berlin days, unchanged-time replay, no unpaid debt,
fractional-read invariance and 8,000 seeded mixed accounting operations.

The current 32 energy golden cases remain the law until a decision record
changes them. Add a v2 fixture set covering:

- Late accepted feed on each side of midnight, with only elapsed consumption.
- Midnight step/history close while energy survives and is not burned twice.
- Same 1,000 daily rate before and after every growth boundary; document the
  still-existing effort-ratio change separately.
- A 10k Elder day, ten replies, a full rest day and a successful check-in.
- Daily positive feeding cannot accumulate continuous starvation from zero
  midnight snapshots. Heat pauses empty time; positive credit resets it.
- Fractional consumption gives identical totals for one settlement and many;
  DST changes calendar length, not the per-elapsed-hour rate.
- Empty time creates no debt. No hidden refund or overflow recovery on migration.
- If storage is added, bounded overflow, cap growth, automatic refill and
  request replay conserve the same accepted step credits exactly.
- Migration just before/after midnight; old and new costs never overlap;
  owner, growth, memories and gravestones remain unchanged.
- Admission/settlement race, empty failure refund, partial reply charge,
  duplicate completion, expired ticket, restart and generation fencing.
- More than 14 days offline, mixed cached/missing heat forecasts, pinned-zone
  travel, old-day feed rejection and a clock moving backwards.
- Chosen dormancy/death semantics and wake behavior, including rest without
  notifications, no countdown pressure and no required outdoor activity.

These are tested proposals about the economy. They are not a phone proof,
a paid model-quality evaluation, or a released behavior change.
