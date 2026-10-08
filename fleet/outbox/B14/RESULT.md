# B14 RESULT: the Truffle phone app

Owner: opus builder. Date: 2026-10-08, Oman night. Status: built and unit tested on the box. Not yet checked on a phone.

## What was done

All changes are inside `feeder-android/`. Nothing in `worker/` or `web/` was touched. No commits.

- **App shell.** `MainActivity` is now one Activity with three plain views behind a bottom bar: World, Walk, Feed. Label "Truffle". applicationId `dev.truffle.feeder`. versionName 0.2.0, versionCode 2. No Compose, no new dependencies. The WebView is the platform one.
- **Pairing.** `AppLink.kt` holds the pure parts: `TruffleCreds` (same formats as the Worker: three lowercase words, base64url secret of 16 to 64 characters), deep link parsing, origin parsing, the World URL and the `POST /pair` reply parser. `PairClient.kt` posts `{"tz": <device zone>}` to `<api origin>/pair` with redirects off and 15 s timeouts. The phrase and secret go to the existing private `feeder` SharedPreferences. Backup and device transfer were already excluded for `sharedpref` in `data_extraction_rules.xml`, and `allowBackup` is false. The Feed phrase is filled from the credentials and becomes read-only.
- **Deep link.** Intent filter `truffle://pair` (VIEW, DEFAULT, BROWSABLE). `launchMode` singleTask, handled in `onCreate` and `onNewIntent`. Only one query parameter, `creds`, is accepted. Any path, fragment, port or extra parameter is refused. If the phone already holds a different pet, a dialog asks before replacing it. The intent is cleared after use, and a launch from recents is ignored, so the secret-bearing link cannot replay.
- **Forget this truffle** under Feed, with a confirm dialog. It clears phrase, secret and active zone, stops the hourly job, and wipes WebView storage, cookies, cache and history. The server and web origins stay.
- **World.** WebView with JavaScript on, DOM storage on, file and content access off, mixed content never allowed, geolocation off, no pop-up windows, no JavaScript interface. User agent is the default plus ` TruffleApp/0.2`. It loads `<web origin>/#creds=<phrase>.<secret>` once per fresh WebView load, otherwise `<web origin>/`. **refresh** reloads the current page, which B13 has already stripped of the fragment. Back walks the page history first. Only HTTPS on exactly the web origin loads inside. A tapped http or https link elsewhere opens the browser. Every other scheme is dropped. A crashed renderer gets a new WebView. `WebView.setWebContentsDebuggingEnabled(false)` is set because a debug build would otherwise expose the page and its stored secret to USB inspection.
- **Settings.** API origin (default `https://truffle.ahmed-abied.workers.dev`) and web origin (default `https://truffle-web.ahmed-abied.workers.dev`) sit next to each other under Feed. An invalid web origin falls back to the default. The 0.1 placeholder server counts as unset, so an upgraded phone points at the deployed Worker.
- **Walk.** `HealthSteps.readWalk` uses the existing client: `aggregateGroupByDuration` with 1 hour buckets from local midnight, `aggregateGroupByPeriod` with 1 day buckets over 30 days in the device zone, and `DistanceRecord.DISTANCE_TOTAL` for today only when the distance grant exists. A revoked distance grant degrades silently. `WalkChart.kt` is a pure object: bar charts with eighth blocks, thousands separators, 7 day average over the 7 completed days before today, best day in 30 (latest on a tie, "none yet" when empty), streak of days at or above 3,000 ending today or yesterday. Rendered in a monospace TextView with the Truffle palette by night mode (#f5f2e9 / #141b18 background, #293e35 / #e4e9dc ink, #345437 / #7fae7a accent on the chart rows). If it cannot read, it shows the same red permission button as Feed. Steps and distance only. A test asserts no body metric word appears.
- **Permissions.** `READ_DISTANCE` added to the manifest and requested in the same dialog as steps and background read. The packaged APK has exactly four permissions (see below).
- **Feed.** `FeedScreen.kt` is the old MainActivity body moved into a view class. `FeedSender`, `FeedWorker`, `FeedProtocol` behaviour and the feed envelope are unchanged. Two cosmetic changes: status strings say "Truffle" instead of "Truffle Feeder", and the constant `DEFAULT_SERVER` was renamed `PLACEHOLDER_SERVER` because it is no longer the default (one test line follows the rename, same assertion).
- **Privacy screen** text updated for Walk, World and the fragment hand-off.
- **README** retitled "The Truffle app": three screens, the deep link, WebView settings, the new permission, the B14 outbox path in the build recipe. Samsung steps stay, with step 5 rewritten for "make my truffle".

## Build on the box

Recipe from `feeder-android/README.md`: rsync to `workstation:~/truffle-build/feeder-android/`, then `./gradlew assembleDebug testDebugUnitTest lintDebug --no-daemon` with JDK 17 as the Gradle Java home. Tail:

```
> Task :app:testDebugUnitTest
> Task :app:lintAnalyzeDebugAndroidTest
> Task :app:lintAnalyzeDebugUnitTest
> Task :app:lintAnalyzeDebug

> Task :app:lintReportDebug
Wrote HTML report to file:///home/tamlik/truffle-build/feeder-android/app/build/reports/lint-results-debug.html

> Task :app:lintDebug

BUILD SUCCESSFUL in 27s
49 actionable tasks: 29 executed, 20 up-to-date
```

No Kotlin compiler warnings in the log. The only warning line is the known Java 25 launcher native-access notice.

## Tests

54 JVM unit tests, 0 failures, 0 errors, 0 skipped. 27 existing plus 27 new.

```
<testsuite name="dev.truffle.feeder.AppLinkTest" tests="8" skipped="0" failures="0" errors="0"
<testsuite name="dev.truffle.feeder.AppSettingsTest" tests="5" skipped="0" failures="0" errors="0"
<testsuite name="dev.truffle.feeder.FeedEnvelopeTest" tests="6" skipped="0" failures="0" errors="0"
<testsuite name="dev.truffle.feeder.FeedProtocolTest" tests="10" skipped="0" failures="0" errors="0"
<testsuite name="dev.truffle.feeder.FeedRejectionTest" tests="11" skipped="0" failures="0" errors="0"
<testsuite name="dev.truffle.feeder.WalkChartTest" tests="14" skipped="0" failures="0" errors="0"
```

- `WalkChartTest` (14): fixed numbers in, exact lines out. Eighth blocks, stacked bars, blank future hours, dotted zero floor, separators, axes, filling missing days, 7 day average (22,879 over 7 is 3,268), best day, streak today or yesterday, a broken streak is zero, a full report with the hourly chart rows and five stat lines, no distance line without the grant, no body metric words.
- `AppLinkTest` (8): valid deep links, 14 refused deep links, Worker formats, the secret never in `toString`, World URL has the secret only after `#` and no `?`, origin containment (lookalike host, user info trick, http, javascript, file and truffle schemes), origin parsing, pair reply parsing.
- `AppSettingsTest` (5): deployed defaults, the old placeholder counts as unset, invalid web origin falls back, pairing fills the feeder phrase and resets the zone, forget clears it, a typed phrase alone is not ownership.

## Lint

0 errors, 40 warnings. 29 SetTextI18n (English-only strings, as before), 8 UseKtx suggestions (`toUri`, `toColorInt`), 2 newer library versions, 1 missing launcher icon. `SetJavaScriptEnabled` is suppressed on the one WebView factory on purpose.

## APK

- Path: `fleet/outbox/B14/raw/app-debug.apk` (gitignored by `fleet/outbox/**/raw/`), 12,089,467 bytes.
- sha256: `be875935238b17f26d6be6ad1cbf1b7138f1ac8fea3eaee9ed64cc087b5ae7ac` (same on the box and after copy).
- `aapt2 dump badging`: `package: name='dev.truffle.feeder' versionCode='2' versionName='0.2.0' compileSdkVersion='36'`, `targetSdkVersion:'36'`, `application-label:'Truffle'`.
- Permissions: `INTERNET`, `health.READ_STEPS`, `health.READ_DISTANCE`, `health.READ_HEALTH_DATA_IN_BACKGROUND`. Nothing else.
- Manifest: `launchMode=2` (singleTask), intent data `scheme="truffle"`, `host="pair"`.

## Secrets

- No logging calls anywhere in `app/src/main` (grep for `Log.`, `println`, `printStackTrace` is empty).
- `TruffleCreds.toString` hides the secret.
- The app itself never sends the secret over HTTP. It only hands it to the page through `#creds=`. The page then uses its own `x-truffle-secret` header. The secret is never in an HTTP query. The `truffle://pair?creds=` query is a custom scheme from decision 0016 that goes from the browser to this app and never reaches a server.
- No secret in this file or in the build log.

## Not verified

- Nothing ran on a phone or emulator in this packet. Fable installs on the phone. Checks to do there: make my truffle, the World loading with the pet, the deep link from B13's button (fresh and replacing), forget, back navigation, an external link opening the browser, Walk with and without the distance grant, dark mode colours, and that Feed still feeds.

## Open questions

1. **B13 dependency.** Until B13 is deployed, the page ignores `#creds=` and shows its own pairing UI inside the World. The app side is ready either way.
2. **Deep link on a fresh install** adopts the pet without a dialog, because there is nothing to replace. A malicious page could plant its own pet on a phone that has none. The worst case is that the person walks for a stranger's pet until they notice. Add a dialog there too if U07 rates it.
3. **Upgrading from 0.1.** A typed phrase without a secret is not ownership. World shows "make my truffle" and asks first, since a new pet takes the Feed phrase's place. The intended path for Ahmed's existing pet is the web's "Open in the Truffle app" link.
4. **Streak on Walk versus the engine.** Walk counts today once it reaches 3,000. The engine's streak moment counts completed days at midnight. They can differ by one during the day. Fine for display, but the copy could say so.
5. **Custom web origin** gets the secret through the fragment like the default one. It must be HTTPS. That is the person's own choice in settings.
6. **No launcher icon** yet. Still the default Android icon.
