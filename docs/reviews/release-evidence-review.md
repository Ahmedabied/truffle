# Release evidence and privacy review

Reviewed October 9, 2026. Scope: prepared `docs/` text and assets, root README,
model notice and `explorations/`. This was a read-only evidence review apart
from this report. Raw fleet/private material and partial U01–U08 packets were
excluded. No application tests, inference, browser/device interaction or
deployment were performed by this reviewer.

## Privacy finding and disposition

**Unconfirmed credential exposure — historical settings screenshot.**
`docs/assets/2026-10-08_web_errors_401_settings.png` contains a visible
three-word phrase next to credential/recovery UI. Its value is deliberately
not reproduced here. No matching public fixture was found in `web/`, `worker/`,
`docs/` or `tests/`. This is a privacy flag, not a confirmed active ownership-key
disclosure. The integrator removed the tracked image from the current tree and
changed its historical B08 reference to state that the asset is withheld for
unconfirmed pairing-phrase provenance. No history rewrite or replacement was
performed. The new release material therefore excludes this asset; this does
not assert that historical Git objects have been purged.

## Release reconciliation

- At the reviewed snapshot, README and the submission checklist still said
  **30 browser cases**. The integrator subsequently reported **40 browser
  cases, 177 web unit tests, typecheck and build passing** at final web commit
  `f388eef`; Worker evidence remains **428 tests**. Those are integrator-supplied
  results, not independent reruns by this review. The integrator also reported
  that `f388eef` is live as deployment
  `7d31e6ff-aff6-4584-b604-d4410332778b`. Reconciliation of release-facing
  counts remains with the integrator; correctly dated historical checkpoint
  reports need not be rewritten.
- Android QA correctly distinguished **101 JVM tests**, **zero lint errors /
  60 warnings**, the direct **81-step → 81-energy** feed, its repeat without
  extra credit, and the short Samsung **Chrome** 60 fps sample. The integrator
  subsequently reported that the installed `4c86a68` native World displayed
  the same selected 81-step pet. Preserve the final device report, build hash
  and ownership observation before treating the replacement APK as verified.
- `public-walkthrough/chat-and-gift.json` preserves a real partial run with
  `success: false`: its harness expected the demo calendar date to advance.
  The latency, reply provenance, free return and gift-tap observations remain
  useful. Preserve that failure and add/link the successful age/energy-based
  continuation before claiming the entire public walkthrough passed. That
  continuation was still running at this review's handoff.
- All **113** Markdown/HTML local or repository-mapped targets existed.
  Five targets linked by the post were still untracked at the review snapshot:
  `docs/reviews/ascii-art/after/day-scene.png`,
  `docs/reviews/ascii-art-direction.md`,
  `docs/reviews/recorded-browser-latencies.json`,
  `docs/reviews/public-walkthrough/chat-and-gift.json`, and
  `docs/submission_checklist.md`. Commit/push the selected evidence and check
  its GitHub/raw links as a visitor. Local existence is not a remote-link pass.

## Claims checked

- Both opening `S12-076` quotations match the saved base/tuned replies. The
  tuned excerpt marks the omitted passage. Each result file contains 170
  records, and the displayed metrics match the evaluation report. The post
  retains the same-base judge, regression, Arabic-review and production-prompt
  limits; it does not call the fictional heat case a real outdoor observation.
- The exact [Google](https://huggingface.co/google/gemma-4-31B-it),
  [Unsloth](https://huggingface.co/unsloth/gemma-4-31B-it) and
  [Red Hat](https://huggingface.co/RedHatAI/gemma-4-31B-it-FP8-dynamic)
  publisher cards currently identify Apache 2.0. Google's card links its
  [Apache 2.0 license page](https://ai.google.dev/gemma/apache_2).
  `NOTICE-GEMMA.md` accurately separates application code from model/adapter
  artifacts and avoids assigning a generated dataset a license by inference.
- The energy carryover README/report explicitly say **exploration**, with
  **45 exploratory checks** and **72 existing production tests**. Proposed
  1,000-point daily consumption and dormancy are not presented as implemented.
- The 81-step observation is bounded as a real hardware-to-energy path, not
  calibrated accuracy, outdoor proof or habit change. The phone performance
  claim is bounded as a short Chrome sample, not sustained WebView performance.

## Privacy coverage and limits

Pattern scans of **35 prepared text files** found no provider tokens, private
keys, literal bearer credentials, ownership-secret assignments or credential
URLs. A route-template match was a placeholder, not a literal credential.
OCR and metadata inspection covered **66 images**: the historical screenshot
above was the only credential-context flag requiring disposition and has been
withheld from the current tree; no EXIF
identity/location tags were found. Direct visual inspection of the two new
Samsung screenshots found no pairing phrase or ownership key. OCR and pattern
scanning are bounded checks, not proof that every possible private datum is
absent. Raw session transcripts and private device preferences were not cleared
for publication by this review.

The DEV draft remains unpublished. This report does not itself approve a
deployment, publish a post, or establish anonymous APK-download availability.
