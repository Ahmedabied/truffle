# S02 result

## Outcome

The Kotlin feeder builds on the workstation. The debug APK is copied back.
All 10 unit tests pass. Android lint completes with 0 errors and 24 warnings.
The packaged APK requests exactly the three allowed permissions.
Android 16 emulator smoke checks passed, including background read and recovery
after revocation. No physical Samsung or live server result is claimed.
No Android SDK or Gradle was installed on the laptop. No paid service was used.

Two packet conflicts require explicit tradeoffs:

1. Current stable Health Connect 1.1.0 requires compileSdk 36. The requested
   compileSdk 35 is retained. This APK uses 1.1.0-beta01, the last SDK 35-compatible
   release with the needed background APIs. This is not a stable dependency.
2. A CONNECTED WorkManager constraint requires ACCESS_NETWORK_STATE on target
   34+. That permission is forbidden by the packet. This APK keeps the strict
   allowlist and retries failed HTTPS uploads. It has no OS-level network
   constraint. It also has no boot permission. Reopen it after reboot.

Physical Samsung validation and a live Worker feed are still open.

## What changed

All repository writes are inside `feeder-android/` and `fleet/outbox/S02/`.
No git commit, push, checkout, stash, or reset was run.

- `feeder-android/`: Gradle Kotlin DSL project, official wrapper JAR and scripts,
  AGP 8, minSdk 28, targetSdk 35, compileSdk 35.
- `app/src/main/AndroidManifest.xml`: Steps read, background read, INTERNET,
  Health Connect package query, rationale Activity, and Android 14 permission
  usage alias. Library-added permissions are removed from the merged manifest.
- `app/src/main/java/dev/truffle/feeder/MainActivity.kt`: plain Views, editable
  phrase/server fields, Feed now, status, red permission recovery button,
  provider install/update action, and a disabled OFF location TODO.
- `HealthSteps.kt`: availability checks, runtime background feature detection,
  permission checks, and today's `StepsRecord.COUNT_TOTAL` aggregate.
- `FeedSender.kt`, `FeedProtocol.kt`: HTTPS-only JSON POST, absolute total,
  device time zone, timeouts, no redirect forwarding, bounded response parsing,
  and compact state summaries. No location fields are sent.
- `FeedWorker.kt`: one unique hourly job, feature/grant gating, fresh reads on
  each attempt, network/server retry, and persisted permission-recovery status.
- `FeedSettings.kt`: private SharedPreferences for pairing, URL, and status.
- `PermissionsRationaleActivity.kt`: local privacy explanation for both Health
  Connect entry points. Backup and device transfer are disabled.
- `app/src/test/java/dev/truffle/feeder/FeedProtocolTest.kt`: 10 tests for Muscat
  midnight, exact midnight, both DST transitions, configuration validation,
  payload shape, zero counts, and response summaries.
- `feeder-android/README.md`: Samsung checklist, sideload/build commands, privacy,
  compatibility findings, and a source-verified Tasker bridge recipe.
- `fleet/outbox/S02/smoke_emulator.py`: repeatable emulator UI/worker checks using
  an example phrase and the reserved `.invalid` host. No live feed is sent.

## Exact versions

| Component | Version |
| --- | --- |
| Gradle wrapper/distribution | 8.12, official tag v8.12.0 |
| Android Gradle Plugin | 8.9.2 |
| Kotlin plugin and resolved stdlib | 2.1.20 |
| Health Connect client | 1.1.0-beta01 |
| Verified current stable Health Connect | 1.1.0, released 2025-10-08 |
| Activity KTX | 1.10.1 |
| WorkManager KTX | 2.10.1 |
| Coroutines Android | 1.10.2 |
| JUnit, tests only | 4.13.2 |
| org.json, tests only | 20240303 |
| SDK / Build Tools | platform 35 / 35.0.0 |
| Gradle daemon JVM | Existing Temurin 17.0.20.1+1 |
| Wrapper launcher JVM | Existing JBR 25.0.3 |

Runtime dependency resolution was also checked on the box:

```text
+--- org.jetbrains.kotlin:kotlin-stdlib:2.1.20
+--- androidx.activity:activity-ktx:1.10.1
+--- androidx.health.connect:connect-client:1.1.0-beta01
+--- androidx.work:work-runtime-ktx:2.10.1
\--- org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2 (*)
BUILD SUCCESSFUL in 9s
```

## Build evidence

The non-interactive shell has no Gradle on PATH. Gradle 8.12 is already cached.
JBR is Java 25, so the build daemon uses the existing JDK 17. No JDK was installed.

```sh
rsync -a --delete --exclude build --exclude .gradle \
  /home/abied/Desktop/Truffle/feeder-android/ \
  workstation:~/truffle-build/feeder-android/
ssh workstation 'cd ~/truffle-build/feeder-android && \
  export JAVA_HOME=/home/tamlik/android-studio/jbr \
         ANDROID_HOME=/home/tamlik/Android/Sdk && \
  ./gradlew assembleDebug testDebugUnitTest lintDebug --no-daemon \
    -Dorg.gradle.java.home=/home/tamlik/jdks/jdk-17.0.20.1+1'
```

