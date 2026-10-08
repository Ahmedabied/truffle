# Android integration QA, 2026-10-09

Latest installed candidate: **0.3.0/code 3**, source **`4c86a68`**. Workstation
build, **101 JVM tests**, and lint passed; **zero errors, 62 lint warnings**.
Samsung native counter recorded **81** and the Worker accepted **81**. Repeated
feeding did not add credit. After the final WebView correction, embedded World
visibly shows that same chosen 81-step pet. Step accuracy was not independently
measured. Native tracking is enabled; optional companion notes remain off.

Final debug APK: `fleet/outbox/B14/raw/codex-qa/app-0.3.0-debug.apk`.
SHA-256: `aa312a365866ae2c5895e3ecf60d9718a1968ca308c6f99e0f84fc5310cc0eab`.
[Native World proof](../assets/android-native-world-81.png),
[native Walk proof](../assets/android-walk-native-81.png),
[Samsung Chrome 60-fps sample](../assets/android-world-samsung-60fps.png).

The older checkpoints below document what was tested before later fixes; they are
not alternative release artifacts.

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

## 0.3 direct walking and device evidence

The native 0.3 checkpoint through `9a78562` was built from GitHub checkout
`5cf5465` on the workstation. `assembleDebug testDebugUnitTest lintDebug` all
passed: **101 tests in 13 suites, zero failures/errors; zero lint errors and 60
warnings**. Warnings: 35 text/localization, 19 Kotlin extension suggestions,
3 SAM-instance notices, 2 dependency versions, and 1 obsolete SDK guard.
The checked APK SHA-256 was
`7290763a658b5198c0bdf7a04d2636d29615f735a16ed7ad5734192292465e20`.
This is a debug build. A subsequent WebView ownership correction is described
below and supersedes that candidate; it must be verified before publication.

The Samsung's hardware step counter is present. The physical activity and
notification permission flow completed, and its foreground step service ran.
Health Connect Steps/background grants survived the upgrade. Optional companion
notes remained **off**. During Ahmed's actual indoor walk, the native counter
recorded **81 steps for 2026-10-09, Asia/Muscat**. Private state and the running
service independently confirmed that the selected source was the phone counter.
The source had briefly been switched to Health Connect during setup, so the
final source check was required rather than inferred from an earlier screenshot.

At 00:54 the app uploaded the native **81**, and the Worker returned steps **81**,
energy **81/6000**, tier **low**. After pausing, upgrading in place, and resuming,
the entire native tracking preference snapshot and the chosen pet's key/origin/
zone were unchanged. A repeat feed at 01:02 still returned steps **81** and energy
**81**: no duplicate credit. Ahmed did not count the walk independently, so this
proves live hardware counting and the upload path, **not step-count accuracy**.

The real sensor exposed an important timestamp edge: the initial cumulative
callback carried the timestamp of yesterday's last step. `CounterObservation`
now anchors only the first baseline to its actual observation time; later batched
callbacks retain event time. Three pure regressions cover this edge. Independent
review also found that first daily sync discarded safe steps accumulated after
the midnight anchor. Eight `SensorBaselinePolicy` regressions now preserve those
steps using the maximum of overlapping totals, with durable baseline storage
before upload. An uncertain crossing delta is still excluded.

Reviewed public evidence, containing no pairing phrase or ownership key:

- [Samsung native counter, 81 steps](../assets/android-walk-native-81.png)
- [Samsung Chrome world, 60 fps](../assets/android-world-samsung-60fps.png)

The second image shows the deployed `5cf5465` world on the physical Samsung:
**60 fps, compose 0.9 ms, paint 1.0 ms**, with its full-width night scene and chat
below. It is an on-screen Chrome sample, **not** a sustained battery/performance
trace or a direct WebView frame-time measurement.

## Final ownership gate

Final native World inspection caught a real integration defect: the native feeder
and Chrome held the selected 81-step pet, while embedded World displayed another
zero-step pet. Android suppresses JavaScript confirmation when no
`WebChromeClient` is installed. The newly required web import confirmation was
therefore silently declined. See [Android WebChromeClient documentation](https://developer.android.com/reference/android/webkit/WebChromeClient).

`4c86a68` installs an explicit, origin-checked confirmation dialog, cancels it when
the WebView is replaced/destroyed, leaves an unpaired native World unloaded until
an explicit native pairing action, and reoffers native-owned credentials on
**Reload World**. The web side separately fails closed after a declined/failed
import. Publication was held until the corrected installed World was observed
showing the same selected pet. The successful physical result is recorded below.

Remaining limits: no independently counted accuracy trial, overnight physical
rollover, reboot/task-manager-stop endurance trial, sustained battery test,
TalkBack session, or positive distance record was run. Reset, rollover, overlap
and reminder suppression have pure regression coverage; this is not a substitute
for those longer device checks. The native shell remains English.

## Final installed ownership result

Exact source `4c86a68` built successfully on the workstation with
`assembleDebug testDebugUnitTest lintDebug`: **101 tests, zero failures/errors;
zero lint errors and 62 warnings** (35 text/localization, 21 Kotlin extension
suggestions, 3 SAM notices, 2 dependency versions, 1 obsolete SDK guard).

The Samsung was paused through Walk before `adb install -r`. The complete native
tracking preference snapshot, including all 81 steps, and its chosen ownership
key/origin/zone survived unchanged. On opening World, the JavaScript confirmation
was visibly presented. Its candidate matched the app-owned phrase, and no secret
was displayed. Accepting the already-authorized chosen pet produced embedded
World's **81 steps today / 1% energy / low effort** state. The screenshot above
records the actual native shell, not a browser approximation. This closes the
positive ownership handoff gate. The new web refusal/retry paths are covered by
the separately coordinated browser integration checks.

Phone counting was explicitly resumed after that upgrade: native source enabled,
foreground service present, **81 steps retained**, optional companion reminders
still off. No new pet was deliberately created on the Samsung, no app data was
cleared, and no user ownership secret was written into the report or screenshots.
The earlier embedded auto-pair behavior was an unintended product defect; the
unpaired native screen now keeps WebView unloaded until explicit pairing.

## Final deployment boundary and emulator recheck

After web source `f388eef` was deployed, the Samsung received **Feed now** and
**Reload World** through the installed native UI. USB disconnected before their
result could be inspected. Therefore the observed positive ownership proof above
belongs to the installed `4c86a68` APK against the web deployment immediately
before `f388eef`; this report does **not** claim a physical readback of the latest
web deployment. The user then confirmed the phone would be disconnected, and no
further device actions were taken. The latest web refusal/retry behavior has its
separate 40-browser-test evidence recorded by the integration reviewer.

The final `4c86a68` APK was also installed on Android 16 emulator `emulator-5556`.
Its native credentials were absent; World showed the explicit **Make my Truffle**
action, with no visible WebView and no web world canvas. No pairing action was
taken. This directly checks the final unpaired-screen guard against hidden web
auto-pairing.

The artifact is ready for a clearly labelled **debug test prerelease**, within
the device-test limits above. Public evidence consists of the three linked
credential-free screenshots; raw private preferences are not release artifacts.
