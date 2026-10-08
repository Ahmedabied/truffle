# Truffle Feeder

A small Kotlin app with plain Android Views. Android 9 or newer is required.
It reads today's aggregated Health Connect steps. It sends the absolute total to
`POST /feed`. It never sends raw step records.

## Samsung first run

1. Update Samsung Health. Set the phone's date and time zone correctly.
2. Open **Samsung Health > Settings > Health Connect**. Allow Samsung Health to
   write **Steps**. Read access and write access are separate. Menu names can
   differ by One UI version.
3. On Android 9 through 13, install or update Google's Health Connect app from
   Google Play if it is missing. On Android 14 or newer, look in Android Settings
   for Health Connect. Update the Google Play system module if needed.
4. Copy `app-debug.apk` to the phone. Open it in My Files. Allow this one install
   from that source if prompted. Turn that source's install permission off again.
   The application ID is `dev.truffle.feeder`.
5. Open the Truffle web app. Create a pet and copy its three-word pairing phrase.
   Enter that phrase in the feeder. Replace
   `https://truffle.<account>.workers.dev` with your deployed HTTPS Worker origin.
   Do not add `/feed`. Do not put an API token in the URL.
6. Tap **Grant steps permission**. Allow Steps read access. On devices that expose
   background reads, also allow background health access. If the dialog stops
   appearing after a denial, use **Health Connect settings** to grant it there.
7. Tap **Feed now**. The status should show the sent total, the Truffle's day and
   the returned pet state.
   Check today's total against Samsung Health after it finishes syncing. Target
   a difference below 2%. No phone comparison has been performed by this packet.
8. For hourly sync, set **Settings > Apps > Truffle Feeder > Battery >
   Unrestricted**. Remove it from Samsung's sleeping and deep sleeping app lists.
   Keep Samsung Health able to run too. No battery exemption permission is
   requested by this app.
9. Reopen the feeder after a reboot or force stop. This build has no boot
   permission. Android can delay hourly work for Doze, battery, or network limits.

Background support is checked with
`FEATURE_READ_HEALTH_DATA_IN_BACKGROUND`. It needs a supporting provider and a
separate grant. Plan on Android 15 or newer for the hourly demo. An unavailable
feature leaves **Feed now** working while the app is open. The app does not assume
support from the OS version alone. Revoking either grant makes the red
**Grant steps permission** button appear on the next check or failed read.

**Coarse location is a disabled, OFF-by-default TODO.** This packet permits only
Steps read, background health read, and INTERNET. There is no location permission
or location dependency. `lat` and `lon` are omitted. The Worker can use its
city-level `request.cf` fallback.

## Build on the workstation only

Do not install Android SDK or Gradle on the laptop. The wrapper JAR and scripts
come from the official `gradle/gradle` tag `v8.12.0`. The wrapper checksum was
compared with Gradle's published checksum. The distribution checksum is pinned.
The `all` distribution reuses the workstation's existing Gradle 8.12 cache.

```sh
ssh workstation 'mkdir -p ~/truffle-build/feeder-android'
rsync -a --delete --exclude build --exclude .gradle \
  /home/abied/Desktop/Truffle/feeder-android/ \
  workstation:~/truffle-build/feeder-android/
ssh workstation 'cd ~/truffle-build/feeder-android && \
  export JAVA_HOME=/home/tamlik/android-studio/jbr \
         ANDROID_HOME=/home/tamlik/Android/Sdk && \
  ./gradlew assembleDebug testDebugUnitTest lintDebug --no-daemon \
    -Dorg.gradle.java.home=/home/tamlik/jdks/jdk-17.0.20.1+1'
mkdir -p /home/abied/Desktop/Truffle/fleet/outbox/S02/raw
scp workstation:~/truffle-build/feeder-android/app/build/outputs/apk/debug/app-debug.apk \
  /home/abied/Desktop/Truffle/fleet/outbox/S02/raw/app-debug.apk
```

The workstation JBR is Java 25. Gradle 8.12's build daemon uses the already
installed JDK 17 above. No Java installation is needed. The Java 25 launcher can
print a native-access warning. It is not the build daemon.

With a connected phone, this optional command installs the APK from the box:

