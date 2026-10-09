# Submission checklist

The [post draft](post_draft.md) remains unpublished. The [official challenge](https://dev.to/challenges/hacktoberfest-week1-2026-10-05), checked October 9, closes Monday, October 12 at **10:59 AM Oman**. Preparing these files does not authorize publication or external messages.

## Current source and automated evidence

- [x] [Decision 0023](../decisions/0023_continuous_food_and_living_companion.md) implemented: continuous food at 1,000 per elapsed day, bounded carryover, absolute effort thresholds, 96 non-sheltered empty hours, migration and protected reply reservations. [V2 goldens](../tests/golden/energy_v2_cases.json); original v1 goldens retained.
- [x] Independent accounting regressions for cancellation, delayed admission and weather rollback fixed. Busy-day/rest-day scenarios conserve accepted food at both Sprout and Elder. [Economy review](reviews/fleet25-16-economy.md).
- [x] Integration checkpoint reported 605 Worker tests passing. The final release checkpoint and any later full-suite counts belong in the delivery section below; individual earlier reports retain their own counts.
- [x] Fresh procedural ASCII gifts created by owner-authenticated server alarm jobs, with no model call or food charge. Owner/day/life fences and delayed-return/receipt races tested. [Gift review](reviews/fleet25-17-gifts.md). One per pinned local day, twelve retained; older local gifts remain archived.
- [x] English/Arabic outing, return, rest and quiet-intent cases, fresh movement expressions and false-positive rejection. Web full-suite checkpoint: 427 tests before the later art/identity integration. [Companion review](reviews/fleet25-18-companion.md).
- [x] Distinct anticipation, protected health expressions, grounded feet and frozen reduced motion: 28 targeted scene tests. The earlier 529 × 600 CSS-pixel storm sample measured 59.98 fps. The final 740 × 838.66 full-width sample measured 58.91 fps over about ten seconds at 4× CPU slowdown, with nine frame gaps above 25 ms. [Art and motion evidence](reviews/fleet25-19-art-motion.md); [final raw measurement](reviews/fleet25-19-art-motion/full-width/measurements.json).
- [x] 49 local browser cases, consisting of 41 smoke and 8 v2 integration cases. [Browser report](reviews/fleet25-20-browser.md).
- [x] 12 separate browser identity cases, including delayed state, native import authority and new-document scope. These are desktop fixtures, not physical WebView instrumentation. [Identity review](reviews/fleet25-21-identity.md).
- [x] 11 browser accessibility checks: keyboard/focus, English/Arabic reflow, sample provenance and reduced motion. Text scale tested through 200%; normal UI control caps at 150%. No physical screen-reader or full WCAG claim. [Accessibility review](reviews/fleet25-15-accessibility.md).
- [x] Sample demo shares the v2 engine and labels both authored replies and simulated food charges. Four/eight-second trained-provider routing deadlines tested; total live latency is unmeasured. [Demo and routing review](reviews/fleet25-13-demo-chat.md).

These are local implementation and automated-test results. They do not establish that the same code is deployed, that a real public alarm has fired, or that the final APK works on a physical phone.

## Android 0.4 evidence

- [x] Native positive-step event has no credentials or food authority, requires a verified fresh document and is discarded across stale owner/source/document boundaries. Positive movement feed work is coalesced and throttled. [Native implementation](reviews/fleet25-09-native.md).
- [x] Workstation built final 0.4.0/code 4 from GitHub checkpoint `0a3c56c`, including the native refresh fix: **129 JVM tests**, lint **0 errors / 69 warnings**. No Android build ran on the laptop and no source repo was copied between machines.
- [x] Disposable Android 16 emulator checked period totals, missing-versus-zero native days, large values, 100%/200% text and scrolling. Synthetic diary values were display fixtures, never walking evidence or credited food. [Walk review](reviews/fleet25-14-native-review.md).
- [x] Fresh-document WebView fix included in the final build. It replaces the view during reload while retaining normal profile storage; the old hash-only navigation could leave the new nonce unverified. [Identity review](reviews/fleet25-21-identity.md).
- [x] Final native source committed, pushed, pulled and rebuilt on the workstation. Three emulator reloads created distinct stable WebViews and retained synthetic owner/settings fields. This does not demonstrate live Truffle owner verification or web local-storage preservation. [Release artifact review](reviews/fleet25-24-release.md). APK: 12,588,066 bytes; SHA-256 `1ddc5b0d50240a610078c36693580f4fa5074500a0aab1d7afd429f97ae47962`.
- [ ] Public **0.4 debug prerelease** source revision, checksum and anonymous download verified. Do not relabel it as production-signed or physically tested.

## Historical physical phone evidence, version 0.3

- [x] Samsung SM-A366B, SDK 36. User-selected Chrome pet preserved through upgrade.
- [x] Hardware counter recorded **81**. October 9 Asia/Muscat feed accepted **81 steps / 81 energy**, and a repeated feed added nothing. This predates v2 storage capacities. Optional companion notes remained off.
- [x] Corrected installed `4c86a68`, version 0.3.0/code 3, showed the same selected pet in embedded World. Its workstation build had 101 tests and lint 0 errors / 62 warnings.
- [x] Short Samsung Chrome sample at `5cf5465` read **60 fps**, compose 0.9 ms / paint 1.0 ms. This is historical evidence, not sustained WebView performance or proof of later native changes.
- [x] Credential-free [World](assets/android-native-world-81.png), [Walk](assets/android-walk-native-81.png) and [Chrome fps](assets/android-world-samsung-60fps.png) captures reviewed.

[Android QA](reviews/android-qa.md) preserves APK checksums and historical checkpoints. The phone disconnected before readback of the last old-release reload. It has not been used to test 0.4. The user did not manually count the walk: no accuracy percentage, outdoor location or habit change is established. The earlier Health Connect/Samsung Health zero match is a separate source check.

## Model, cost and article evidence

- [x] Trained r16 adapter, 170 matched prompts, saved base/tuned outputs and regressions. The judge was the same base model; this is not independent validation. [Results](../finetune/eval/RESULTS.md).
- [x] Opening S12-076 quotes match saved replies. The 46°C Phoenix case is fictional and used the earlier state format. It is not a Muscat walk diary or a test of the new v2 prompt.
- [x] Voice and outdoor-nudge regressions remain beside the improvements. The failed phrase-based heat metric and production/harness differences remain disclosed.
- [x] Exact model publisher cards and [NOTICE-GEMMA.md](../NOTICE-GEMMA.md) retained: the named Google, Unsloth and Red Hat Gemma 4 checkpoints publish Apache 2.0; model/adapter artifacts are separate from MIT application code.
- [x] Seven required DEV sections, `devchallenge, hf26challenge`, **Best Use of Gemma** and `published: false` retained.
- [x] **$50 project cap** and unreconciled [provider ledger](../fleet/costs.md) disclosed. $1.81 is the estimated r16 training credit, not total cost. No new paid inference was used in this v2 validation session. Model-made gifts remain disabled pending cost reconciliation and a global spending gate.
- [x] Earlier selected release evidence reviewed for private data. One historical settings image with unconfirmed phrase provenance was withheld; no history purge is claimed. [Evidence review](reviews/release-evidence-review.md).

## Delivery checkpoints

Historical public release only:

- [x] Web `f388eef` deployed as `7d31e6ff-aff6-4584-b604-d4410332778b`; Worker `1f86536` as `2872c460-58fd-4277-b11c-3dcaaf289853`.
- [x] The [old public walkthrough](reviews/public-walkthrough/README.md) passed. Its live high/low fallback replies charged 200/20 once and took about 53/27 seconds to visible text. They were not trained-adapter replies and do not measure the new router.
- [x] Public v0.3.0-app downloaded anonymously; all 12,498,062 bytes matched the installed artifact checksum. [Download record](reviews/public-walkthrough/release-download.json).

Decision 0023 delivery, to be filled only from final release evidence:

- [ ] Final source revision and full validation checkpoint recorded.
- [ ] Migration cutover prepared for `2026-10-09T08:43:00Z`; confirm API deployment precedes it and the legacy cursor guard remains checked.
- [ ] API deployed revision/version recorded, with no paid model call needed for acceptance.
- [ ] Web deployed revision/version recorded; anonymous sample demo, labels and links checked.
- [ ] Final 0.4 APK public download and checksum recorded.
- [ ] New public assets and report URLs checked after push. Older captures labelled as historical or simulated rather than presented as new phone evidence.

## Remaining evidence and publication

- [ ] Physical 0.4 import/reload and native reactions; independently counted accuracy; positive Health Connect comparison; overnight/reboot/stop endurance; battery; notification delivery; TalkBack.
- [ ] Independent model judging and blind human Arabic preference review.
- [ ] Faster live trained/fallback replies after routing changes. Provider totals must be reconciled against the $50 cap before further paid checks.
- [ ] Cross-tab visible-presence coordination. A hidden tab can currently schedule an away gift while another remains visible. Closing before an away signal arrives can lose the job; absence delivery is best effort.
- [ ] Any outdoor story uses Ahmed's actual observations and times, without an invented route, scenery or diary.
- [ ] Ahmed reviews the unpublished draft; preview DEV rendering and links before a separately authorized publication action.
- [ ] Sanitize any optional session excerpt before sharing; confirm previously exposed token rotation independently.

The public article should stay readable: link this checklist for exact checkpoints, and keep its main claims within the evidence above.
