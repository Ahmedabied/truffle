# STATE

Updated October 9, 2026. Decision 0023 is implemented and deployed. This
supersedes the earlier exploration-only status. All 25 Astra Ultra assignments
are complete; the [roster](docs/reviews/fleet25-roster.md) records actual work.

## Delivered application

- Web: https://truffle-web.ahmed-abied.workers.dev . Offline sample:
  `/demo?mock=1`. Source `d8a51ed`, deployment
  `3b5bbf7c-8100-46af-8219-38a5dadd109c`.
- API: https://truffle.ahmed-abied.workers.dev . Same source checkpoint,
  deployment `c5ea5b7c-336b-4fff-a557-3ad4a9086334`.
  Both deployments preceded the food cutover at `2026-10-09T08:43:00Z`.
  The legacy-cursor guard remains intact. A live synthetic pet preserved its
  owner generation, 4,000-step history and pending gift through migration.
  Food measured 3,999 at 08:44:08 UTC, matching elapsed consumption since cutover.
- Food carries through midnight. Upkeep is 1,000 points per actual 24 hours,
  independent of stage. Capacities are 12,000/24,000/32,000/42,000; absolute
  effort thresholds are 20/1,500/3,600. Replies cost 20/60/200 and charge once
  at visible output. Ordinary chat uses medium or lower; deep effort is explicit.
  Heat pauses upkeep and the 96-hour continuous empty-food survival clock.
- Server alarms create fresh procedural ASCII gifts after ten minutes away,
  with authored bilingual notes, one per pinned day and twelve retained.
  These use no model and charge no food. Early return cancels unstarted work;
  owner, life, job and request fences protect delayed callbacks. Legacy local
  gifts remain an archive; sample previews are explicitly unearned.
- The width-fitted ASCII world has a full sleeping mushroom, distinct
  anticipation and movement reactions, intelligence freckles and planted feet.
  Chat follows the world, shows the latest user/reply exchange, and leaves
  detailed tools in Pocket. The sample has a direct first-walk action.
- English/Arabic outing and rest intent is conservative. Native foreground
  movement changes expression only after verified owner/document handoff.
  Optional reminders start off and suppress unsuitable weather or recent
  movement. Dated, zone-matched feeds and retained weather shelter remain.

## Verification and Android release

- Final source: 607 Worker tests, 436 web tests, both typechecks, web build and
  75 browser cases passed. [Independent audit](docs/reviews/fleet25-25-final.md).
- The deployed mobile sample passed expected-asset, full-width, complete
  mushroom, first-walk and no-error checks in isolated Chrome, without inference.
  [Public evidence](docs/reviews/fleet25-public-web.md).
- Final full-width desktop storm: 58.91 fps over about ten seconds, 740 by
  838.656 CSS pixels, DPR 2, 4x CPU slowdown. Nine frame intervals exceeded
  25 ms. This is near the target, not a sustained-phone or guaranteed-60 result.
- Android [0.4.0 test prerelease](https://github.com/Ahmedabied/truffle/releases/tag/v0.4.0-app)
  is public. Build source `0a3c56c`; app/build source unchanged at `d8a51ed`.
  Release target `630a42e`. Workstation build: 129 JVM tests, lint 0 errors /
  69 warnings. Three synthetic emulator reloads created fresh WebViews and
  retained native settings; they did not authenticate a live Truffle owner.
- APK: 12,588,066 bytes, debug-signed, version 0.4.0/code 4. Anonymous download
  and published checksum matched SHA-256
  `1ddc5b0d50240a610078c36693580f4fa5074500a0aab1d7afd429f97ae47962`.
  [Download record](docs/reviews/fleet25-live-release/apk-download.json).
- Live alarm acceptance passed: a Paper bouquet existed at its scheduled
  08:45:18.151 UTC creation time before any return action. Return preserved it;
  repeat away and duplicate feed minted neither gifts nor food.
  The real gift also opened from the deployed world and Pocket keyboard list.
  [Release evidence](docs/reviews/fleet25-live-release/README.md).

## Remaining limits

- Phone disconnected by the user's choice. Do not request it again for this
  completed software task. Version 0.4 still lacks physical import/reload,
  reaction, notification, TalkBack, battery and overnight/reboot evidence.
  Historical 0.3 recorded 81 hardware steps and an accepted, replay-safe feed.
  There was no manually counted reference. [Historical QA](docs/reviews/android-qa.md).
- Browser absence is best effort. A hidden peer can schedule while another tab
  remains visible; a closed page may fail to send its away event. Daily fences
  prevent extra gifts but do not provide cross-tab presence coordination.
- Provider totals remain unreconciled against the $50 cap. No paid inference,
  training or model download ran in this session. Trained-provider deadlines
  are four/eight seconds before fallback, not a total latency guarantee.
  Faster live replies and model-made gifts remain unverified/disabled.
- The r16 evaluation is a 170-prompt same-base comparison, not independent
  model judging. Blind human Arabic review and habit change remain unproved.
- DEV [draft](docs/post_draft.md) remains `published: false`. No article
  publication or external messaging occurred. [Checklist](docs/submission_checklist.md).

## Operating constraints

Android builds run only on the workstation clone
`/home/tamlik/truffle-source/review-20261008`, with GitHub as the source link.
Only finished APKs and sanitized evidence move between machines. The Tamlik
website's deploy guard concerns the unrelated website. Preserve the selected
pet and never clear private data to simplify an upgrade.

MemPalace query and final fact promotion returned `Transport closed`; repository reports and fresh
observations provide this session's evidence. Do not bypass a peer lock or
claim an unavailable KG result. Private `fleet/outbox/U01` through `U08` and raw
QA credentials remain excluded from Git. The session record is
[session 06](sessions/2026-10-09_session-06_companion_v2.md).