```sh
ssh workstation '/home/tamlik/Android/Sdk/platform-tools/adb install -r \
  /home/tamlik/truffle-build/feeder-android/app/build/outputs/apk/debug/app-debug.apk'
```

This is a debug APK for sideloading. No release signing key is included.

### Pinned versions and compatibility findings

| Component | Version |
| --- | --- |
| Gradle | 8.12 |
| Android Gradle Plugin | 8.9.2 |
| Kotlin plugin | 2.1.20 |
| Health Connect client | 1.1.0 (stable) |
| Activity KTX | 1.10.1 |
| WorkManager KTX | 2.10.1 |
| Coroutines Android | 1.10.2 |
| JUnit, test only | 4.13.2 |
| JSON JVM implementation, test only | 20240303 |
| minSdk / targetSdk / compileSdk | 28 / 36 / 36 |
| SDK Build Tools | 36.0.0 |

**SDK 36 and stable Health Connect 1.1.0 since B07 (2026-10-08).** The stable
AAR requires `minCompileSdk=36`. S02 first pinned 1.1.0-beta01 to keep
compileSdk 35. B07 moved compileSdk and targetSdk to 36 with build tools 36.0.0.
AGP 8.9.2 and Gradle 8.12 build it with no code changes for the bump. No
metadata check is bypassed. Stable 1.1.0 includes the rc03 fix for a Health
Connect aggregate bug at DST boundaries. Our local-midnight tests verify our
interval math only. Muscat does not observe DST.

### Strict permission limit and hourly network work

The verified debug APK requests exactly these permissions:

- `android.permission.INTERNET`
- `android.permission.health.READ_STEPS`
- `android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND`

WorkManager normally merges network-state, wake-lock, boot, and foreground-service
permissions. The manifest explicitly removes those. It also removes AndroidX
Core's synthetic receiver permission, the unused alarm/foreground services, and
the boot reschedule receiver. This app uses the API 28+ JobScheduler backend. It
does not use expedited or foreground workers.

**There is no OS-level CONNECTED constraint in this restricted build.** Android
14+ requires `ACCESS_NETWORK_STATE` for a JobScheduler network constraint. Adding
`setRequiredNetworkType(CONNECTED)` without that permission throws
`SecurityException`. This conflicts with the packet's permission allowlist.
The hourly worker instead attempts HTTPS with 15-second connect/read timeouts.
Offline I/O failures, HTTP 408, 429, and server errors get exponential retries.
Each attempt reads fresh steps. It never queues an old day's payload. Other HTTP
errors stay visible for correction. A successful feed therefore needs a working
network, but Android may start the worker while offline.

If the owner later permits `ACCESS_NETWORK_STATE`, remove its manifest removal
rule and add the standard CONNECTED constraint. Boot rescheduling also needs its
own policy change. Do not silently add either permission.

## Data and implementation notes

- `HealthConnectClient.getSdkStatus` handles unavailable and update-required
  providers before `getOrCreate`.
- The permission contract is registered through Activity Result APIs.
- The query aggregates `StepsRecord.COUNT_TOTAL` from local midnight to now in
  the Truffle's active zone. It does not filter by writer. A missing aggregate is zero.

### The day envelope

The POST body names the day the total belongs to:

```json
{"phrase":"sand-moon-fig","steps_today_total":6120,
 "day":"2026-10-08","day_tz":"Asia/Muscat","device_tz":"Europe/London"}
```

- `day` is today's date (YYYY-MM-DD) in the active zone. `day_tz` is that zone.
  `device_tz` is the phone's own zone.
- The Worker pins the Truffle's zone at pairing. Every `/feed` reply echoes it as
  `active_tz`, with `expected_day`. The app stores `active_tz` and uses it for the
  next read. Before the first reply it uses the device zone.
- If a reply names a different zone than the one the steps were summed in, the app
  sums again from midnight in that zone and sends once more. This also covers a
  reply that ignored the day label. A changed phrase drops the stored zone.
- A total is never sent under a day label that ended during the read.
- The Worker reads `day` and `device_tz` today. `day_tz` is sent for clarity and
  for logs. The Worker does not read it yet.

### Rejections

The status line is always calm text. Raw response bodies are never shown.

