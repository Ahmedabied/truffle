# 0016 The feeder becomes the Truffle phone app

Date: 2026-10-08, 23:30 Oman. Status: accepted (Ahmed, after the r16 eval).

## Decision

The Android feeder grows into the full Truffle app. Same application id `dev.truffle.feeder` so the installed build upgrades in place. App label "Truffle". Three screens behind a bottom bar, plain Android Views:

1. **World.** A WebView that loads the deployed web app (`https://truffle-web.ahmed-abied.workers.dev`). The app owns the pet's credentials and hands them to the page once through the URL fragment `#creds=<phrase>.<secret>`. The page stores them and strips the fragment. No token in any query string, no cookie, no JavaScript bridge.
2. **Walk.** Health Connect analytics rendered as monospace text in the Truffle palette: today's steps by hour, the last 30 days by day, 7 day average, best day, streak of days at or above 3,000 steps, distance today when the distance permission is granted. Steps and distance only. No calories, no weight, no heart rate, no body talk. This is a safety rail, not a style choice.
3. **Feed.** The existing feeder: status, last sync, feed now, permissions, hourly sync.

Pairing: the app calls `POST /pair` itself the first time and keeps `phrase` and `secret` in app-private storage. A pet made on the web can be moved into the app by the web's "Open in the Truffle app" button, which launches `truffle://pair?creds=<phrase>.<secret>`. The custom scheme never reaches a server.

## Why

Judges and users should install one thing and see the world, their walking and the feeder together. The web app stays the product for everyone without Android and for judge mode. Nothing in the engine or the brain changes.

## Consequences

- `feeder-android/` is renamed in docs to "the Truffle app"; the directory name stays.
- versionName 0.2.0, versionCode 2. A new draft GitHub release `v0.2.0-app`.
- The web app reads `#creds=` on load (B13).
