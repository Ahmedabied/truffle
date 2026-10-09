# Assignment 19 — ASCII anticipation and motion

Implemented a separate `anticipating` face in `web/src/scene/pet.ts` and routed it from `presentationFace` in `web/src/scene/world.ts`. Anticipation has attentive `(O)` eyes, a restrained 2.5% upright body lift, a quarter-row cap lean and slightly raised hands. It uses the existing 650 ms geometry interpolation and natural blink clock. Both feet stay grounded; anticipation adds no hop or lateral oscillation. The cap, stem, feet, tier freckles and existing small intelligence growth remain intact.

Sleep, tiredness, wilting, burial and death now outrank companion reactions and yawns. Entering these states clears old expression interpolation immediately, so an old happy hop cannot linger after an authoritative health change. Protected health states also suppress stray yawn effects. Reduced motion freezes anticipation, blinks, breathing and weather while displaying the requested static expression.

Applied `animate`, `optimize` and `frontend-design` skill principles using the user’s established nostalgic ASCII, quiet companion and performance constraints.

## Art review

The existing authored mountain strokes, foreground details, layered clouds, lit cap freckles and quiet face plane already carry the nostalgic style and depth well. I avoided additional decoration: the missing distinction between anticipation and affection was the meaningful gap. The new pose remains a mushroom in every living stage. Sleeping at night retains the full silhouette and closed eyes.

Reviewed the real Chrome [expression contact sheet](fleet25-19-art-motion/after/expressions-desktop.png) and [storm page](fleet25-19-art-motion/after/storm-desktop.png). The contact sheet uses the production font stack. Its earlier “before” sheet used generic monospace, so font rendering should not be compared pixel-for-pixel across those two sheets; the within-sheet equivalence of the old anticipating/happy poses is still visible.

Layout observation sent to root: at a 1440 × 1000 desktop viewport, the 740 px scene contains a 529.406 × 600 CSS-pixel glyph canvas. The background extends across the scene, but the aspect-preserving fitter leaves approximately 105 px of unglyphed background on each side. This pass preserves the ASCII proportions; full-width landscape coverage remains a layout follow-up.

## Verification

- `npm --prefix web test -- scene-emotions.test.ts scene.test.ts`: **28 tests passed**.
- `npm --prefix web run typecheck`: passed.
- `git diff --check -- web/src/scene`: passed.
- `node web/test/scene-emotions.browser.mjs before` and `after`: passed; no page errors; local mock state confirmed. The browser test rejects nonlocal origins and verifies distinct native-canvas pixels for content, anticipation and happiness.
- New tests cover distinct glyph expressions, interpolation in both directions, protected health appearance with both reactions/yawns, grounded feet at all four stages over six seconds, and complete reduced-motion freezing in storm weather.

## Desktop Chrome frame timing

Measured the loaded application with native canvas rendering, not the mock-context Node benchmark. Root and Agent 20 paused their browser workloads during each sample. Chrome **155.0.8059.39**, headless desktop Linux, viewport **1440 × 1000**, device scale **2**, DevTools CPU throttle **4×**. Scene: **Elder, GB, storm code 95, 5 mm precipitation, 40 km/h wind, hour 15**. Rendered canvas: **529.406 × 600 CSS px**, **1100 × 1224 device px**. Each sample followed 1.5 seconds of warmup.

| Measurement | Before | After |
| --- | ---: | ---: |
| Sample duration | 10,006.3 ms | 10,003.2 ms |
| Scene draw frames | 600 | 600 |
| Scene draw rate | 59.96 fps | 59.98 fps |
| RAF interval p50 / p95 | 16.7 / 16.7 ms | 16.7 / 16.7 ms |
| RAF interval p99 / maximum | 16.8 / 16.8 ms | 16.8 / 16.8 ms |
| RAF intervals over 25 ms | 0 / 599 | 0 / 599 |

Raw evidence: [before](fleet25-19-art-motion/before/measurements.json), [after](fleet25-19-art-motion/after/measurements.json). The first sampled after HUD label still read 52 fps; subsequent nine labels read 60 fps. Those rolling labels overlap their prior reporting window. The independently timed sample recorded 600 scene draws and no RAF gap above 25 ms. HUD composition/paint timings measure JavaScript and canvas submission, excluding GPU/display latency. The small timing difference is normal sample noise, not a claimed optimization. This is **desktop browser evidence only; no handset, Samsung, or guaranteed 60 fps claim**.

No public/paid inference, phone access, commits or deployments were used.
