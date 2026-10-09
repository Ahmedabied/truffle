# Fleet 25 / 14: native Walk review

Date: 2026-10-09. Scope: Walk presentation and independent native source review.
The physical phone is disconnected and was not accessed. All runtime checks use
the workstation's disposable `emulator-5556`. No model call was made.

## Findings and bounded polish

The existing paper/forest palette and serif heading support the walking notebook
well. Genuine `#`, `.`, and `-` glyphs give the chart a clear ASCII identity.
The main problems were misleading period context and incomplete coverage.

- Today, 7 days and 30 days changed the chart while the main total stayed on
  today. The selector now comes before a matching period total, date span and
  coverage. Today is explicitly in progress.
- Native dates without a record were plotted and averaged as zero. `WalkDay`
  now preserves record presence. Missing native dates are blank and omitted
  from averages; an entirely unknown period has no numeric total or average.
  Recorded zero remains different from missing. Partial recorded days are
  disclosed. No feed, sensor or stored accounting format changed.
- Health Connect explicitly queries each date and its existing reader returns
  zero when no steps are reported. This is labelled as days read, with a note
  that zero is not proof of no walking. No claim of complete activity coverage
  is made.
- A horizontal number/label row could consume the whole width with long totals.
  The label now has its own line and the count fits within its available width.
- Chart ticks were 11sp within a fixed-height view. They are now 14sp, and
  glyph rows and labels contribute to measured height. At large font settings
  the chart scrolls horizontally while retaining real, legible glyphs.
  Three-letter weekday labels remove the Tuesday/Thursday ambiguity. The
  accessible description gives each date/hour and its recorded total.
- A native diary whose stored zone differs from the active zone is no longer
  presented under the new zone label. It waits for a record in that zone.
- Source changes clear the displayed diary and cancel any old Health Connect
  read. A request/source-session fence rejects old success, permission and error
  callbacks, including a switch away from Health Connect and back. A failed
  first read therefore cannot relabel the previous source's totals.

Changes are confined to `WalkScreen.kt`, `AsciiWalkChartView.kt`, `WalkChart.kt`
and the related JVM tests. The screen still reads phone records in the pinned
active zone and Health Connect in the device zone. Source selection, permission
gates, ownership and feed accounting are unchanged.

## Native runtime review for integration

`WorldScreen.onPageStarted` recognizes a requested document by exact equality
with `pendingDocumentUrl`. A root callback with a different URL representation
invalidates the document and calls `reloadFresh`, which allocates a fresh nonce
and repeats the same load path. This is a potential reload loop if WebView or a
redirect supplies a normalized or stripped fragment. The generated fragment is
currently ASCII-safe. No runtime callback mismatch has been established here.
The identity reviewer owns any core fix and new-web runtime verification.

The public web version before decision 0023 does not accept the new
`native_scope` fragment. An old-web import failure is not evidence of a bug in
the new web source. No WorldScreen or identity source was edited by this review.

## Validation

Baseline 0.4.0 (`4388216`) was opened on `emulator-5556`. The Walk screenshot
confirmed the existing today-only total, compact summary, and fixed chart
layout. Health Connect was already granted in this disposable emulator. The
unpaired World panel opened without creating a pet. ADB always included the
emulator serial; no personal phone was addressed.

New JVM cases cover missing-versus-zero records, unknown totals/averages,
period boundaries, exclusion of future dates, multi-million step display and
late read/error fencing through source switches.
Existing ASCII tests retain the seven-bit glyph contract. Local
`git diff --check -- feeder-android` passed. No Android build ran on the laptop.

Root committed and pushed the two Walk checkpoints `bbed4f0` and `9842507`.
The workstation pulled `9842507` with `git pull --ff-only`; its checkout was
clean. No source repository or app source was copied between machines.

```text
JAVA_HOME=/home/tamlik/jdks/jdk-17.0.20.1+1 ANDROID_HOME=/home/tamlik/Android/Sdk \
  ./gradlew assembleDebug testDebugUnitTest lintDebug --no-daemon \
  -Dorg.gradle.java.home=/home/tamlik/jdks/jdk-17.0.20.1+1
BUILD SUCCESSFUL in 33s
129 tests, 17 suites, 0 failures, 0 errors
Lint: 0 errors, 69 warnings
```

The 69 lint warnings consist of 40 text/localization warnings, 23 Kotlin
extension suggestions, 3 SAM notices, 2 dependency-version notices and 1
obsolete SDK guard. Five text/localization warnings were added by the clearer
diary copy. Gradle retains the existing SDK XML/tooling warning and the compiler
reports `scaledDensity` as deprecated.

The APK was installed as an upgrade on `emulator-5556`. A paused synthetic diary
was used only for display testing: today 1,234,567, yesterday 8,765,433, a recorded
zero six days ago, and no other native dates. These are fabricated test values,
not physical walking or credited food. No fixture feed or pet creation occurred.

- At 100% font scale, Today shows 1,234,567. Selecting 7 days shows 10,000,000,
  three of seven dates recorded, average 3,333,333, and the expected best day.
  The four missing dates are blank while the recorded zero has dots.
- At 200%, long totals and separate labels fit. The 30-day selection shows
  10,000,000 and three of thirty dates recorded. Vertical scrolling reaches
  details; horizontal scrolling reaches the end of the enlarged hourly chart,
  including the 23 tick. Glyphs and ticks stay legible without overlapping.
- The accessibility tree contains the chart's dated/hourly value descriptions.
  This is structural evidence, not a TalkBack listening test.
- World and Feed tab taps select their respective screens at 200%. The World
  remains unpaired; ownership import was not tested against the older public web.

Original emulator diary preferences and font scale 1.0 were restored after the
fixture. Local unstaged captures are under `fleet/outbox/V14/native/`; they must
be labelled synthetic if used publicly. The matching ignored APK is
`fleet/outbox/V14/native/truffle-0.4.0-walk-debug.apk`.

APK SHA-256:
`1d4c5a4cbd29eb5d6da021b9bf7c28f3939ac05963f47524dcf025c6cf09e055`.

Phone accuracy, endurance, notification delivery and physical accessibility
behavior remain unverified. The WebView callback representation question remains
with the identity review.
