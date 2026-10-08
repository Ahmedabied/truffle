# Independent blind judge review

Reviewed October 8–9, 2026. I formed the initial impression without reading application source, README, or submission copy. I then read `README.md` and `docs/post_draft.md`. No application source was inspected or changed. This report reflects the build observed during the review; the root agent reported subsequent fixes, which I have not independently reverified.

## Verdict

**There is a plausible Gemma-category contender here, but the observed submission experience is not prize-ready.** The central idea is unusually legible once someone explains it: a creature's energy determines the amount of intelligence it can afford. The ASCII desert and Arabic context make it memorable. The heat-day refusal is the best expression of a product philosophy. Those strengths are buried under a simulator interface, an inaccessible public demo at the time of testing, and a write-up without a demonstrated real walk.

I would remember the concept. I would not yet choose it over an equally original entry that shows a person going outside, a working live inference, and a concise story about what changed. More infrastructure or more prize-category logos would not close that gap.

## Evidence and limits

- Local URL: `http://localhost:5191/demo?mock=1`, isolated headless Chrome context, desktop viewport 1440 × 1000.
- Additional responsive check: Chrome viewport 390 × 844 with mobile/touch emulation. This was **not** a phone or Samsung/Health Connect test.
- Public URL: `https://truffle-web.ahmed-abied.workers.dev/demo`, fresh browser context. It returned the demo creation rate-limit state. I could not evaluate its live model output.
- Local interactions included zero-energy chat, 1,000/4,900/5,000/6,000/15,000 simulated steps, automatic and requested high effort, heat toggle, several midnights, and English/Arabic switching.
- Local replies are explicitly labelled samples. They establish the demo's explanatory quality, not the trained model's quality, latency, or safety.
- Screenshots are in `/tmp/truffle-blind-initial.png`, `/tmp/truffle-blind-public.png`, `/tmp/truffle-blind-6000.png`, `/tmp/truffle-blind-mobile.png`, and `/tmp/truffle-blind-mobile-arabic.png`.