Tail of `raw/build-verified.log`:

```text
> Task :app:compileDebugUnitTestKotlin
> Task :app:generateDebugAndroidTestLintModel
> Task :app:compileDebugUnitTestJavaWithJavac NO-SOURCE
> Task :app:processDebugUnitTestJavaRes UP-TO-DATE
> Task :app:testDebugUnitTest
> Task :app:packageDebug
> Task :app:createDebugApkListingFileRedirect UP-TO-DATE
> Task :app:assembleDebug
> Task :app:generateDebugUnitTestLintModel
> Task :app:lintAnalyzeDebugAndroidTest
> Task :app:lintAnalyzeDebugUnitTest
> Task :app:lintAnalyzeDebug

> Task :app:lintReportDebug
Wrote HTML report to file:///home/tamlik/truffle-build/feeder-android/app/build/reports/lint-results-debug.html

> Task :app:lintDebug

BUILD SUCCESSFUL in 35s
49 actionable tasks: 22 executed, 27 up-to-date
```

Test XML reports `tests="10" skipped="0" failures="0" errors="0"`.
Lint reports `0 errors, 24 warnings`. The warnings concern pinned older versions,
English UI literals, optional KTX helpers, and the generic launcher icon.
No lint errors were suppressed. Two initial literal view IDs were replaced with
resource IDs after lint flagged them.

### APK

```sh
scp workstation:~/truffle-build/feeder-android/app/build/outputs/apk/debug/app-debug.apk \
  /home/abied/Desktop/Truffle/fleet/outbox/S02/raw/app-debug.apk
stat -c '%n %s bytes' /home/abied/Desktop/Truffle/fleet/outbox/S02/raw/app-debug.apk
sha256sum /home/abied/Desktop/Truffle/fleet/outbox/S02/raw/app-debug.apk
```

```text
/home/abied/Desktop/Truffle/fleet/outbox/S02/raw/app-debug.apk 11950814 bytes
e7f9653bcac2ba375bc4211cd8712fcf66891a1e18c0b7282ce8840c536a7088  /home/abied/Desktop/Truffle/fleet/outbox/S02/raw/app-debug.apk
```

Box artifact:
`/home/tamlik/truffle-build/feeder-android/app/build/outputs/apk/debug/app-debug.apk`.
Size is 11,950,814 bytes, about 11.4 MiB. The local APK is gitignored.
`apksigner verify` passed with the existing JDK 17 `bin` directory on PATH.
No signing material was copied into the repository.

### Packaged manifest and wrapper

```sh
ssh workstation '/home/tamlik/Android/Sdk/build-tools/35.0.0/aapt dump permissions \
  /home/tamlik/truffle-build/feeder-android/app/build/outputs/apk/debug/app-debug.apk'
```

```text
package: dev.truffle.feeder
uses-permission: name='android.permission.INTERNET'
uses-permission: name='android.permission.health.READ_STEPS'
uses-permission: name='android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND'
```

`aapt dump badging` confirmed minSdk 28, targetSdk 35, and compileSdk 35.
XML assertions on the merged manifest also passed:

```text
PASS: exactly three allowed permissions; no synthetic permission
PASS: provider query and both official rationale intent patterns
PASS: backup disabled; cleartext traffic disabled
PASS: APK signature verification
```

The wrapper JAR was fetched from
`https://raw.githubusercontent.com/gradle/gradle/v8.12.0/gradle/wrapper/gradle-wrapper.jar`.
Its SHA-256 matches Gradle's published checksum:

```text
2db75c40782f5e8ba1fc278a5574bab070adccb2d21ca5a6e5ed840888448046
```

The distribution checksum is pinned in `gradle-wrapper.properties`:

```text
7ebdac923867a3cec0098302416d1e3c6c0c729fc4e2e05c10637a8af33a76c5
```

## Emulator runtime evidence

The box already had the Android 16 image and `Tamlik_Pixel` AVD. It was started
read-only with no snapshots, on port 5580. Nothing was downloaded. The test used
only `sand-moon-fig` and `https://truffle.invalid`. No real pairing or server was
used. The screenshot `raw/permission-revoked.png` confirms the red recovery UI.

Commands:

```sh
ssh workstation '/home/tamlik/Android/Sdk/emulator/emulator \
  -avd Tamlik_Pixel -read-only -no-snapshot -no-window -no-audio \
  -no-boot-anim -gpu swiftshader -port 5580'
ssh workstation '/home/tamlik/Android/Sdk/platform-tools/adb -s emulator-5580 \
  install -r /home/tamlik/truffle-build/feeder-android/app/build/outputs/apk/debug/app-debug.apk'
python3 /home/abied/Desktop/Truffle/fleet/outbox/S02/smoke_emulator.py
```

