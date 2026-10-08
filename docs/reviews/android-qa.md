# Android integration QA, 2026-10-09

Source checkpoint: `0ab59b5`. Built from a clean GitHub clone at
`workstation:/home/tamlik/truffle-source/review-20261008`. No source checkout
was copied between machines. No build ran on the laptop.

## Build and unit checks

```text
./gradlew assembleDebug testDebugUnitTest lintDebug --no-daemon \
  -Dorg.gradle.java.home=/home/tamlik/jdks/jdk-17.0.20.1+1
BUILD SUCCESSFUL
61 tests, 0 failures, 0 errors, 0 skipped
Lint: 0 errors, 41 warnings
```

Test suites: AppLink 8, AppSettings 9, FeedEnvelope 6, FeedProtocol 10,
FeedRejection 11, WalkChart 14, WalkWindows 3. New checks cover API-origin
ownership reset, invalid origin atomicity, stale secret removal, device-zone
day boundaries, travel, and 23/25 hour daylight-saving days.

Lint warnings: 29 text/localization, 9 Kotlin extension suggestions, 2 dependency
version notices, 1 obsolete SDK guard. The SDK emits an XML metadata-version
warning and the Java 25 wrapper launcher emits its native-access notice. The
Gradle daemon uses JDK 17.

Packaged application: `dev.truffle.feeder`, version `0.2.0` / code `2`, min SDK 28,
target/compile SDK 36, label `Truffle`. Permissions are Internet, Steps read,
Distance read, and background health read. The authored adaptive icon is included.

APK: `fleet/outbox/B14/raw/codex-qa/app-debug.apk` (ignored build artifact).
SHA-256: `788d070e759dae2c3a91df22ecfcc05727e0a4dc1203117fb09ce4faa76db4e0`.

## Android 16 emulator checks

Device: `emulator-5556` on the workstation. Installed with `adb install -r`.
These checks exercised the actual Views, WebView and Health Connect permission
UI, using UI hierarchy inspection and screenshots. Stored credential checks
printed only boolean assertions. No ownership secret appears in this report.

- World loads the deployed web page inside the native three-tab shell.
- An imported test pet requires confirmation on a fresh install. Cancel leaves
  ownership empty. Open stores that pet. Cancelling another pet's replacement
  retains the first pet.
- Feed displays the app-owned phrase read-only.
- Walk initially offers its permission action. The Health Connect dialog asks
  for Steps and Distance, with background read in a separate dialog.
- Granting Steps while denying Distance and background access renders the
  hourly and 30-day charts. No distance value is fabricated. This emulator had
  no step records, so this verifies the zero-data path, not nonzero accuracy.
- Editing the API origin does not save it. Cancel on Save retains the current
  pet. Confirming the switch clears phrase, secret and active day zone.
- Changing World origin requires explicit trust before sharing the pet's key.
  Cancelling retains the original origin and pet.
- Forget clears native ownership and returns to pairing. A fresh UI hierarchy
  after stopping and reopening the process still shows the pairing action.
- One isolated production test pet was created through native `POST /pair`.
  A foreground Health Connect read sent **0 steps** for `2026-10-09` and was
  accepted: `Spore | asleep | asleep | energy 0/6000 | steps 0`.
  The test pet's credentials were then forgotten on the emulator. No chat or
  model call was made. This ran against the deployed API before the new Worker
  safeguard deployment, so the new admission rules are covered by Worker tests.
  The embedded old web build showed a spawn-rate-limit error instead of adopting
  the native pet. Native API pairing/feed passed; World ownership handoff must
  be rechecked after deploying the new web build. The World screenshot records
  this limitation rather than a successful ownership integration.

Screenshots are in `fleet/outbox/B14/raw/codex-qa/`: `truffle-qa-feed.png`,
`truffle-qa-walk.png`, `truffle-qa-walk-steps-only.png`,
`truffle-qa-origin-confirm.png`, `truffle-qa-web-origin-confirm.png`,
`truffle-qa-forgotten.png`, `truffle-qa-native-world.png`, and
`truffle-qa-native-feed.png`. These are test evidence, not real-walk evidence.

## Limits

The native shell is English; the embedded world supports English and Arabic.
The 30-day analytics window caps the available streak history. Nonzero Samsung
step accuracy, positive distance records, an actual hourly background run,
long-running battery behavior, TalkBack and physical-phone frame rate require
separate device checks. Unit tests prove the selected calendar windows; the
emulator run did not exercise travel with real historical records.

## Samsung upgrade checkpoint

Ahmed connected his Samsung SM-A366B by USB to the laptop and authorized the
upgrade and device checks. It runs Android SDK 36. The installed feeder was
version 0.1.0/code 1, with Steps and background read already granted. It had a
saved phrase and pinned zone, but no native ownership secret.

`adb install -r` upgraded it to version 0.2.0/code 2. A before/after comparison
verified that phrase, API origin, pinned zone, and ownership state were unchanged.
Steps and background grants remained enabled. No uninstall, data clear, synthetic
pet import, or new-pet creation ran on the Samsung. Its existing web pet still
needs the updated web handoff before World can own the same pet.

The laptop's native ADB backend lost the USB transport after about a minute
despite the USB device remaining present. Restarting with `ADB_LIBUSB=1` allowed
the upgrade. No Android SDK or build tooling was installed on the laptop.

The current Tasker recipe now sends required `day` and `day_tz`, rejects a
day/zone change during a read, and explains that a mismatched aggregation window
must be read again. Its two JavaScript snippets executed together successfully
with a synthetic aggregate fixture. Tasker itself was not run.

## Samsung real-pet handoff and Health Connect check

After the public web deployment (`283e981`), Chrome and the legacy feeder held
different pets. Neither was silently replaced. Ahmed explicitly chose the pet
currently in Chrome. A private preferences snapshot was taken outside the repository immediately
before the observed handoff, but it already matches the chosen pet; it does not
prove recoverability of the earlier legacy phrase. Chrome's **Open in the Truffle
app** action and subsequent checks confirmed native ownership of the chosen pet,
without printing either phrase or key. The precise adoption moment may include a
user action while the phone was open.

The updated Chrome world reported **30 fps**, compose **0.7 ms**, paint **1.2 ms**
on the SM-A366B. This is an on-screen sample, not a sustained performance trace.
The pre-refresh old page had shown 12 fps. The new page's diagnostic lives in the
combined HUD, so looking for the old standalone `fps` element is insufficient.

At 00:28 on 2026-10-09, the native app read real Health Connect and successfully
fed **0 steps**, with the server accepting date `2026-10-09` and zone
`Asia/Muscat`. Samsung Health independently showed **0 steps today**, and native
Walk also showed **0**. The historical 30-day chart contained nonzero records;
distance denial correctly omitted distance. This confirms the actual source,
calendar and upload path after midnight. It does **not** verify positive new
walking increments. No synthetic health records or pet were put on the Samsung.