| Reply | Status line | Action |
| --- | --- | --- |
| 400 or 429 with `retry_after_s` | `Synced too fast, trying again in N s.` | One retry after N seconds (1 to 3600). A retry that is refused again waits for the next hourly sync. |
| 400 without it | The Worker's `error` text, cleaned and cut to 200 characters | None |
| 401 or 404 | `Phrase not recognised. Copy it again from the web app.` | None |
| 408, other 429, 5xx | `The server had trouble (HTTP N). Steps stay on the phone. Sync will try again.` | Hourly worker backs off and retries |

No rejection clears the stored phrase or server. The `/feed` route answers 404 for
an unknown phrase, so 404 gets the same line as 401.
- A state summary can be a flat object, `{"state":{...}}`, or `{"summary":{...}}`.
  Only known display fields are shown. Raw HTTP error bodies are not displayed.
- The editable server must be an HTTPS origin. Redirects are rejected to avoid
  sending the phrase to another server. No custom trust manager is installed.
- Phrase and server URL live in private SharedPreferences. The latest status is
  stored there too. Backup and device transfer are disabled. There is no analytics
  SDK, location trail, or application logging of payloads.
- The permission rationale Activity supports both the Health Connect APK intent
  and the Android 14 `VIEW_PERMISSION_USAGE` alias pattern.
- One unique hourly job is scheduled after valid pairing and both grants. Android
  timing is inexact. A manual tap does not enqueue another periodic job.

## Tasker day-1 bridge recipe

