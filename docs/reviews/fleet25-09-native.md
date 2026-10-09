# Fleet 25 / 09: native companion changes

Date: 2026-10-09. Decision 0023 implementation. Android version 0.4.0, code 4.

## Credential-free movement protocol

`AppLink.worldUrl` adds an ephemeral UUID as `native_scope` beside the existing
`#creds` owner import. The ownership flow still verifies that import in web.
Each fresh native load, reload, root-page navigation, owner change, origin
change or replacement WebView gets a new scope. No scope is persisted.

The one-way DOM event is `truffle:native-movement`. Its detail is exactly:

```json
{
  "version": 1,
  "scope": "<document UUID>",
  "eventId": "<document UUID>-<monotonic document counter>",
  "delta": 3,
  "observedAt": 1791532800000,
  "intervalMs": 3000
}
```

No phrase, ownership secret, raw hardware counter, energy, location or model
instruction appears in this event. `evaluateJavascript` receives a JSON-quoted
payload. There is no `addJavascriptInterface` or JavaScript-to-native method.
Web must retain the nonce only after verifying the same native import, compare
it with the current verified scope and reject stale or malformed events.

The native guard requires the exact configured HTTPS origin, root world path,
no query, current owner and API, current document, enabled/permitted/bound direct
source, resumed activity and visible World tab. The JavaScript also checks
origin, root path and document visibility. Pause and navigation clear the visual
batch; delivery has no background replay queue. An accepted interval that began
before the current foreground visit cannot make a reaction on return.

## Positive movement and feeding

`NativeWalkStore.observe` compares `SensorAccumulator` snapshots. Only accepted
same-zone, same-boot, same-day positive diary growth makes an `AcceptedMovement`.
Baseline, zero, stale, reset, reboot, rollback, invalid bins and ambiguous
midnight observations do not signal. This does not modify accounting.

The visual buffer needs at least three accepted steps, a maximum 30-second
interval, observation age no more than 15 seconds, and at most 1,000 accepted
steps in a pulse. Events change presentation only. They never credit food.

A separate positive-only `lastMovementAt` supports reminder suppression.
Stationary samples can update the counter baseline without changing that time.

Positive growth also requests unique work after two minutes. Requests coalesce
and have a persisted five-minute throttle. A source-session token fences delayed
work and its server-directed retry. Owner binding, enabled source and permission
are checked again inside `FeedGate` before using the existing `FeedSender`.
Clock rollback suppresses repeated scheduling. Failures fall back to existing
hourly sync; these movement jobs do not make an unbounded network retry stream.
WorkManager timing is best effort and can be delayed by Android.

The existing absolute dated feed envelope, native starting-total baseline and
one-source rule remain in force. Re-selecting the current direct source retains
nonzero unsent growth. Health Connect keeps its existing hourly/manual feeding.

## Optional notes

Notes stay off by default. Health Connect can now qualify when it is the active
source and steps plus background reading are supported and granted. A fresh
last-hour aggregate suppresses the note when it contains positive steps. Paused
direct tracking never silently falls through to Health Connect.

Before posting, the worker rechecks owner, source session, permissions and the
existing reminder policy. Limits remain one pinned-local-day note and at least
24 hours between notes, 09:00 through 18:59, with living pet, sufficient weather
evidence, no heat protection, no recent positive movement or app interaction.
No outing or movement event opts in or creates another notification stream.

V2 owner snapshots count a pet as well fed at 1,500 absolute food points or
3,000 steps today. This avoids requiring half of expanded storage capacity.
V1 retains its 50-percent-or-3,000-step rule. Missing/malformed v2 food suppresses
a note conservatively.

## Verification status

Source tests cover accepted movement and discontinuities, zero-reading reminder
timestamps, fresh bounded visual batching, foreground return, exact document
origin/nonce/owner gates, credential-free payload shape, source permission
transitions, nonzero same-source continuity, stale work fencing, request throttle
and v1/v2 well-fed thresholds. Existing reminder and accounting tests remain.

Source checkpoint `438821638e450d8ba7751aa99be46358aa3165e5` was committed on
the laptop, pushed to GitHub and pulled with `git pull --ff-only` at
`workstation:/home/tamlik/truffle-source/review-20261008`. The workstation
checkout remained clean. No source repository was copied between machines.

```text
JAVA_HOME=/home/tamlik/jdks/jdk-17.0.20.1+1 ANDROID_HOME=/home/tamlik/Android/Sdk \
  ./gradlew assembleDebug testDebugUnitTest lintDebug --no-daemon \
  -Dorg.gradle.java.home=/home/tamlik/jdks/jdk-17.0.20.1+1
BUILD SUCCESSFUL in 33s
122 tests, 16 suites, 0 failures, 0 errors, 0 skipped
Lint: 0 errors, 64 warnings
```

Lint contains 35 text/localization warnings, 23 Kotlin extension suggestions,
3 SAM notices, 2 dependency-version notices and 1 obsolete SDK guard. Two Kotlin
extension suggestions are new; the baseline had 62 warnings. Gradle also reports
the existing SDK XML/tooling version mismatch. The first invocation stopped
before compilation because Java was absent from the remote shell PATH. Setting
`JAVA_HOME` explicitly produced the successful run above. No source fix was
needed after the checkpoint.

APK: `feeder-android/app/build/outputs/apk/debug/app-debug.apk` on the workstation.
SHA-256: `bf770f4930c3edbd47472be2220550ddb1fd50fea9b0b0b3856b9cc4d35f25c1`.

Local `git diff --check -- feeder-android docs/reviews/fleet25-09-native.md`
passed. No Gradle or Android build ran on the laptop. Tests were authored before
their implementations, but a red/green run was not performed before the checkpoint
because source may only reach the workstation through GitHub.

No phone was accessed. This change has no new physical accuracy, installed
ownership, notification delivery, WebView sensor reaction or battery evidence.
Earlier version 0.3 device evidence remains historical evidence for that build.
