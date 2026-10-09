# Fleet 25 / assignment 16: independent economy adversary

Reviewed 2026-10-09. Scope: decision 0023 against actual `worker/src/engine.ts`,
`do.ts`, `config.ts`, `effort.ts`, relevant weather/time/stream code, and existing
v2 tests. No prior agents' conclusions were used. Production code was read-only;
the only code added by this assignment is `worker/test/economy-adversary.test.ts`.
No provider calls, devices, deployments, or commits were used.

Final status: **all three findings below are fixed by root integration and all
seven owned tests pass**. The descriptions preserve the original reproducible
failure evidence. Review of the integrated source confirmed refreshed admission
time, authoritative weather-day selection, and cancellation propagation with a
guard against flushing hidden text into a charge.

## Findings handed to integration

### P1: cancellation can charge food for words that were never visible

`TruffleDO.chat`'s response stream `cancel()` only clears its output controller.
Inference keeps running. Later `show()` calls still commit the reservation and
`finish()` stores their unseen output.

Deterministic SQLite reproduction: seed 100 v2 food and a demo allowance, admit a
low reply, hold the provider, cancel the downstream before visible words, then
release provider text. Actual food is **80**, expected **100**. A buffered guard
prefix (`stage`) is included so the regression also catches an incomplete fix
that aborts the provider but flushes previously hidden text during cleanup.

The related partial-cancellation reproduction first receives `First words.` and
correctly pays 20. After cancellation, current code stores an additional provider
continuation that the user never received. The charged amount should stay 20,
but inference should stop and only the delivered partial reply should remain.

Small fix: propagate v2 response cancellation to the existing abort controller,
prevent `show()`/guard cleanup from committing or appending new text after that
cancellation, release an uncharged ticket and quota, and preserve an already
committed partial reply. Do not change the v1 golden contract or refund a reply
whose words already appeared.

### P1: authentication delay bypasses settlement before paid admission

`chat` captures `now` before awaiting `open(secret, now)`, then calls
`currentRow(now)` with the captured timestamp. Reloading storage avoids a stale
row overwrite but does not advance time after the authentication await.

Deterministic reproduction: seed exactly 20 food, hold the owner SHA-256 promise,
advance the fake clock **one millisecond**, and release authentication. Actual:
the provider receives a low-tier call and the pet spends 20. Expected: settle
1,000 fixed-point units first, leaving 19 displayed/available whole points, then
return an asleep reply with zero paid calls. The reservation retrospectively
protects food during time that elapsed before reservation admission.

Small fix: refresh wall time after authentication and settle before deciding the
tier or writing a ticket. Admission rate windows, ticket deadline, and local-day
context should use that refreshed time consistently. The fixture deliberately
uses only 1 ms; a long cryptographic stall is unnecessary.

### P2: clock rollback can remove valid heat protection and burn stored food

`fetchWeather` first clamps settlement through `currentRow(now)`, but then chooses
the new shelter state with `burrowToday(row.m, Date.now())`. A rolled-back clock
therefore selects the preceding calendar day's weather even though the canonical
food cursor and feed day still refer to the later date.

Deterministic reproduction: a sheltered pet has 1,000 food, current-day maximum
45 C and previous-day maximum 30 C. Roll the clock back 24 h and fetch a forecast
containing both days. Actual shelter becomes false while the food cursor remains
unchanged. Resume to the following day: actual balance is **0**, expected
**1,000** under the preserved hot-day shelter. Both assertions fail independently.

Small fix: select the v2 shelter day using the authoritative nondecreasing
calendar time, and inspect the pairing/alarm shelter overrides for the same raw
wall-time choice. This prevents old-day forecast selection from changing a
future accounting interval.

## Concrete busy-day and rest-day results

Two passing SQLite scenarios use the real DO, tier selection, reservation commit,
provider stream parser, and fixed-point engine. One grows from Spore to Sprout;
the other starts at Elder. These are accounting examples, not recommendations
about activity or a claim that food rates are calibrated to a person's health.

| Operation | Sprout food | Elder food |
| --- | ---: | ---: |
| Newly accepted 15,000-step absolute total | 15,000 | 15,000 |
| Ten ordinary useful replies, one explicit deep reply, one greeting | 14,180 | 14,180 |
| End of the first actual 24 h | 13,180 | 13,180 |
| Five useful ordinary replies on a zero-step rest day | 12,880 | 12,880 |
| End of the second actual 24 h | 11,880 | 11,880 |

Each ordinary request actually admits medium/60, explicit deep admits high/200,
and the short greeting admits low/20. Total chat cost is 1,120; maintenance is
2,000; all 15,000 newly captured points are conserved. The Sprout feed records
zero discarded overflow: the extra 3,000 above its old 12,000 capacity survive.
Elder pays exactly the same elapsed upkeep. The rest day resets the step diary
without erasing food. There is no refund of historically discarded overflow.

Absolute eligibility still matters: medium requires 1,500 available food and
high requires 3,600 at every stage. These scenarios remain comfortably above
those thresholds; they do not imply every small daily step total buys medium
conversation indefinitely.

## Other accounting paths inspected

The canonical balance includes held food, so reserving a reply does not create
free capacity. Maintenance uses only unreserved units, expiration splits the
interval at its deadline, and a committed ticket is never treated as a hold.
Integer remainder handling and bounded multiplication are sound in the inspected
engine. Positive credit resets measured empty time; duplicate totals do not.
Death is generation-fenced and terminal, with explicit new-spore recovery.

The existing explicit suites cover exact 96-hour death, exact exhaustion,
duplicate feeds, DST's 25-hour day, fixed-point partitioning, maintenance rollback,
weather uncertainty, multi-batch migration restart, dead migration preservation,
reservation expiry, private-block-only output, and committed partial failure.
Those tests were read as coverage evidence; this assignment does not claim a new
full-suite execution. The auth-delay and rollback-plus-weather cases above expose
gaps despite that coverage. Simultaneous feed/chat operations reload durable state
after awaits; the integrated fix also refreshes the admission timestamp.

## Verification and release status

Command: `cd worker && npm test -- --reporter=dot test/economy-adversary.test.ts`.
Pre-integration result: **4 failing regressions / 2 passing accounting scenarios**
across the three root causes above. Assertions retain the decision's expected
behavior; no existing expectations were changed to conceal failures. A focused
rollback run independently confirmed both the lost shelter and 1,000-point loss.
All new fixture dates derive from the exported cutover constant.

Final integrated rerun: **7 passed / 0 failed**. The seventh test verifies that the
v2 demo's next-day control preserves an enabled heat toggle across repeated day
advances. Toggling shelter off spends exactly 1,000 food per advanced day;
toggling it on while empty also pauses empty time. Explicitly toggling it off
again resumes that clock. The final test was added after root's related demo
consistency correction; it is not an additional previously reproduced finding.

The checked-in cutover was still the development instant
`2026-10-09T07:30:00Z` during this review. Before the API release, integration must
move the config and decision record together to a prospective instant roughly
15 minutes after the planned deployment. The deliberate legacy-cursor 409 guard
must remain. Shipping the already elapsed development cutover can strand legacy
pets whose deployed v1 cursor advanced past it. This assignment did not deploy
or alter that constant.