This recipe is source-checked, not phone-tested. Install Tasker if already
licensed. Download TaskerHealthConnect from its
[GitHub releases](https://github.com/RafhaanShah/TaskerHealthConnect/releases).
The latest release checked was **1.0.4**, published 2026-06-03. Follow the Samsung
Health setup above. Grant only Steps read and background read when supported.

**Known bridge blocker:** the 1.0.4 aggregate configuration Activity incorrectly
asks for `repository.writePermissions`. Its Done button is gated on that set.
Do not grant unrelated write access just to dismiss it. If you cannot save the
action with minimal grants, use this feeder for day 1. The recipe below requires
a plugin release with that bug fixed, or an already saved action whose read
permissions are sufficient. The plugin's Main screen may request more record
permissions than this project needs. Review its prompts. This app does not
inherit any of the plugin's permissions.

Create a task named **Truffle feed**. Set collision handling to **Abort New Task**
so hourly and screen-on triggers do not overlap.

1. **Variables > Variable Set**: `%TrufflePhrase` to your paired three-word phrase.
   **Variables > Variable Set**: `%TruffleServer` to the HTTPS Worker origin,
   without a trailing slash. Store these only on your phone. Do not publish an
   exported task containing a real pairing phrase.
2. **Code > JavaScriptlet** with Auto Exit enabled:

   ```javascript
   var hc_end_ms = String(Date.now());
   var midnight = new Date(Number(hc_end_ms));
   midnight.setHours(0, 0, 0, 0);
   var hc_start_ms = String(midnight.getTime());
   var device_tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
   if (!device_tz) throw new Error("Could not read the device time zone");
   ```

3. **Plugin > Health Connect > Read Aggregated Data**. Some releases label the
   plugin TaskerHealthConnect. Configure:
   - Aggregate metric: `StepsRecord.COUNT_TOTAL`
   - Start time in milliseconds: `%hc_start_ms`
   - End time in milliseconds: `%hc_end_ms`
   - Leave Continue Task After Error off. A denied read must stop the feed.

   The plugin's `healthConnectResult` output becomes `%healthconnectresult` in
   Tasker. Use the action's output-variable picker to confirm the name.
4. **Variables > Variable Set**: `%hc_json` to `%healthconnectresult`.
5. **Code > JavaScriptlet** with Auto Exit enabled:

   ```javascript
   var aggregate = JSON.parse(hc_json);
   if (!aggregate.longValues) throw new Error("Missing aggregate result");
   var total = aggregate.longValues.Steps_count_total;
   if (total === undefined) total = 0;
   if (typeof total !== "number" || !isFinite(total) || total < 0 || Math.floor(total) !== total) {
     throw new Error("Invalid step total");
   }
   var feed_body = JSON.stringify({
     phrase: global("TrufflePhrase"),
     steps_today_total: total,
     device_tz: device_tz
   });
   ```

   The verified aggregate fixture is
   `{"dataOrigins":[],"doubleValues":{},"longValues":{"Steps_count_total":10}}`.
   Use the total, not a difference from the previous run.
6. **Net > HTTP Request**:
   - Method: `POST`
   - URL: `%TruffleServer/feed`
   - Headers: `Content-Type: application/json`
   - Body: `%feed_body`
   - Timeout: 30 seconds
   - Trust Any Certificate: OFF
   - Automatic redirects: OFF if that Tasker version exposes the setting
   - Check `%http_response_code` is 2xx. Inspect `%http_data` privately for state.
     Do not publish the task's run log with the phrase or response in it.
7. Add **Profiles > Time**. Select all day, repeating every **1 hour**. Attach
   **Truffle feed**. Add **Profiles > Event > Display > Display On**, attached to
   the same task. Start with those two triggers, not continuous polling.
8. Exempt Tasker and the plugin from Samsung sleeping apps. Test manually, with
   the screen off, and after an hour. Screen-on alone does not make the plugin a
   foreground Health Connect reader. If background reads are unavailable, keep
   the plugin UI open for a manual test or use the feeder's Feed now button.

Do not run both bridge and feeder hourly jobs for normal use. Identical absolute
counts are safe for the engine, but duplicate calls waste the phrase rate limit.

## Verification completed

B07 (SDK 36): the workstation build, 27 JVM unit tests and Android lint passed.
Lint has no errors and 20 warnings (English-only strings, two newer library
versions, no launcher icon). The packaged manifest has exactly the three
permissions above. `aapt2 dump badging` shows compileSdk 36 and targetSdk 36.

The Android 16 emulator was run against the live Worker with the guest zone set to
Europe/London. A Truffle paired in Asia/Muscat. Steps and background read were
granted through the real Health Connect screens. Checked: a bad phrase shows the
Worker's 400 text, an unknown phrase shows the copy-again line, both keep the
stored phrase, a real feed returns 200, the app stores `active_tz` Asia/Muscat
and a second feed succeeds. The emulator has no step data, so totals were 0. The
`retry_after_s` path is covered by unit tests only. See
`fleet/outbox/B07/RESULT.md` from the repository root.

S02 earlier checked background aggregation with a forced JobScheduler run,
failed-network retry and permission-revocation recovery. See
`fleet/outbox/S02/RESULT.md`.

## Verification checklist still needed on a phone

- Compare Samsung Health, Health Connect, and Feed now after sync settles.
- Confirm provider installation, denial, re-grant, and auto-revocation recovery.
- Verify an hourly read while the screen is off on a supported Android 15+ phone.
- Turn network off, restore it, and verify a fresh total is posted on retry.
- Check both rationale entry points and keyboard/system-bar layout.
- Reboot, reopen the app, then confirm work is rescheduled.

## Primary references

Checked 2026-10-07:

- [Health Connect releases](https://developer.android.com/jetpack/androidx/releases/health-connect)
- [Maven version metadata](https://dl.google.com/dl/android/maven2/androidx/health/connect/connect-client/maven-metadata.xml)
- [Manifest and permission setup](https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started)
- [Read and aggregate data](https://developer.android.com/health-and-fitness/guides/health-connect/develop/read-data)
- [Feature availability](https://developer.android.com/health-and-fitness/guides/health-connect/develop/feature-availability)
- [Android 14 JobScheduler permission requirement](https://developer.android.com/about/versions/14/behavior-changes-14#jobscheduler)
- [Official Gradle wrapper](https://github.com/gradle/gradle/tree/v8.12.0/gradle/wrapper)
- [Tasker aggregate input and output](https://github.com/RafhaanShah/TaskerHealthConnect/blob/1.0.4/app/src/main/java/com/rafapps/taskerhealthconnect/aggregated/ReadAggregatedData.kt)
- [Tasker aggregate permission bug](https://github.com/RafhaanShah/TaskerHealthConnect/blob/1.0.4/app/src/main/java/com/rafapps/taskerhealthconnect/aggregated/ReadAggregatedDataActivity.kt)
- [Tasker step fixture](https://github.com/RafhaanShah/TaskerHealthConnect/blob/1.0.4/app/src/test/resources/aggregated/StepsRecord.COUNT_TOTAL.json)
- [Tasker JavaScript variables](https://tasker.joaoapps.com/userguide/en/javascript.html)
