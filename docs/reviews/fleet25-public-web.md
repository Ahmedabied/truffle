# Public web acceptance: decision 0023

**PASS**, October 9, 2026 at **08:39:37.903 UTC**, on the deployed
[sample world](https://truffle-web.ahmed-abied.workers.dev/demo?mock=1).

An isolated headless Chrome 155.0.8059.39 profile used a 390 × 800 viewport,
DPR 2 and reduced motion. Network routing allowed only same-origin GET assets;
all external origins, non-GET requests and mutation/model endpoints were blocked.
The profile was disposed after the check. No live API request, inference,
new owner, real step feed or phone action occurred.

- The page and deployed assets returned HTTP 200:
  `index-BhwT02vE.css` and `index-Buvb-sWe.js`.
- The running application confirmed `mock: true`, `demo: true` and energy
  version 2, with the visible **offline demo** label.
- **Try a 4,000-step walk** appeared in the initial viewport; its bottom was
  700.23 px within the 800 px height. Clicking it produced exactly 4,000
  simulated steps and hid the shortcut. No chat was sent.
- Scene and glyph canvas both measured 390 px wide, with no horizontal page
  overflow. The chat section followed the complete world section.
- Visual inspection of both captures confirmed a complete mushroom: cap,
  face, body and planted feet. The empty-food scene has closed eyes; the fed
  sample has an awake expression. These are sample states, not physical activity.
- No page errors, console errors, failed asset responses or attempted blocked
  requests were observed.

Evidence: [machine-readable acceptance](fleet25-public-web/acceptance.json),
[initial sample](fleet25-public-web/sample-initial-390.png) and
[after the simulated walk](fleet25-public-web/sample-after-walk-390.png).
The screenshots contain the labelled mock world and no owner credentials.

Root supplied release context: source `d8a51ed`, web version
`3b5bbf7c-8100-46af-8219-38a5dadd109c`, API version
`c5ea5b7c-336b-4fff-a557-3ad4a9086334`. This check independently confirms the
expected hashed asset filenames return HTTP 200 and exercises their sample UI.
It does not verify server migration, alarm execution, live
model output, native ownership or phone performance. Root owns those separate
release checks; no such result is inferred from this sample acceptance.
