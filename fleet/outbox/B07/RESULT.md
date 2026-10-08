# B07 RESULT: feeder on SDK 36, day envelope, calm rejections

Status: **done, all 5 items**. Nothing committed. Cost: **$0** (existing workstation, SDK, emulator image and Gradle cache).

Tests: **10 before, 27 after**, all green on the box. Lint: 0 errors, 20 warnings (24 before).

APK: `app-debug.apk`, 12,010,863 bytes, sha256 `ed70f2c7b19db000a799e56ad4930ce78d93447572dfcce08a5f9002a4f19ca6`. Uploaded to draft release `v0.1.0-feeder` with `--clobber`. The release is still a draft.

## Files

All changes are inside `feeder-android/`, plus this report folder.

| File | Change |
|---|---|
| `app/build.gradle.kts` | compileSdk 36, targetSdk 36, build tools 36.0.0, `connect-client:1.1.0` stable. |
| `FeedProtocol.kt` | `DayEnvelope`, `activeZone`, `dayEnvelope`, new `feedPayload`. `FeedReply` parser, `needsResend`, `decideRejection`. |
| `FeedSender.kt` | Reads in the active zone. Parses every reply, including error bodies. Resends once when the Worker's zone differs. Returns `FeedRun(status, retryAfterSeconds)`. |
| `FeedSettings.kt` | Backed by a small `FeedStore` interface, so tests can use a map. Stores `active_tz`. A changed phrase drops the old zone. Nothing clears the phrase. |
| `FeedWorker.kt` | `FeedSchedule.retryOnce`: one-time work, unique name, REPLACE, delay clamped to 1 to 3600 s. A retry run never schedules another retry. |
| `HealthSteps.kt` | `readWindow(window, background)` replaces `readToday`. The window comes from the caller. |
| `MainActivity.kt` | Schedules the retry after Feed now. Listens on the preferences directly. |
| `PermissionsRationaleActivity.kt` | Privacy text now says what is sent: the day label, its zone and the device zone. |
| `README.md` | SDK 36 table, the day envelope, a rejection table, B07 verification. |
| `app/src/test/.../FeedEnvelopeTest.kt` | **New**, 6 tests. |
| `app/src/test/.../FeedRejectionTest.kt` | **New**, 11 tests. |
| `app/src/test/.../FeedProtocolTest.kt` | One existing test updated for the new payload (see item 4). |
| `fleet/outbox/B07/smoke_emulator.py` | Emulator check against the live Worker. Reads the phrase from a local file and never prints it. |

## Per item

### 1. compileSdk 36 and Health Connect 1.1.0 stable

The bump built on the first try with AGP 8.9.2 and Gradle 8.12. No code needed changing for it. No metadata check is bypassed. The permission set is unchanged and has no location permission:

```text
$ aapt2 dump permissions app-debug.apk
package: dev.truffle.feeder
uses-permission: name='android.permission.INTERNET'
uses-permission: name='android.permission.health.READ_STEPS'
uses-permission: name='android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND'
$ aapt2 dump badging app-debug.apk | grep -E "^package|targetSdk"
package: name='dev.truffle.feeder' versionCode='1' versionName='0.1.0' platformBuildVersionName='16' platformBuildVersionCode='36' compileSdkVersion='36' compileSdkVersionCodename='16'
targetSdkVersion:'36'
```

### 2. Day envelope

Body: `{"phrase","steps_today_total","day","day_tz","device_tz"}`.

- `day` is today's date in the active zone. `day_tz` is that zone. `device_tz` is the phone's zone.
- The active zone is the `active_tz` from the last `/feed` reply. Before any reply it is the device zone. The feeder only gets a phrase, never the `/pair` reply, so the feed reply is its only source for the zone.
- Steps are summed from midnight in the active zone to now.
- If a reply names a zone other than the one used for the sum, the app sums again in that zone and sends once more. The same happens when the Worker ignored the day label.
- A total is never sent under a day label that ended during the read.

**Field name note.** `day_tz` is not in the Worker. `worker/src/do.ts` `FeedInput` and the `/feed` route read `phrase`, `steps_today_total`, `lat`, `lon`, `device_tz` and `day`. The reply has `expected_day` and `active_tz`. The packet asked for `day_tz`, so the app sends it. The Worker ignores unknown fields today (verified live below). All the other names match the Worker exactly.