The [official challenge](https://dev.to/challenges/hacktoberfest-week1-2026-10-05) puts writing first, followed by prompt/theme relevance, creativity, technical execution, and optional partner use. It asks for open AI to be central, for the screen to occupy little of the experience, and welcomes an account of taking the build outside. A project can win only once per challenge. These criteria favour improving the account of a real experience over accumulating integrations.

## Highest-priority findings

### 1. The public judge experience failed before demonstrating anything

The public demo showed “Too many demo Truffles from here. Try again in 1 h.” twice. The composer was disabled, while “Planting your spore...” remained below it. The scene kept animating. A judge cannot tell whether this is temporary loading, an outage, or a broken entry. One hour is longer than a judging visit.

Make the first visit reliably reviewable. A clearly labelled local sample walkthrough is an appropriate fallback; give it a visible live/sample distinction and a path to retry the live brain. Do not let the pet's animation imply that the underlying application is ready. The root agent reports implementing a local fallback after this observation; deployment and revalidation were pending.

### 2. The opening presents a test harness before it presents a reason to care

The first desktop view was the word “Truffle,” an “offline demo” badge, a large landscape, a dense status line, and “Judge mode.” No sentence stated what the product did. The composer began below the 1,000-pixel viewport. On the 390 × 844 view, it was also below the fold. “Next midnight,” “Ask for effort,” and a numeric slider arrived before any guided payoff.

The setting is attractive enough to earn attention, but a visitor must reverse-engineer the product from its controls. Put the README's clear promise on the page: **“A little desert creature that eats your steps and spends them to think.”** Follow with one short, honest instruction about simulated movement. Make the primary experience a sequence: wake it, hear it, try a heat day. Keep the controls for arbitrary days available beneath that sequence.

The root agent is already moving the technical controls below the composer and improving the opening. Preserve the pet's atmosphere while reducing the amount of interpretation required.

### 3. Growing currently looks like losing intelligence

This is a direct observation, not an inference from source:

| Simulated daily steps | Stage | Displayed energy | Next effort |
|---:|---|---:|---|
| 4,900 | Spore | 82% | High |
| 5,000 | Sprout | 42% | Medium |

Capacity growth may explain the arithmetic, but it does not explain the player's experience. The child grows after another hundred steps, then loses access to the richer answer it just had. That conflicts with the intuitive promise that walking feeds a growing mind.

Decide whether this is an intentional tradeoff. If it is, explain the increased capacity and cost at the moment of growth. If it is not, preserve the earned effort tier or the proportion of energy through a stage transition. Do not quietly change balance solely for a screenshot; make the rule coherent in the real engine and demo.

### 4. The Touch Grass claim is a premise, not yet a demonstrated outcome

The post honestly says there is no verified Samsung-to-pet comparison or walking diary. That honesty is good; the absence is still the largest contest weakness. Step totals show movement rather than outdoor presence. Chat as the principal reward can also bring the user back to the screen.

The highest-return work is one real field session: establish the step baseline, put the phone away, walk somewhere ordinary, show the returned Health Connect total and corresponding pet state, then show the actual response. Record the time outside and the short time spent in the app. Describe one specific thing noticed on the walk and one real annoyance. Do not claim behaviour change from a single session.

The product can reinforce noticing the outside world without becoming another task list: an occasional short return question such as “Was there wind?” is already present in the high-effort sample and fits the character. Avoid requiring a photo, GPS proof, or more interaction to certify the walk.

### 5. The essay contains a better story than the one it currently leads with

The opening explains system behaviour and immediately asks the reader to turn up simulated heat. It gives me no person, place, moment, or frustration. The strongest narrative is later: a model told someone to walk during dangerous heat, and the maker taught a desert creature that it does not need rescuing.

Use an authentic Muscat moment if there is one. If there is not, lead with the actual evaluation failure, labelled as an evaluation, and why it mattered. Then demonstrate the corrected behaviour and explain the design. The “no rescue mission” idea is more distinctive than a table of thresholds.

The draft has useful technical evidence, readable architecture, and admirable limits. But the succession of caveats about pending seeds, pending handset work, pending Arabic review, cold starts, fallback delays, self-judging, missing public APK, and missing transcript makes it feel like an internal readiness audit. Consolidate noncentral limitations into a compact “proved / still to test” block. Keep caveats beside claims when they are necessary to interpret the claim—especially self-judged evaluation scores and model provenance.

### 6. The trained brain needs one undeniable, accessible demonstration

The local demo cannot prove the adapter ran. The public demo was unavailable. The documents say cold starts can take ten minutes and the initial untuned fallback may take about 26 seconds. A judge can easily experience a generic fallback and leave thinking that is the fine-tune.

Provide one short recording with visible model provenance and no editing across the wait being measured. Show the same prompt/state with base and adapter, preferably the heat example, and make the inference source obvious. A recording is evidence and an availability backstop; it does not replace an accessible app. Keep the live model warm for a planned recording or review window if feasible, and remain honest about cold operation.

## Additional observed issues

- **Fast slider/chat race:** moving to 6,000 steps and sending roughly 300 milliseconds later produced a 50%/medium header but a 0%-energy explanation and snore. After moving to 15,000/high, the next explanation used the prior 50%/medium state. Waiting 2.2 seconds after changing the slider produced the correct tier. The root agent reports fixing this race; I did not retest that change.
- **Mixed-language demo:** switching to Arabic translated controls and status but left the explanatory sentence in English, including “0 steps today. Energy 0%...” and the English weather string. The right-to-left layout itself worked without horizontal overflow at 390 pixels. The Arabic view wrapped the three simulator actions onto two lines. This is not evidence of Arabic model quality; that remains untested here.
- **Pet visibility:** the sleeping creature is small and camouflaged against glyph-heavy terrain. The face becomes clearer after growth, but the user's emotional anchor competes with the background. A restrained contrast or silhouette adjustment is higher value than more particles.
- **Status overload:** “Energy 0% · Spore · 0 steps today · effort asleep · asleep · 34C clear, Muscat” duplicates asleep and exposes technical tier language before explaining its relevance. Surface a human status and put exact engine detail in the inspector.
- **Moment timing:** the “best day this week. 4,900 steps” message remained while the total moved to 5,000 and then 15,000, before later updating. A queued celebration can appear stale beside a live counter. Ensure the visual treatment reads as a past event, or collapse superseded events in the fast demo.
- **Death and affection:** the documents disclose four unprotected empty-energy midnights leading to a grave and affection decreasing. This is coherent as a demanding Tamagotchi, but it creates a different emotional promise from a gentle companion that gets people outside. Choose the intended relationship explicitly. Consider whether rest beyond hot weather deserves first-class treatment; do not describe a guilt mechanic as universally motivating.

## What genuinely works

The ASCII world is recognizable and materially different from a standard chatbot dashboard. A desert truffle in Muscat, with Arabic around the scene rather than forced into its glyph grid, has a particular cultural identity. Preserve that specificity.

The most interesting technical choice is putting the rules outside the language model while making intelligence an in-world resource. The user can understand energy paying for thought without understanding the model host. The “rules in code, soul in weights” explanation communicates this cleanly.

The fine-tuning account has substance: a baseline comparison, an adapter, disclosed training cost and duration, failures, and an explicit acknowledgement that energy gating alone does not require open weights. That makes the open-model argument credible rather than ornamental.

The draft does not hide worse voice scores or pretend a same-family judge is independent. Keep that honesty. The proposed explanation that the judge favours its own style is a hypothesis; do not let it dismiss a real preference regression without blind human or independent evidence.

## A practical route to a stronger entry

1. Make the public first visit work and make the first minute self-explanatory. A judge should understand the promise, see the pet wake, and understand the heat exception without reading repository documentation.
2. Resolve or clearly explain the stage-growth reward inversion. This is a conceptual coherence issue, not merely copy polish.
3. Obtain one authentic, modest outdoor session with verified feed movement and an actual tuned-model response. Publish only what the evidence supports.
4. Cut a roughly one-minute demo: sleeping creature; phone put away and an actual outdoor detail; return and growth; one richer answer; heat causes permission to rest. Label any simulator inserts.
5. Rewrite the post around that experience or the authentic heat-test failure. Keep a small selection of model evidence in the main narrative and link the complete evaluation.
6. Enter Gemma with a focused argument: access to weights enabled a state-aware personality adapter and a directly inspectable baseline comparison. More categories add little unless already central and well demonstrated.

I would not spend the remaining time adding maps, social feeds, leaderboards, extra partners, or broadening the app. I would spend it making a single distinctive promise true, visible, and well told: **this small desert creature can reward movement, and it also knows when to let its person rest.**
