# Fleet 25: root integration acceptance

Date: October 9, 2026. This is the root integrator's follow-up to the 25 completed
agent assignments, not a 26th agent or a new independent review. The documentation
owner compiled it from the review reports, saved layout/frame evidence and root's
deployment records. No new test, model call, commit or deployment was performed
to write this report. The DEV draft remains unpublished.

## Response to the independent UI judgment

[Assignment 22](fleet25-22-judge.md) reviewed the local sample app without source,
README or prior reports. Its three strongest requests were a direct first walk,
more room for the composer with food details disclosed progressively, and a
visible recent exchange. Root responded with these integrated changes:

- A direct **Try a 4,000-step walk** button appears in the sample world's initial
  chat area. It is visible on the first tested 320- and 390-pixel mobile screens;
  Pocket retains its existing control.
- The glyph fitter now follows scene width without stretching glyph proportions.
  The drawing reaches both scene edges: 320/390 pixels on the tested mobile
  viewports and the full 740-pixel scene on desktop. This removes the previous
  desktop gaps around a 529-pixel canvas. The larger desktop scene can extend
  below the first viewport; the mobile first-action visibility claim does not
  apply to the desktop capture.
- The latest user message stays visible with its reply. This provides a compact
  recent exchange, not a newly implemented full conversation-history view.
- Longer food and effort explanations moved into Pocket's food disclosure.
  The explicit effort selector and a short maximum-cost hint remain available
  before sending. Reset clears the displayed user/reply pair.

These are responses to observed issues. The independent reviewer did not re-score
the resulting build, and the earlier numerical scores have not been raised or
relabelled as a final product rating.

## Browser and source verification

Root's frozen-source browser chain passed **75 cases**: 41 smoke, 12 identity,
eight companion v2, 11 accessibility and three final-layout cases. These used
disposable desktop browser contexts and synthetic intercepted API responses,
with no paid inference or physical phone. The
[independent final audit](fleet25-25-final.md) records the corresponding source
check: **607 Worker tests**, **436 web tests**, both typechecks, web build and
diff checks passed. Counts describe the final checkpoint, not a sum of all
assignment runs.

The [saved layout checks](fleet25-final-layout/checks.json) report:

| Viewport | Scene / glyph width | Initial walk button bottom | Result |
| --- | --- | --- | --- |
| 320 × 700 | 320 / 320 px | 666.27 px, inside viewport | Pass; no horizontal overflow |
| 390 × 800 | 390 / 390 px | 700.23 px, inside viewport | Pass; no horizontal overflow |
| 1440 × 1000 | 740 / 740 px | 1074.89 px, below first viewport | Pass; no horizontal overflow |

Final simulated exchange captures: [320 px](fleet25-final-layout/exchange-320.png),
[390 px](fleet25-final-layout/exchange-390.png) and
[1440 px](fleet25-final-layout/exchange-1440.png). They contain no real walking,
real owner or live model evidence.

## Performance boundary

The final [full-width desktop storm measurement](fleet25-19-art-motion/full-width/measurements.json)
used a **740 × 838.656 CSS-pixel canvas**, DPR **2**, with **4× CPU slowdown**.
It recorded **593 scene frames over 10,065.9 ms**, averaging **58.91 fps**.
Nine of 592 RAF intervals exceeded 25 ms; the maximum was 50 ms. No page error
was recorded. This is near the 60 fps target, not a guarantee of 60 fps.

The earlier 59.98 fps sample used a smaller 529 × 600 canvas and cannot stand
in for this final geometry. Both are short desktop Chrome measurements. Neither
establishes sustained handset/WebView performance, battery use or physical
accessibility.

## Deployment record supplied by root

Root confirmed both deployments completed before the aligned v2 cutover,
**2026-10-09T08:43:00Z**:

| Component | Source checkpoint supplied | Deployed version |
| --- | --- | --- |
| API Worker | `d8a51ed` | `c5ea5b7c-336b-4fff-a557-3ad4a9086334` |
| Web | `d8a51ed` | `3b5bbf7c-8100-46af-8219-38a5dadd109c` |

The [final source audit](fleet25-25-final.md) independently checked that config,
decision, product spec and architecture used that same prospective cutover and
retained the legacy-cursor 409 guard. Deployment identifiers establish rollout,
not successful migration of every real pet or execution of a public away alarm.
Public acceptance, APK publication/download verification and final public-doc
release fields remain the root's separate delivery work.

Final Android artifact evidence remains [assignment 24](fleet25-24-release.md):
source `0a3c56c`, version 0.4.0/code 4, 129 JVM tests, lint 0 errors / 69 warnings
and three fresh WebView replacements preserving synthetic settings. It is a
debug test prerelease with no new physical-phone verification. The historical
81-step Samsung reading belongs to 0.3 and was not manually counted.

Provider totals remain unreconciled against the $50 cap. No new paid inference,
faster measured live replies, model-made gifts or independently judged model
quality is claimed by this acceptance record.

## Final delivery addendum

Root subsequently verified the [live migration and pre-return server alarm](fleet25-live-release/README.md),
[public sample](fleet25-public-web.md), [real gift in the deployed UI](fleet25-live-gift-ui.md),
and anonymous Android 0.4 download/checksum. These later checks close the
delivery gates above without changing the earlier independent review scores.
The phone and live-inference limitations remain.
