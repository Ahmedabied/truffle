# Final integration audit

Reviewed October 9, 2026. Read-only source review of the final web changes and current Worker interfaces. No deployment, device interaction, shared browser use, or credential output. `STATE.md` was context; source was authoritative. Scope was local keepsakes, identity boundaries, outage/retry, native handoff, demo provenance, and heat outings.

No new high-impact regression found in the reviewed paths. One bounded recovery issue remains:

## P2 — A failed return refresh can discard an earned keepsake

**Locations:** `web/src/main.ts:300`, `web/src/main.ts:344`, `web/src/main.ts:364`, `web/src/main.ts:534`, `web/src/main.ts:901`.

**Reproduction:** Open an established pet with no keepsake awarded today, leave the page hidden for more than ten minutes, then return while `/state` is unavailable. Keep the page visible through the next 60-second `markVisit` heartbeat, then restore `/state`. The visibility handler only polls; a failed poll never reaches `refreshKeepsakes`. The heartbeat overwrites `shelf.seen` with the return-period timestamp. When recovery finally renders, `returnToShelf` sees less than ten minutes away and awards nothing. The previously completed absence has been lost.

**Evidence:** A local Node execution of the actual TypeScript `returnToShelf` implementation returned `immediate_return_awards: true` and `failed_poll_then_heartbeat_then_recovery_awards: false` for the same initial shelf, with the latter following `markVisit`'s timestamp update. This is a pure-function/source-trace reproduction, not an end-to-end browser reproduction.

**Minimal fix:** Preserve a pending absence when the page becomes visible until the next successful state render resolves eligibility. Have the visible heartbeat avoid advancing the shelf's last-seen time while that return is pending. This also avoids awarding against a stale local day or dead/alive state during an outage. Add one focused test covering failed return poll → heartbeat → recovered render.

## Other reviewed behavior

- Real shelves separate API origins and pet phrases; mock/demo shelves cannot enter real shelves. Reset/new-spore and forget paths clear the associated local collection.
- Native handoff still validates imported ownership before adoption; new Pocket placement does not alter the handoff protocol.
- Share provenance checks mock mode, route demo mode, and server demo state.
- Both explicit outing choices use the heat-specific indoor-rest copy when the pet is burrowed.
- Worker owner endpoints authenticate phrase and secret; demo mutation routes enforce the stored demo flag.

The parent supplied results of 177 web unit tests, 30 browser cases, and 428 Worker tests. This audit did not rerun those suites and does not independently claim those pass counts. Review ended at the parent's requested handoff to the energy-economy investigation.

## Integration follow-up

The integrator reproduced the issue in Chrome: the new failed-return/heartbeat
case failed against the deployed implementation, then passed after the repair.
A pending return now preserves last-seen time until a fresh backend state arrives;
local language rendering cannot resolve that pending absence. All 31 browser
scenarios, TypeScript checking and the production build passed after the change.
