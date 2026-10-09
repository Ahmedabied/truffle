# Fleet 25 / 24: Android release artifact and evidence boundaries

Reviewed October 9, 2026. This review builds and checks Android source
`0a3c56c6d1c7ddfbfc0873560142e66ab2bf75bb`, including the fresh-document
World refresh fix. It does not publish a release, deploy the web or API, make
an inference call, or use the unavailable personal phone.

## Build and artifact

GitHub `main` was verified at that exact commit before the workstation's clean
checkout pulled with `git pull --ff-only`. All Android work ran in
`workstation:/home/tamlik/truffle-source/review-20261008`. The checkout was
still clean after building. No app source or repository was copied between
machines; only the finished APK and sanitized evidence came back.

```text
JAVA_HOME=/home/tamlik/jdks/jdk-17.0.20.1+1 ANDROID_HOME=/home/tamlik/Android/Sdk \
  ./gradlew assembleDebug testDebugUnitTest lintDebug --no-daemon \
  -Dorg.gradle.java.home=/home/tamlik/jdks/jdk-17.0.20.1+1
BUILD SUCCESSFUL in 22s
49 actionable tasks: 16 executed, 33 up-to-date
129 tests, 17 suites, 0 failures, 0 errors, 0 skipped
Lint: 0 errors, 69 warnings
```

The existing SDK XML/tooling compatibility warning remains. The lint count
matches the prior Walk checkpoint. There is no claim of zero warnings.

- APK: `truffle-0.4.0-debug.apk`, **12,588,066 bytes**.
- SHA-256: `1ddc5b0d50240a610078c36693580f4fa5074500a0aab1d7afd429f97ae47962`.
- Local handoff: `fleet/outbox/V24/raw/truffle-0.4.0-debug.apk`. The artifact
  and raw directory are ignored by Git.
- Application ID: `dev.truffle.feeder`; version **0.4.0 / code 4**;
  minimum SDK **28**, target/compile SDK **36**.
- `apksigner verify --verbose --print-certs` passes using APK Signature
  Scheme v2. One RSA 2048-bit signer, `CN=Android Debug, O=Android, C=US`.
  Certificate SHA-256:
  `510e831e01faa25d8b81deecc68313799f40ea06d1a3a53307deff2f0ff6c644`.
- The APK is debuggable and debug-signed. It is a sideload **test prerelease**,
  not a production-signed store release. The signing key is not an artifact.
  This is observed provenance from a clean checkout, not a reproducible-build
  attestation or proof of an independently hardened release pipeline.

The workstation APK, copied handoff APK and installed emulator APK all have
the same SHA-256. Inspection of 129 archive entries found no environment,
private-key/keystore, fleet evidence or evaluation-output paths. This filename
check is bounded and does not certify the absence of every possible secret.

## Emulator upgrade and repeated Refresh

Only Android 16 `emulator-5556` was addressed. Its WebView is
`com.google.android.webview` **133.0.6943.137**. A second emulator was visible
in the device list and was not used.

The original emulator was unpaired and phone counting was already off. The
app was stopped before `adb -s emulator-5556 install -r`. Upgrade succeeded;
the original `feeder.xml` and `native_walk.xml` matched byte-for-byte before
and after the upgrade. The private profile and original font scale were
backed up on the workstation before any fixture change.

A syntactically valid, fabricated owner was then stored locally, with a
harmless HTTPS document at `https://example.com` as both configured origins.
Phone counting was explicitly paused and reminders were off. No Truffle pet
was created or authenticated. No Feed or chat action was invoked.

Three UI taps on **Feed > Connection & privacy settings > Reload World**
produced these native WebView instance identities in the Activity dump:

| Observation | WebView instance |
| --- | --- |
| Before refresh | `d5fd05b` |
| Refresh 1 | `301b1e1` |
| Refresh 2 | `db23342` |
| Refresh 3 | `e1cb5ec` |

All four belonged to the same Activity instance and process. Each refreshed
view remained stable in a subsequent sample; no continuous replacement loop
was observed. The World tab became selected and the HTTPS page rendered after
the final refresh. All owner, secret, server, web-origin, active-zone and
status fields remained equal to the synthetic fixture at each step. Tracking
remained paused and reminders remained off.

This directly checks fresh **native WebView creation**, paired-setting
preservation and the load path. It does not prove successful Truffle owner
verification, JavaScript nonce acceptance, callback order, or web local-storage
preservation. Those browser behaviors have separate synthetic coverage in the
[12 identity scenarios](fleet25-21-identity.md). The public web was still the
older version during this native check; its missing new nonce support was not
treated as an Android failure.

After the fixture, the original private preferences and WebView profile were
restored. Both original preference files again matched byte-for-byte. Font
scale remained **1.0**. Fixture data and the private temporary backup were
removed after verification, and the app was left stopped with counting off.
Private preferences never left the workstation. Sanitized instance observations
and two fixture screenshots remain in ignored `fleet/outbox/V24/raw/`.

## Publication and claim boundaries

Anonymous GitHub release metadata still identifies `v0.3.0-app` as a public
prerelease with `truffle-0.3.0-debug.apk`, 12,498,062 bytes and digest
`aa312a365866ae2c5895e3ecf60d9718a1968ca308c6f99e0f84fc5310cc0eab`.
This review did not create or verify an anonymous download for a new 0.4
release. The integrator owns tagging, release creation, deployment and final
anonymous download/checksum verification.

The packaged manifest requests eight permissions: Internet, Health Connect
steps, distance and background reads, activity recognition, foreground service,
health foreground service, and notifications. It requests no location
permission. The older Android README's four-permission summary and 0.3 user
agent description were flagged to the documentation owner for reconciliation.

Keep the new artifact and emulator evidence distinct from the historical
0.3 Samsung observation. The earlier 81-step sensor-to-server path does not
verify this 0.4 APK, its movement reactions, physical step accuracy, battery
life, overnight endurance, notification delivery or physical accessibility.
The synthetic Walk totals and this synthetic owner fixture are not physical
walking or a successful production pairing. Current isolated web tests do not
measure faster live inference or demonstrate the trained adapter in service.
No raw private profile or unreviewed fleet directory is cleared for publication.
