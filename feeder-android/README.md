# The Truffle app

A small Kotlin app with plain Android Views. Android 9 or newer is required.
The directory is still `feeder-android/`. The application ID is still
`dev.truffle.feeder`, so version 0.4.0 is an in-place debug upgrade when signed
with the same key. The native shell is English; the embedded world supports
English and Arabic. Decision records: [0016](../decisions/0016_truffle_phone_app.md),
[0021](../decisions/0021_walking_companion_and_keepsakes.md) and
[0023](../decisions/0023_continuous_food_and_living_companion.md).

**Build status:** 0.4.0/code 4 built on the workstation at `0a3c56c`, including
the fresh-document WebView fix, with 129 JVM tests passing and lint at
0 errors / 69 warnings. Three emulator reloads created fresh views and retained
synthetic owner settings. This was not a live Truffle pairing test.
No 0.4 build has new physical-phone evidence. The previously verified public
[0.3 debug test APK](https://github.com/Ahmedabied/truffle/releases/tag/v0.3.0-app)
and its [device record](../docs/reviews/android-qa.md) remain historical evidence.
See the [submission checklist](../docs/submission_checklist.md) for the final
0.4 release checkpoint; this directory's source version alone is not a release.

## Three screens

A bottom bar switches between them. One Activity, three plain views.

- **World.** The deployed web app in a WebView
  (`https://truffle-web.ahmed-abied.workers.dev`). On first run with no pet,
  World shows one button, **make my truffle**. It calls `POST /pair` on the API
  origin, keeps the phrase and secret in private storage, and fills the Feed
  phrase. The page gets the credentials once per fresh load in the URL fragment,
  `#creds=<phrase>.<secret>&native_scope=<document UUID>`. A fragment is never
  sent in an HTTP request. The page strips it immediately and adopts the owner
  only after verification. The fresh scope permits one-way movement reactions;
  it contains no ownership secret and is not persisted. There is no query token,
  cookie or JavaScript credential bridge. **Reload World** in Feed connection
  settings creates a fresh document without a permanent toolbar. Back moves through the page's
  own history first.
- **Walk.** A walking notebook with Today, 7 days and 30 days views. Choose Health
  Connect or the direct phone counter. Each period has its own total, date span,
  coverage and summary. Today is marked in progress. Native dates without records
  are blank and excluded from averages; a recorded zero stays distinct. Health
  Connect reports dates read, with a note that zero is not proof of no walking.
  ASCII charts use legible glyphs and scroll horizontally at larger font sizes.
  Optional distance is for today only. Steps and distance only, with no calories,
  weight, heart rate or sleep. The numbers stay on the phone. The text builders live in
  `WalkChart.kt` and are unit tested.
- **Feed.** Sends the selected walking source, with connection and privacy settings under an expandable control. The phrase comes from the app's
  credentials and is read-only while the app owns the pet. Settings for the API
  origin and the web origin sit here. **Forget this truffle** removes the phrase,
  the secret and the page's stored data from the phone. The pet stays on the server.

Health Connect reads only aggregated totals; direct mode observes hardware counter increments. Feed sends today's absolute total to
`POST /feed`. It never sends raw step records.

### Moving a web pet into the app

The web app's **Open in the Truffle app** link launches
`truffle://pair?creds=<phrase>.<secret>`. The custom scheme goes from the browser
to this app and never reaches a server. The app checks both formats (three
lowercase words, and a base64url secret of 16 to 64 characters), stores them, and
shows the World. Every new imported pet needs confirmation, including on a fresh install. The
link is dropped after one use, so recents cannot replay it.

### WebView settings

JavaScript and DOM storage on. File and content access off. Mixed content never
allowed. Geolocation off. No pop-up windows. No JavaScript interface. The user
agent is the default plus ` TruffleApp/0.4`, so the page can hide its own pairing
UI and the app link. Only HTTPS pages on the configured web origin load inside.
A tapped link to any other web address opens in the browser. Other schemes are
dropped. WebView remote debugging is off even in this debug build, so USB
inspection cannot read the stored secret.

Server fields change only after **Save server settings**. A different API server
requires confirmation and removes the old pet's key and day zone. A different
World site requires confirmation before it receives the current pet's key.
Importing or forgetting a pet invalidates any older pairing request still in flight.

Health Connect's Walk view reads completed days using exact midnight instants in
the device zone, including 23 and 25 hour days. The direct diary uses the pet's
pinned active zone; a stale diary from another zone is not relabelled as current.
Today's total comes from the same hourly snapshot
as the chart. Missing distance records stay unavailable instead of showing zero.
The 30 day chart and its streak are limited to the displayed window.

## Health Connect first run (optional alternative)

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
5. Open Truffle. Tap **make my truffle** on the World screen. Or open the web
   app in the phone's browser and tap **Open in the Truffle app** to bring an
   existing pet. The API origin defaults to
   `https://truffle.ahmed-abied.workers.dev`. To use your own Worker, change it
   under Feed before pairing. Do not add `/feed`. Do not put a token in the URL.
6. Tap **Grant steps permission**. Allow Steps read access. Distance is asked
   in the same dialog. It is optional and only adds a line to Walk. On devices that expose
   background reads, also allow background health access. If the dialog stops
   appearing after a denial, use **Health Connect settings** to grant it there.
7. Tap **Feed now**. The status should show the sent total, the Truffle's day and
   the returned pet state.
   Compare today's total with Samsung Health after it finishes syncing. The only
   recorded physical Health Connect comparison was zero after midnight; no
   positive-count accuracy percentage is established. See
   [Android QA](../docs/reviews/android-qa.md).
8. For hourly sync, set **Settings > Apps > Truffle > Battery >
   Unrestricted**. Remove it from Samsung's sleeping and deep sleeping app lists.
   Keep Samsung Health able to run too. No battery exemption permission is
   requested by this app.
9. Reopen the app after a reboot or force stop. This build has no boot
   permission. Android can delay hourly work for Doze, battery, or network limits.

Background support is checked with
`FEATURE_READ_HEALTH_DATA_IN_BACKGROUND`. It needs a supporting provider and a
separate grant. Plan on Android 15 or newer for the hourly demo. An unavailable
feature leaves **Feed now** working while the app is open. The app does not assume
support from the OS version alone. Revoking either grant makes the red
**Grant steps permission** button appear on the next check or failed read.

This app has no location permission or location dependency. Health Connect uses
Steps read, optional Distance read and background health read. Direct walking adds
activity recognition and the health foreground-service permissions; optional
notifications use POST_NOTIFICATIONS. INTERNET sends the absolute daily total. `lat` and `lon` are omitted. The Worker can use its
city-level `request.cf` fallback.

## Build on the workstation only

Do not install Android SDK or Gradle on the laptop. The wrapper JAR and scripts
come from the official `gradle/gradle` tag `v8.12.0`. The wrapper checksum was
compared with Gradle's published checksum. The distribution checksum is pinned.
The `all` distribution reuses the workstation's existing Gradle 8.12 cache.

```sh
# Example checkout location; the QA clone is /home/tamlik/truffle-source/review-20261008.
# Commit and push the reviewed source first. GitHub is the only source link
# between machines. Do not rsync or copy a checkout.
ssh workstation 'git clone https://github.com/Ahmedabied/truffle.git ~/Truffle'
ssh workstation 'cd ~/Truffle && git pull --ff-only'
ssh workstation 'cd ~/Truffle/feeder-android && \
  export JAVA_HOME=/home/tamlik/android-studio/jbr \
         ANDROID_HOME=/home/tamlik/Android/Sdk && \
  ./gradlew assembleDebug testDebugUnitTest lintDebug --no-daemon \
    -Dorg.gradle.java.home=/home/tamlik/jdks/jdk-17.0.20.1+1'
mkdir -p /home/abied/Desktop/Truffle/fleet/outbox/B14/raw
scp workstation:~/Truffle/feeder-android/app/build/outputs/apk/debug/app-debug.apk \
  /home/abied/Desktop/Truffle/fleet/outbox/B14/raw/app-debug.apk
```

The workstation JBR is Java 25. Gradle 8.12's build daemon uses the already
installed JDK 17 above. No Java installation is needed. The Java 25 launcher can
print a native-access warning. It is not the build daemon.

With a connected phone, this optional command installs the APK from the box:

```sh
ssh workstation '/home/tamlik/Android/Sdk/platform-tools/adb install -r \
  /home/tamlik/Truffle/feeder-android/app/build/outputs/apk/debug/app-debug.apk'
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

### Permission boundary and background network work

The verified 0.4 APK declares these eight permissions. Steps/background access belong
to Health Connect, activity recognition to direct counting, and notifications
to the separately controlled notification features:

- `android.permission.INTERNET`
- `android.permission.health.READ_STEPS`
- `android.permission.health.READ_DISTANCE` (since 0.2.0, Walk screen only, optional)
- `android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND`
- `android.permission.ACTIVITY_RECOGNITION`
- `android.permission.FOREGROUND_SERVICE`
- `android.permission.FOREGROUND_SERVICE_HEALTH`
- `android.permission.POST_NOTIFICATIONS`

The manifest removes library-added network-state, wake-lock and boot permissions,
AndroidX Core's synthetic receiver permission, WorkManager's unused alarm and
foreground services, and its boot reschedule receiver. Direct counting has its
own health foreground service. WorkManager uses the API 28+ JobScheduler backend;
its jobs are neither expedited nor foreground workers. No location permission
is declared.

**There is no OS-level CONNECTED constraint in this restricted build.** Android
14+ requires `ACCESS_NETWORK_STATE` for a JobScheduler network constraint. Adding
`setRequiredNetworkType(CONNECTED)` without that permission throws
`SecurityException`. This remains outside the app's permission boundary.
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
- The Worker requires valid `day` and `day_tz` fields. Missing fields return 400.
  A date or aggregation-zone mismatch is ignored before crediting any steps.
  `device_tz` is optional and never moves the pet's pinned midnight.

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
- Phrase, secret, API origin and web origin live in private SharedPreferences. The latest status is
  stored there too. Backup and device transfer are disabled. There is no analytics
  SDK, location trail, or application logging of payloads.
- The permission rationale Activity supports both the Health Connect APK intent
  and the Android 14 `VIEW_PERMISSION_USAGE` alias pattern.
- One unique hourly job is scheduled after valid pairing and both grants. Android
  timing is inexact. A manual tap does not enqueue another periodic job.

## Optional historical Tasker bridge recipe

This earlier recipe is source-checked, not phone-tested. The app's direct counter
is the simpler available route when Health Connect is unsuitable. Install Tasker if already
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
This bridge sums in the device zone. Use it only while that zone matches the
pet's `active_tz`. If the Worker returns `ignored` with a different zone, use the
app to read the correct window. Do not relabel an existing total to another zone.

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
   var feed_day = midnight.getFullYear() + "-" +
     String(midnight.getMonth() + 1).padStart(2, "0") + "-" +
     String(midnight.getDate()).padStart(2, "0");
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
   var now = new Date();
   var current_day = now.getFullYear() + "-" +
     String(now.getMonth() + 1).padStart(2, "0") + "-" +
     String(now.getDate()).padStart(2, "0");
   if (current_day !== feed_day || Intl.DateTimeFormat().resolvedOptions().timeZone !== device_tz) {
     throw new Error("The day or zone changed. Read steps again.");
   }
   var feed_body = JSON.stringify({
     phrase: global("TrufflePhrase"),
     steps_today_total: total,
     day: feed_day,
     day_tz: device_tz,
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
   - Check `%http_response_code` is 2xx and the reply has no `ignored` field.
     Inspect `%http_data` privately for `expected_day`, `active_tz` and state.
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

For final 0.4 source `0a3c56c`, the workstation ran `assembleDebug testDebugUnitTest
lintDebug`: 129 JVM tests passed, lint had 0 errors / 69 warnings, and the build
succeeded. The remaining warnings are recorded in the
[artifact review](../docs/reviews/fleet25-24-release.md). The debug APK is
12,588,066 bytes, with SHA-256
`1ddc5b0d50240a610078c36693580f4fa5074500a0aab1d7afd429f97ae47962`.

On the disposable Android 16 emulator, synthetic native records verified Today,
7-day and 30-day totals, missing-versus-zero display, large numbers, 200% text,
vertical/horizontal scrolling and structural accessibility descriptions. These
were fabricated display fixtures, not walking or credited food. Original emulator
preferences were restored. There was no spoken TalkBack check.

The [identity review](../docs/reviews/fleet25-21-identity.md) fixes refresh by
replacing the WebView and creating a new document scope. The final build includes
that edit. Three emulator reloads each produced a new stable native WebView and
retained synthetic owner/settings fields. The fixture used a harmless HTTPS
page with counting paused; it did not verify a live Truffle owner, JavaScript
nonce acceptance or web local-storage preservation. Desktop browser regressions
separately cover the import/event boundary. [Native reload evidence](../docs/reviews/fleet25-24-release.md).

Historical 0.3 evidence on Samsung SM-A366B includes retained ownership through
upgrade, the same selected pet in World, an 81-step hardware-counter reading and
an accepted dated 81-step feed. It had no manually counted reference. The earlier
Samsung Health / Health Connect agreement was a separate zero-step check.
[Android QA](../docs/reviews/android-qa.md) preserves those versions, checksums
and limits. Older build reports remain under `fleet/outbox/B07`, `B14` and `S02`.

## Verification checklist still needed on a phone

- Install the final 0.4 debug build and verify selected-pet import and reload.
- Observe a fresh native movement reaction in World without a false food credit.
- Compare the direct counter with manually counted steps; compare positive
  Health Connect totals with Samsung Health after sync settles.
- Confirm provider installation, denial, re-grant, and auto-revocation recovery.
- Verify an hourly read while the screen is off on a supported Android 15+ phone.
- Check the coalesced movement feed, notification delivery and battery/endurance.
- Turn network off, restore it, and verify a fresh total is posted on retry.
- Check both rationale entry points, TalkBack and keyboard/system-bar layout.
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

## Direct walking and 0.4 companion behavior

Walk offers an explicit **Count with this phone** choice using Android's hardware
`TYPE_STEP_COUNTER`. Samsung Health is not required. Physical activity permission
and a silent, low-importance foreground-service notice are required by this mode;
no GPS, microphone or raw accelerometer inference is used. Devices without that
sensor retain Health Connect. The app does not restart tracking on boot.

Only one source uploads. Switching to phone counting waits for an in-flight feed,
reads the owner's current credited total and pinned date/zone, then adds only new
phone increments after that baseline. Health Connect full-day totals are never
added to native full-day totals. A failed baseline read keeps new counts in the
local diary until confirmation; pre-confirmation counts are not guessed into
credits. An ambiguous midnight or counter reset rebaselines conservatively.
Pausing/resuming the same day preserves safe unsent counts. Android task-manager
stops, reboot and activity-permission revocation require an explicit resume.

The diary labels phone counts as partial coverage and bins hours by observed
increments. Switching back to Health Connect may temporarily leave its total
behind the already credited count; the Worker's maximum prevents double credit.

Quiet companion notes are a separate switch, off by default. They require
notification permission, recent trustworthy safe weather, a living pet that is
not well fed or heat-protected, no recent app/walking activity, and local time
09:00 to 18:59. There is at most one per local day and a minimum 24-hour gap. Both
notification channels are silent. No missed nudge is retried or escalated.
Android may delay hourly sync and reminder checks; neither is an exact schedule.

Decision 0023 adds a one-way `truffle:native-movement` event after fresh accepted
positive direct-counter growth. Delivery needs a verified owner import, current
document nonce, correct origin, permitted active source, resumed Activity and
visible World. Its bounded payload contains no phrase, secret, raw sensor counter,
food or location. It can change the face promptly, but cannot credit food or
establish that someone was outdoors. Navigation and pause discard stale reactions.
There is no JavaScript-to-native credential interface.

Positive movement separately requests a coalesced feed after two minutes, with a
persisted five-minute throttle and source-session checks. Android may delay it;
manual and hourly feeding remain. Stationary sensor callbacks do not refresh the
last-positive-movement time used to suppress optional notes.

Health Connect can qualify for optional companion notes only while it is the
active source with supported and granted background reads. Recent positive
activity suppresses a note. Paused direct counting never silently switches to
Health Connect. V2 treats 1,500 stored food or 3,000 steps today as well fed, so
expanded storage does not increase reminder pressure. Notes remain off by default.

The embedded world follows server v2 food rules: 1,000 points per elapsed day at
every age, no midnight debit, heat-paused maintenance and an exact 96-hour empty
clock outside shelter. Server alarms can make procedural ASCII gifts after an
accepted away plan. These gifts use no model and no food; the app is not running
background inference. [Native protocol and test boundaries](../docs/reviews/fleet25-09-native.md).
