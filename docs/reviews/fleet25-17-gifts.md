# Fleet 25 / 17: independent gift adversary

Date: 2026-10-09. Reviewed `worker/src/gifts.ts`, companion ownership and alarm integration in `worker/src/do.ts`, `web/src/companion/controller.ts`, the real API client, and gift rendering/adapters. No production source changed, paid inference, physical phone, external write, or commit. All network/provider activity in the new tests is mocked.

Final status: all three reproduced findings below were fixed by the root agent and independently rechecked. The cross-tab presence limitation remains documented below. This agent changed only the two adversarial test files and this report.

## Reproduced findings

### P2: a delayed same-life return can cancel a newer outing

`worker/src/do.ts:555` treats every return/cancel lacking `job_id` as permission to cancel the current job. `client_request_id` is validated but ignored on these actions. Generation fences protect a new life, but do not distinguish outings in the same life.

Reproduction: admit outing A, return with A's job ID, admit outing B, then deliver a delayed return/cancel carrying A's original client request ID but no job ID. B changes from `scheduled` to `cancelled`, so its gift is lost. Losing a keepalive response and later duplicate delivery is sufficient; ownership is valid throughout. The new worker test covers both action types and asserts B still completes at its original deadline.

Recommended contract: cancel only a matching job ID or matching original away request ID. A no-token return needs a current owner-state read before cancelling the discovered job. Preserve the existing ability for a freshly opened owner client to cancel a shared pending job after it has read that receipt.

### P2: queued return discards the receipt needed to target its job

`web/src/companion/controller.ts:135-143` captures `pendingJobId` when a return is queued, before the earlier away request resolves. The incremented operation suppresses that away receipt entirely, including internal identity tracking. Consequently the queued return has no job ID even when the successful admission receipt arrives before return execution. A lost receipt also loses the original request ID: only away actions receive `requestId`.

Reproduction: keep the away promise pending, call `returned()`, resolve away with job A, then inspect the serialized return arguments. Its job ID is `undefined`. Rejecting away after server admission and then returning similarly sends no original request identity. These are two separate new web regression tests.

Recommended fix: retain admission identity internally even when a superseded receipt should not be rendered; resolve the return target when its queued request actually executes; preserve the original away request ID for response-loss recovery. This must ship together with the server targeting fix above.

### P2: a delayed same-generation receipt regresses fresh state

`snapshot()` updates the current pending job but does not invalidate already-running receipt rendering. `send()` checks owner/life and operation, but a fresh same-generation snapshot does not change either. Main's `onServerSummary` directly renders the old complete summary.

Reproduction: an existing job is five seconds from completion; another away call deduplicates it and its response waits in transit. A concurrent state read returns the completed gift and newer step count; then the delayed away response arrives with an empty collection and old pending job. The controller renders the old summary, temporarily removing the finished gift and reverting the step count. The test keeps this race within the real API's twelve-second deadline.

Recommended fix: fence receipt rendering against newer accepted snapshots, while still retaining its admission identity for any queued cancellation. Do not let the display fence accidentally drop the cancellation target.

## New executable evidence

| Command | Initial audit result |
| --- | --- |
| `cd web && npm test -- test/gift-adversary.test.ts` | 3 failed, 1 passed |
| `cd worker && npm test -- test/gift-adversary.test.ts` | 2 failed, 1 passed |

These were ordinary failing regression tests supplied to the root agent for its coordinated production fix. Counts above describe the audited baseline. After the fix, the independent files contain five web tests and five worker tests, all passing. Additional tests verify that no-ID return/cancel is a no-op, matching original request identity can cancel after response loss, and a queued return is never redirected to a newer job learned from an intervening snapshot.

Final verification:

- `cd web && npm test -- test/gift-adversary.test.ts test/companion-controller.test.ts test/gift-ui.test.ts`: 27 passed.
- `cd worker && npm test -- test/gift-adversary.test.ts test/gifts.test.ts test/gifts-do.test.ts test/companion-api.test.ts`: 70 passed.
- `npm run typecheck` passed in both packages after the production fixes.

Passing independent checks:

- A real backend keepalive fetch that never resolves aborts after twelve seconds, releases the serialized return queue, and requests fresh state. An initial concern about an unbounded production hang was withdrawn after this test.
- An alarm completing while a return is still authenticating persists the exact generated gift. The subsequently authenticated return and another alarm preserve those bytes without another provider call.

## Other audited boundaries

The current generator performs bounded procedural ASCII composition, stores authored bilingual notes and explicit provenance, and performs no model call. It produces fresh combinations rather than selecting an existing shelf item. Randomized geometry does not establish globally collision-free drawings; current UI copy says “fresh procedural drawing,” which is an appropriate claim.

The existing dedicated suites cover owner mismatch/unknown-owner response parity, phrase-only feed privacy, private seed/request exclusion, daily completion fences, reset/death generation changes, clock rollback, midnight crossover, expiry, capacity retention, repeated alarms, malformed art/text rejection, and legacy/current collection separation. Source inspection found gift rendering uses `textContent`, with LTR art and localized prose. No additional owner-secret exposure was identified.

Best-effort hidden-tab scheduling has no cross-tab presence coordination in the reviewed source. A hidden peer may therefore admit a gift while another tab remains visible; a current pending receipt is shared, but a continuously visible peer does not automatically cancel it. The architecture review requested BroadcastChannel presence suppression. This remains a product limitation to address or document; it is separate from the confirmed stale-return race.

Malformed internal ledger normalization was considered but not elevated: normal owner API input cannot write arbitrary `GiftLedger` values. The review prioritizes the reachable response and request races above rather than manufacturing corrupted durable storage as an external attack.