### 3. Rejections

| Reply | Status line | Retry |
|---|---|---|
| 400 with `retry_after_s` | `Synced too fast, trying again in N s.` | One retry after N s (clamped 1 to 3600). If the retry is refused again: `Synced too fast. The next sync will try again.` and no further retry. |
| 429 with `retry_after_s` | Same as above | Same |
| 400 without it | The Worker's `error`, with control characters removed and cut to 200 characters. If it is missing or not JSON: `The server refused this sync. Nothing changed.` | None |
| 401 | `Phrase not recognised. Copy it again from the web app.` | None |
| 404 | Same as 401. The live `/feed` answers 404 for an unknown phrase. | None |
| 408, other 429, 5xx | `The server had trouble (HTTP N). Steps stay on the phone. Sync will try again.` | Hourly worker backoff, not on a retry run |

No raw body ever reaches the screen: the parser only pulls `error`, `retry_after_s`, `expected_day`, `active_tz`, `ignored` and the known state fields. No rejection path writes the phrase or server.

### 4. Unit tests

Test-first. The two new test files were written first and failed to compile (`Unresolved reference 'dayEnvelope'`, `'activeZone'`, `'parseFeedReply'`, `'FeedReply'` and others). Then the code made them pass.

New tests cover: the day and window in the active zone (Muscat vs London around Muscat midnight), the exact payload key set, falling back to the device zone, storing a valid `active_tz` and refusing a bad one, the resend rule, a calm retry for 400 with `retry_after_s`, no second retry on a retry run, delay clamping, the Worker error text for a 400, cleaning and length of that text, no raw body for unreadable replies, 401 and 404 lines, 429, 5xx, and **the phrase and server survive every rejection** (through `FeedSettings` on a map store).

**Change to an existing test.** `payloadContainsAbsoluteTotalAndTimezoneOnly` asserted the old key set `{phrase, steps_today_total, device_tz}`. That contract changed by design, so the test now asserts the five-key set. It still checks the total, phrase, zone and no `lat`/`lon`. `zeroStepsAreValidAndNegativeStepsAreRejected` now builds its payload from an envelope. The other 8 are untouched. All 10 pass.

Before (box, original source):

```text
$ ./gradlew testDebugUnitTest --no-daemon -q
tests 10 failures 0
```

After (box, final source, clean build):

```text
$ ./gradlew clean assembleDebug testDebugUnitTest lintDebug --no-daemon
BUILD SUCCESSFUL in 27s
50 actionable tasks: 50 executed
0 errors, 20 warnings
TEST-dev.truffle.feeder.FeedEnvelopeTest.xml tests 6 failures 0 errors 0
TEST-dev.truffle.feeder.FeedProtocolTest.xml tests 10 failures 0 errors 0
TEST-dev.truffle.feeder.FeedRejectionTest.xml tests 11 failures 0 errors 0
total 27 failed 0
```

The lint warnings are all from before B07: English-only string literals, a missing launcher icon, `Uri.parse` KTX hints, and newer `activity-ktx` and `work-runtime-ktx` versions. Full log: `raw/build.log`.

### 5. Box build, emulator, release

Built and tested on `ssh workstation` only. JDK 17 at `/home/tamlik/jdks/jdk-17.0.20.1+1`. Source synced with rsync, excluding `build` and `.gradle`. Only the APK and logs came back.

Signature:

```text
$ apksigner verify --print-certs app-debug.apk
Signer #1 certificate DN: C=US, O=Android, CN=Android Debug
signature-ok
```

**Emulator.** Android 16 `Tamlik_Pixel`, started read-only with no snapshot on port 5580. Steps and background read were granted through the real Health Connect screens. A fresh Truffle was paired with `POST https://truffle.ahmed-abied.workers.dev/pair` (HTTP 200, tz Asia/Muscat). The guest zone was set to Europe/London, so the device zone and the Truffle's zone differ. The run below is on the **final APK** (the sha256 above). `raw/emulator-smoke.log`:

