# B07 feeder_sdk36_and_feed_contract
Owner: opus        Wave: Thu Oct 8 afternoon        Due: Thu 2026-10-08 18:00 Oman

## Goal
Finish the Kotlin feeder: move to compileSdk 36 with Health Connect 1.1.0 stable, send the day envelope the Worker now expects, and handle the Worker's new calm rejections. Rebuild the debug APK on the box and refresh the draft GitHub release.

## Inputs
Read first: CLAUDE.md, feeder-android/README.md, fleet/packets/B04_feeder_android.md, findings/02_box_android_toolchain.md, fleet/outbox/B06/RESULT.md (items 1, 2, 5), worker/src/do.ts (the feed method and its envelope), worker/src/validate.ts, worker/src/types.ts (FeedInput, FeedSummary). Repo: ~/Desktop/Truffle. All Android builds run on the box: `ssh workstation`, project at `~/truffle-build/feeder-android`, JDK 17 at `/home/tamlik/jdks/jdk-17.0.20.1+1`, SDK at ~/Android/Sdk. Sync the source there with rsync before building. Never build on the laptop.

## Deliverable
1. compileSdk 36, targetSdk 36, `androidx.health.connect:connect-client:1.1.0` stable. Fix whatever the bump breaks. Keep the permission set exactly as it is: INTERNET, READ_STEPS, READ_HEALTH_DATA_IN_BACKGROUND. No location permission.
2. The feed body carries `day` (YYYY-MM-DD in the active zone the Worker returned at pairing or in the last feed response) and `day_tz`, plus `device_tz`. Aggregate Health Connect steps over the active zone's local midnight to now, not the device zone, when they differ. Match the field names in worker/src/types.ts exactly.
3. Rejections: a 400 with `retry_after_s` schedules one retry after that many seconds and shows a calm status line ("Synced too fast, trying again in N s"). A 400 without it shows the Worker's `error` text as the status. A 401 shows "Phrase not recognised. Copy it again from the web app." No raw bodies on screen. A rejection never clears the stored phrase.
4. Unit tests for the day envelope and the rejection handling. Existing 10 tests still pass.
5. Build the debug APK on the box, run the unit tests there, install and exercise on the Android 16 emulator (pair with a fresh phrase from https://truffle.ahmed-abied.workers.dev/pair, feed, see the 200). Upload the new APK to the draft release `v0.1.0-feeder` with `gh release upload --clobber`. Do not publish the release.

## Acceptance
Gradle build and unit tests green on the box, output pasted. Emulator feed returns 200 with the envelope echoed. APK size and sha256 in the report. README updated for SDK 36 and the day envelope.

## Do not
Do not touch worker/, web/, finetune/. Do not add location. Do not commit; the integrator commits. No co-author trailers. No secrets or phrases in the report.

## Report
fleet/outbox/B07/RESULT.md: what was done per item, evidence (commands + output), open questions, cost (0).