The actual emulator command was detached with `nohup` and a build-directory log.
The script exercises the real Health Connect permission screens. It advances
only the disposable guest clock by 3700 seconds to clear WorkManager's first-run
delay. It then forces the namespaced JobScheduler job. The guest clock and its
automatic-time setting are restored. This is not a real elapsed-hour battery test.

Selected output from `raw/emulator-smoke-final.log`:

```text
Device Android 16
Clear test app: Success
PASS: initial re-grant button, location disabled and OFF
PASS: Health Connect APK rationale intent
PASS: Android 14+ Health Connect privacy-policy alias
PASS: actual permission contract grants Steps and background read
Foreground result: Upload failed. Check your connection and try Feed now again.
PASS: foreground aggregate reaches transport, configuration persisted
Scheduled: JOB androidx.work.systemjobscheduler:u0a217/0: 5d421eb @androidx.work.systemjobscheduler@dev.truffle.feeder/androidx.work.impl.background.systemjob.SystemJobService
Emulator clock advanced 3700 seconds for the initial work delay
Running job [FORCED]
Background result: Upload failed. Check your connection. Hourly sync will retry.
PASS: unique periodic job reads in background and retries failed HTTPS
Revocation result: Grant steps permission to feed Truffle.
PASS: revoked permission shows re-grant UI and reopens the contract
PASS: emulator smoke checks complete; no live server or Samsung data used
```

The legacy rationale Activity was launched explicitly with its action on API 36.
The Android 14+ alias was exercised through Health Connect's actual privacy link.
An Android 9 through 13 provider has not been tested. Initial smoke-script issues
were corrected for explicit legacy launch and WorkManager's Android 14+ job
namespace. These were harness issues, not hidden app exceptions.

The failed HTTPS results are intentional. `.invalid` cannot resolve. Reaching
those messages confirms that foreground and background aggregation passed the
health permission checks and reached the transport. The test revokes READ_STEPS
with `pm revoke`, checks the red UI, and reopens the permission contract.

No app runtime crash lines were found. The read-only emulator was stopped with
`adb -s emulator-5580 emu kill` after testing.

## Compatibility findings and exact initial error

Stable version and manifest requirements were checked against Google's current
release page, Maven metadata, and Health Connect development guide. Links are in
the feeder README. The first build with stable 1.1.0 failed with:

```text
Execution failed for task ':app:checkDebugAarMetadata'.
> A failure occurred while executing com.android.build.gradle.internal.tasks.CheckAarMetadataWorkAction
   > An issue was found when checking AAR metadata:

       1.  Dependency 'androidx.health.connect:connect-client:1.1.0' requires libraries and applications that
           depend on it to compile against version 36 or later of the
           Android APIs.

           :app is currently compiled against android-35.

BUILD FAILED in 40s
```

AAR metadata was then inspected for beta02 and rc01 through rc03. All require 36.
beta01 and alpha12 require 35. beta01 was selected. Checks were not bypassed.
Stable rc03 fixed a DST aggregation bug that beta01 lacks. The unit tests prove
our interval math only, not the old library's aggregate behavior across DST.

Android's documented JobScheduler requirement is the reason for the missing
CONNECTED constraint. Adding it without ACCESS_NETWORK_STATE throws
SecurityException for target 34+. The app preserves the stricter permission rule.
The WorkManager boot receiver and unused alarm/foreground services are removed.

## Open questions and remaining work

- Should compileSdk move to 36 so Health Connect can use stable 1.1.0? This is the
  recommended follow-up. targetSdk can remain 35. It needs owner approval.
- May the feeder request ACCESS_NETWORK_STATE and RECEIVE_BOOT_COMPLETED? If
  approved, restore their manifest entries and add the standard network
  constraint and boot rescheduling. Neither is silently included now.
- Coarse location is a visible disabled TODO. No location permission is requested.
- A physical Samsung phone was not connected. Compare totals within 2%, test a
  real screen-off hour, denial/auto-revoke, reboot, and both permission paths.
- No deployed Worker URL or real pairing phrase was supplied. A successful live
  POST and server-side energy change still need integration verification.
- The Worker being built in parallel now pins the pet's time zone at pairing.
  It also has an optional `day` field and a replay/plausibility guard. This feeder
  keeps the packet's payload. Coordinate any `day` addition or travel behavior
  with the Worker owner before changing that contract.
- TaskerHealthConnect 1.0.4 has a verified aggregate configuration bug. Its
  `ReadAggregatedDataActivity` asks for `repository.writePermissions`. The base
  configuration Activity gates Done on those permissions. The README warns not
  to grant unrelated write access. Use this APK if the minimal-permission bridge
  cannot be configured. The bridge recipe is source-checked, not phone-tested.

## Cost and hygiene

Cost: **$0**. Existing workstation, SDK, JDK, Gradle cache, and emulator image only.
No analytics SDK or paid API was added. A source scan found no credential patterns
or analytics SDK references. `git diff --check` passed for the owned paths.
Prose was checked for em dashes and en dashes. APKs and raw logs remain gitignored.
