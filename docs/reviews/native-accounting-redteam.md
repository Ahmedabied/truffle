# Native accounting review — 2026-10-09

Scope: `NativeTracking.kt`, `NativeWalkStore.kt`, `StepCounterService.kt`,
`CounterObservation.kt`, `SensorAccumulator.kt`, `FeedSender.kt`,
`MainActivity.kt`, and `CompanionReminderWorker.kt`. Read-only review initially;
the coordinating agent subsequently authorized the new pure rollover policy and
its tests. The app agent owns integration changes to existing Android files.

## Confirmed defect: first upload of each new day excluded safe native steps

Severity: important accounting loss during ordinary continuous use.

Before correction, `NativeTracking.total()` rejected yesterday's feed baseline,
read the current server total, called `NativeWalkStore.confirm()`, and returned
only the server total. `confirm()` set the new native baseline to all locally
recorded steps for the current day. This permanently excluded the steps recorded
before the first upload of that day.

Deterministic reproduction:

1. Keep a previously confirmed direct-counting session enabled across midnight.
2. Let the first sample crossing midnight establish a new sensor anchor. The
   ambiguous crossing delta is correctly excluded.
3. Record another 1,000 steps entirely within the new day.
4. Run the first new-day feed while the server has credited zero steps today.
5. Before correction, the upload is zero and the stored native baseline is
   1,000. Another ten steps produces a total of ten, permanently losing credit
   for the preceding 1,000.

This is independent of the already-corrected initial cached sensor timestamp.
It affects unambiguous same-day steps after the midnight crossing.

## Coordinated correction

The new pure `confirmedSensorBaseline()` policy carries the greater of the
confirmed server total and the current native day total only when the caller
establishes the same owner and continued direct selection, and the prior valid
baseline belongs to an earlier day in the same pinned zone. It anchors future
native growth to the current local total. The first example therefore returns
1,000, repeats remain 1,000, and ten additional steps returns 1,010. Taking the
maximum prevents summing overlapping absolute server and native totals.

First activation, absent confirmation, source/owner changes, same-day
reconfirmation, zone changes, and wall-clock rollback retain the conservative
server-only starting total. Offline counts before the first ever confirmation
are intentionally retained only in the diary, matching the documented contract.

Eight new JUnit tests cover the rollover loss and repeat upload, overlapping
server counts, source/owner boundaries, initial offline confirmation, same-day
confirmation, rollback/malformed dates, changed zones, and skipped upload days.
The app agent integrates the helper into `NativeWalkStore.confirm()` and returns
its credited total from `NativeTracking.total()`.

## Verification and limits

The defect was established from the exact production state transition above.
New tests were authored before the new policy implementation. Local whitespace
validation passes. Kotlin/JUnit execution and the Android build remain assigned
to the coordinating app agent on the workstation through GitHub; no local SDK,
tool installation, Gradle invocation, emulator, or Samsung access was performed
for this review. Do not interpret this report as a completed runtime test result.

No other reproducible important defect was established in the reviewed
source-transition, saved-counter restart/reset, owner-change, permission, or
reminder paths. Device behavior after Android task-manager stop and physical
walking still depends on the separately coordinated device verification.
