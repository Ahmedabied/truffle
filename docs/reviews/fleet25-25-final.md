# Fleet 25 / 25 — final independent integration audit

Date: 2026-10-09. Assignment 25 of 25. Reviewed decision 0023 against the actual
Worker engine, Durable Object, routing, gift ledger, browser ownership and
companion paths, current integration diffs, and native document handoff source.
No production files were edited by this assignment. No model, paid inference,
training, personal phone, external write, commit, or deployment was used.

**Signoff: no unresolved release-blocking source defect found.**
The final source freeze was independently checked at **08:29:41 UTC**. Config,
decision 0023, product spec and architecture all select **2026-10-09T08:43:00Z**,
then 13 minutes 19 seconds ahead. The legacy-cursor 409 guard remains intact.
The final handoff recheck at **08:32:40 UTC** still left 10 minutes 20 seconds.
Deployment must precede that cutoff; if it slips, root must select a new future
instant consistently before release. This document is local audit evidence,
not a claim that v2 is deployed or physically verified. Root completed the
final frozen-source browser chain successfully before this signoff.

## Independent checks

Fresh commands run by this assignment:

- `npm test --prefix worker -- --reporter=dot`: **607 passed**, 28 files, against
  the final frozen source and prospective cutoff. Earlier independent baseline:
  605 passed before this assignment's two additional tests.
- `npm test --prefix worker -- --reporter=dot test/final-integration-audit.test.ts`:
  **2 passed**.
- `npm run typecheck --prefix worker` and `npm run typecheck --prefix web`:
  both passed.
- `npm test --prefix web -- --reporter=dot`: **436 passed**, 19 files.
- `npm run build --prefix web` and full `git diff --check`: passed.

The new `worker/test/final-integration-audit.test.ts` combines subsystem
boundaries rather than replacing existing golden expectations:

1. An unsheltered legacy Spore closes one still-unsettled midnight at the old
   1,500-point cost and then one actual v2 day at 1,000 points. The result is
   exactly `6,000 - 1,500 - 1,000 = 3,500`, with integer units, owner hash,
   generation, history, favorite facts and previous grave preserved. A dated
   replay from the closed legacy day changes nothing and invokes no provider.
2. A scheduled gift crosses midnight while an unseen chat retains its 20-point
   reservation. The alarm closes the diary and creates one gift without an
   extra provider call or food charge. Cancelling a buffered, still-unseen reply
   aborts inference and releases the hold without charging or writing turns.
   A closed-day feed replay, another away request and another alarm cannot mint
   food or a second gift. All providers and weather are local stubs.

These are new contract/integration checks that passed against the integrated
implementation, not claims of a newly found and repaired regression. Existing
Vite native-loader and Node experimental SQLite notices were non-failing.

## Source conclusions

- Food has one canonical fixed-point balance, including uncharged reservations.
  Capacity includes held food, so a chat cannot create temporary feed capacity.
  Maintenance consumes only available units; expiry splits the interval at the
  ticket deadline. Repeated reads preserve fractional consumption. Stage growth
  does not change v2 upkeep or absolute capability thresholds.
- Migration settles legacy midnights through the cutoff, cancels legacy tickets,
  adopts v2 once and preserves records. The explicit **409 guard** still rejects
  a legacy cursor already beyond the chosen cutoff. It must remain in place;
  moving the cutoff prospectively is the release remedy.
- Owner authentication is followed by a fresh time/state read. Feed admission
  retains the absolute-total, pinned-zone, dated contract. Old days, duplicate
  totals, rollback and heat do not provide a replay-credit path in the reviewed
  code and tests. Unknown weather retains established shelter, and refreshed
  shelter applies only after the preceding interval has settled.
- V2 output cancellation aborts the provider and prevents guard cleanup from
  charging hidden text. A visible partial reply retains its one charge. Ticket
  identity and generation fence late output, resets, death and fresh lives.
  Ordinary/deep trained-provider routing limits remain four/eight seconds;
  fallback begins sequentially after the failed attempt is cancelled.