```text
Device Android 16
Clear test app: Success
Guest zone: Europe/London
PASS: Steps and background read granted
400 status: phrase must be three words from the list, like sand-moon-fig
PASS: 400 shows the Worker error text, phrase kept
404 status: Phrase not recognised. Copy it again from the web app.
PASS: unknown phrase shows the copy-again line, phrase kept
200 status: 10:02: Sent 0 steps for 2026-10-08. Spore | asleep | asleep | energy 0/6000 | steps 0
Stored active_tz: Asia/Muscat
PASS: 200, envelope echo parsed, active zone stored
Second 200 status: 10:04: Sent 0 steps for 2026-10-08. Spore | asleep | asleep | energy 0/6000 | steps 0
PASS: second feed uses the stored zone
```

`FATAL EXCEPTION` lines in logcat: 0. The emulator was stopped with `emu kill`.

**Envelope echo, live.** The same envelope replayed with curl (phrase redacted). The Worker echoes `expected_day` and `active_tz`. A closed day is ignored without error. `day_tz` causes no rejection. `raw/curl-envelope.log`:

```text
request: {"phrase":"<phrase>","steps_today_total":0,"day":"2026-10-08","day_tz":"Asia/Muscat","device_tz":"Europe/London"}
{"energy":0,"energy_max":6000,"stage":"Spore","mood":"asleep","tier":"asleep","steps_today":0,"burrowed":false,"expected_day":"2026-10-08","active_tz":"Asia/Muscat"}
HTTP 200
request: {"phrase":"<phrase>","steps_today_total":0,"day":"2026-10-07","day_tz":"Europe/London","device_tz":"Europe/London"}
{"energy":0,"energy_max":6000,"stage":"Spore","mood":"asleep","tier":"asleep","steps_today":0,"burrowed":false,"expected_day":"2026-10-08","active_tz":"Asia/Muscat","ignored":"day 2026-10-07 is already closed"}
HTTP 200
```

**Release.**

```text
$ gh release upload v0.1.0-feeder app-debug.apk --clobber
$ gh release view v0.1.0-feeder --json isDraft,assets
{"assets":[{"name":"app-debug.apk","size":12010863,"updatedAt":"2026-10-08T09:04:26Z"}],"isDraft":true}
$ gh release download v0.1.0-feeder -p app-debug.apk -O - | sha256sum
ed70f2c7b19db000a799e56ad4930ce78d93447572dfcce08a5f9002a4f19ca6  -
```

## What was not tested live

- **The `retry_after_s` path on a device.** The emulator has no step data, so every total is 0. The jump cap only fires on an increase. Unit tests cover the decision. WorkManager scheduling of the one-time retry was not seen running.
- **Steps above 0 and the 2% Samsung comparison.** Still needs the phone (B04 acceptance).
- **The zone resend on the wire.** On the emulator, London and Muscat had the same date, so the first send was accepted and the resend went out with `day_tz` Asia/Muscat. The stored zone proves the reply was parsed. The Worker log of the second send was not read (no `wrangler tail`; worker/ is out of scope).

## Open questions

1. **`day_tz` is not a Worker field.** Keep sending it (harmless, readable in logs), or drop it, or have the Worker log it. One line either way.
2. **First feed in a differing zone can overcount once.** Before the app has stored `active_tz`, the first total is summed in the device zone. If that first total is higher than the Muscat-zone total and the same day, the Worker keeps the higher one (it ignores lower totals). This needs a phone in a different zone from its Truffle on its very first sync. Fix options: let `/feed` accept a probe, or carry the zone in the phrase the web app shows.
3. **404 vs 401.** The packet says 401 for an unrecognised phrase. The live `/feed` answers 404. The app treats both the same.
4. **The Worker's 400 text is technical in places,** for example `phrase must be three words from the list, like sand-moon-fig`. It is shown as the Worker wrote it, per the packet. Friendlier wording would be a Worker change.
5. **Release notes** on the draft still describe the beta01 build. Only the asset was replaced. The integrator may want to edit the body before publishing.
6. **APK size** is 12 MB because it is an unminified debug build.

## Hygiene

- No phrase or secret in any file: `grep -F` for the live phrase and secret over `feeder-android/` and `fleet/outbox/B07/` found nothing. The pairing reply lives only in the session scratchpad. A screenshot that showed the phrase field was deleted.
- No em or en dashes in changed files.
- No commits. Nothing outside `feeder-android/` and `fleet/outbox/B07/` was changed. `fleet/costs.md` and the B07/B08 packets were already modified or untracked before this session and were not touched.
