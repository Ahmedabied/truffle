# Fleet 25 / 21: identity, native handoff and delayed responses

Reviewed 2026-10-09. This review used synthetic owners in isolated desktop
Chrome contexts, with every API request intercepted on loopback. No real pet
was paired, changed, forgotten or charged. No inference, external message or
personal-phone access occurred.

## Findings and fixes

1. **A late poll could restore food spent by a completed chat.** The browser
   regression held a state response containing 4,000 food, completed a synthetic
   chat and fresh read containing 3,900, then released the old response. The
   displayed balance returned to 4,000. Root fixed chat admission to advance
   `stateEpoch` and rebind the companion before interpreting the accepted
   message. Root also added a poll sequence guard. The retained regression now
   passes, as does an overlapping-polls case within the same life generation.

2. **Native refresh did not necessarily create a new document.**
   `WorldScreen.reloadFresh()` previously called `loadUrl` with the same root
   and a new credential/nonce fragment. After the first import removed its
   fragment, this could be a same-document navigation: import boot did not run
   again, and `pendingDocumentUrl` could remain uncleared. A canceled import
   could therefore stay canceled and a new native nonce could lack authority.

   With root's explicit coordination, `WorldScreen.kt` now replaces the WebView
   for fresh loads. Ordinary refresh retains profile storage and native owner
   preferences; it stops the old view before destroying it, cancels its dialog,
   restores visibility and lifecycle, and creates a fresh nonce. Explicit
   `clearData()` uses the same helper with storage clearing enabled, avoiding
   double replacement. A renderer-gone callback from an old view cannot replace
   its successor. There is no JavaScript credential bridge.

   The new desktop browser regression demonstrates the relevant distinction:
   a hash-only navigation neither rereads the owner nor strips the replacement
   fragment, and rejects the replacement nonce; a full document reload strips
   it, verifies the same selected pet, and accepts only that new nonce.

## Native callback evidence and limits

The workstation emulator reports WebView `133.0.6943.137`. This was a read-only
`adb -s emulator-5556 shell dumpsys webviewupdate` query; no emulator preference
or pet was changed by this review.

Android documents that fragment navigation does not call `onPageStarted`.
The matching Chromium version marks a `loadUrl` call as a reload only when
its complete URL equals the last committed URL, and its page-start callback
excludes same-document navigation. These support the refresh fix above.
[Android callback contract](https://developer.android.com/reference/android/webkit/WebViewClient#onPageStarted(android.webkit.WebView,%20java.lang.String,%20android.graphics.Bitmap)),
[Chromium 133 loadUrl](https://chromium.googlesource.com/chromium/src/+/133.0.6943.137/android_webview/java/src/org/chromium/android_webview/AwContents.java#2465),
[Chromium 133 navigation callbacks](https://chromium.googlesource.com/chromium/src/+/133.0.6943.137/android_webview/java/src/org/chromium/android_webview/AwWebContentsObserver.java#152).

The earlier proposed **initial callback URL-normalization loop** was not
reproduced. Generated origins are normalized and credential/UUID fragments are
ASCII-safe; the inspected Chromium callback forwards the complete URL spec.
This review leaves exact `pendingDocumentUrl` matching intact rather than
weakening the document fence without evidence. The native refresh fix still
requires the root-managed commit → push → workstation pull/build and emulator
check. No Android build ran on the laptop, and no source copy was transferred.

## Verified boundaries

- Fragment secrets are stripped before the verification response. While it is
  pending, the chosen saved pet is untouched and native events have no authority.
- Verified real imports may replace the saved owner only through the existing
  confirmation. 401, 503, demo responses and duplicate nonce parameters keep the
  previous owner and do not pair a substitute, including after reload.
- Current native movement affects the visible expression, never food or state.
  Wrong nonces, a normal browser user agent, missing server generations, a new
  life generation and a reload without a new import all reject native authority.
- Older life summaries cannot overwrite a newer generation. Late pre-chat and
  older overlapping poll responses cannot overwrite newer same-life state.
- Source inspection confirms API-origin credential storage separation, native
  owner/origin/source/permission gates, credential-free native event fields,
  and a source-session fence on delayed movement work. Existing controller
  tests exercise pet/origin/generation changes and late companion receipts.
- Synthetic API request URLs and referrers contain no imported secret/fragment.
  Owner authentication remains in the expected request header; no secret was
  printed by this review's checks.

## Validation

`node web/test/identity.browser.mjs`: **12 / 12 passed**, against the integrated
local Vite source and root's poll fix. Includes one behavioral demonstration of
same-document navigation; this is desktop Chromium evidence, not Android UI
instrumentation.

`npm test --prefix web -- --run test/handoff.test.ts test/credentials.test.ts
test/companion-controller.test.ts test/companion-adversary.test.ts`:
**157 / 157 passed** across four suites.

Targeted `git diff --check` passed. Agent 20 separately owns the general browser
smoke and companion v2 suites. The last native build before this review was
root's `9842507` / 129 JVM tests; this report does not count those as verification
of the new WebView lifecycle edit.

Files owned by this review: `web/test/identity.browser.mjs`,
`feeder-android/app/src/main/java/dev/truffle/feeder/WorldScreen.kt`, and this
report. `web/src/main.ts` race corrections were made by root; the older-API
companion capability gate was made by agent 20.