- Gift creation is bounded procedural composition plus authored bilingual text.
  The alarm does not call a model. Owner authentication, generation, request/job
  identity, completion-day fence and twelve-item collection bound are present.
  Stale returns cannot cancel a newer job; delayed receipts cannot overwrite a
  newer accepted snapshot. Daily-limit away requests are successful no-ops.
- Real owners remain stored after failed or declined imports. Native authority
  requires the exact verified import, origin, pet, generation and document nonce.
  Movement is presentation only. The native refresh now recreates the document
  without clearing saved browser ownership; no general credential bridge exists.

## Evidence boundaries and release gates

Root's fresh frozen-source browser chain passed **75 cases**: 41 smoke,
12 identity, eight companion v2, 11 accessibility and three final-layout
viewports. This assignment read the test sources and final layout output, but
did not duplicate root's browser execution or overwrite shared captures.
These use disposable desktop contexts and synthetic intercepted API responses.
They demonstrate browser behavior, not public alarm execution or physical
Android behavior. The three final-layout cases cover 320/390/1440 viewports,
an initially visible first-walk action on mobile, full scene width without
glyph stretching, effort detail in Pocket and cleared user/reply text on reset.

The final native source checkpoint is `0a3c56c`. Assignment 24's
[release report](fleet25-24-release.md) records a successful workstation build,
129 passing JVM tests, lint at zero errors/69 warnings, and three stable native
WebView replacements preserving a fabricated owner's settings. That emulator
check does not establish successful Truffle verification or a physical owner
import. This assignment independently checked the handoff APK's **12,588,066
bytes** and SHA-256
`1ddc5b0d50240a610078c36693580f4fa5074500a0aab1d7afd429f97ae47962`,
which match the report, and confirmed the raw APK is ignored by Git.
The historical physical 81-step
result belongs to v0.3, not the new v0.4 reactions. The unavailable phone leaves
physical step accuracy, endurance, background delivery, WebView performance and
TalkBack behavior unverified.

The final [full-width measurement](fleet25-19-art-motion/full-width/measurements.json)
records **58.91 fps**, 740 × 838.656 CSS pixels, DPR 2 and 4× CPU slowdown in a
desktop storm sample. It includes nine of 592 RAF intervals above 25 ms and a
50 ms maximum; there were no page errors. This is near the 60 fps target, not a
guaranteed 60 fps result. The earlier 59.98 fps observation used 529 × 600 pixels
and must not be substituted for this wider geometry. This assignment read the
raw measurement and visually reviewed the final 320/1440 exchange captures;
the latest user message is paired with the reply and the art reaches the scene
edges. These are simulated, credential-free captures.

Hidden-tab absence is best effort and has no cross-tab presence coordination.
A hidden peer can schedule a gift while another tab remains visible. Server
deduplication still limits the result to one gift per pinned day. A page closed
before the away event reaches the server cannot promise background work.

The provider ledger remains unreconciled. This release must not claim a new
live latency measurement, an actual model-made gift, or independently judged
model quality. No paid inference was needed for this audit.

The DEV draft remains `published: false` and distinguishes simulation, authored
notes, historical live evidence and new local checks. A bounded pattern scan of
candidate source/release text found no provider-token or private-key pattern.
This is not a full secret or git-history audit. Raw `fleet/outbox/U01`–`U08`
material was neither tracked nor staged during this review and remains outside
the approved artifact scope. Synthetic emulator images require that label if
published. No new personal-phone evidence is approved by this assignment.

Before deployment, root must recheck that the aligned cutoff is still future,
retain the 409 guard, finish release claim updates and keep unreconciled/raw
artifacts out of publication. No public rollout,
anonymous APK download or successful real-pet cutover is established by this
predeployment source audit.
