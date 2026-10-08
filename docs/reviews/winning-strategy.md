# A stronger competition entry for Truffle

Reviewed October 9, 2026. This is an independent product and evidence review,
not a claim that the live app, Samsung integration, or trained deployment was
verified in this pass. Sources examined include the product decisions,
current web/Worker source, Android integration notes, saved `r16` evaluation,
and primary contest, model-publisher and Android documentation. No GPU job or
public mutation was performed. The only accompanying edit is the corrected
`NOTICE-GEMMA.md`.

## The winning proposition

**A small desert creature gives you a reason to return from a walk, and knows
when to leave you alone.**

That is a stronger experience than earning access to a chatbot. The existing
ASCII landscape, فقع identity, Arabic voice, weather protection, and energy
rules all support it. The remaining work should make that relationship
observable. More integrations, a map, badges, or longer answers would make the
entry larger without resolving its central question: did it help someone put
the phone away?

The [official challenge](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)
weights writing most heavily; theme relevance, creativity, technical execution
and optional partner use follow. Its theme favours brief screen interaction,
and it welcomes a report of actual outdoor use. Gemma served through another
provider is eligible. One submission can win only once. These criteria favour
one convincing experience and a clear model contribution over extra sponsor
integrations. Deadline: October 11, 2026, 11:59 PM PDT, or October 12, 10:59 AM
in Oman.

## Four high-value proposals

### 1. Give the person a small thing to notice, then let them leave

**Implement first.** The current welcome already says to return and tell
Truffle what the person noticed. Make that invitation a usable two-step
interaction through the existing composer, without building a quest system.

- An optional **Take a moment** button reveals one fixed, bilingual invitation:
  “When you next step outside, notice where the shade ends. You can put the
  phone away.” Other invitations can concern a sound or a change in the sky.
  Do not invent the presence of a tree, bird, nearby park or safe route.
- On a burrowed day, use an indoor version: “No rescue mission today. From
  indoors, notice the light or a sound.” Offer waiting as equally acceptable.
  Missing weather information must not become an assertion that outside is safe.
- A quiet **I'm back** action brings focus to the existing, empty composer and
  changes its hint to **What did you notice?** It does not send a message,
  fabricate an observation, or require an answer.
- No timer, movement target, countdown, completion reward, GPS, camera or new
  database. Existing chat and memory rules apply only after the user chooses to
  send a real message. Pending UI state can be ephemeral; if persisted, scope
  it to the pet and local day and clear it on pet replacement/reset.

The invitation can be used with zero energy because it is product copy. The
return interaction must respect the existing disabled composer for sleeping
pets; it should not promise a reply that the energy rules prohibit. If the
pet is asleep, show the ordinary state and allow the person to leave.

This fits `web/src/main.ts`, `web/src/copy.ts` and a small amount of styling.
Use the existing `summary.state.burrowed`, `summary.local_day`, identity/reset
boundaries, and composer focus path. Keep it visually secondary to the scene
and out of the technical simulator controls. Verify English/Arabic, asleep,
heat, unavailable weather, reset, and no automatic send. No energy goldens
need change.

Why this earns its place: the phone gives an intention in seconds, the world
provides the experience, and Truffle receives the person's account. It creates
a role for conversation without making conversation the purpose of the walk.

### 2. Build the submission around one honest return

**Highest overall contest return; depends on Ahmed's real phone and account.**
The engineering is already much better documented than the human experience.
The marginal value of one real session exceeds another feature. The result
should be a compact field receipt, not a claim of proven behaviour change.

Capture a baseline at a known local time and zone; put the phone away; take an
ordinary walk if suitable; return; refresh Samsung Health/Health Connect;
sync; capture the accepted total, resulting pet state and actual model reply.
Record one thing Ahmed noticed and one thing that was awkward. Record the
actual time outside and approximate app interaction time separately. Do not
invent either duration or a story about why he walked.

The receipt needs only:

| Observation | Why it matters |
| --- | --- |
| Same-day baseline and returned Health Connect totals | Shows actual movement data entered the loop |
| Accepted feed, resulting energy and stage | Connects the movement to the creature |
| Actual reply with its model/fallback identity | Separates the adapted brain from the fallback |
| Ahmed's own short observation | Gives the story a person and place |
| App version, date, zone and limitations | Makes the evidence interpretable |

Health Connect aggregation is the correct path: its aggregate API deduplicates
activity data according to the user's source priorities. Consequently, an
unfiltered Health Connect total need not equal Samsung Health at every instant;
compare the same time window and report the actual difference and source
settings. Background reading also requires additional permission. Neither
step totals nor a successful feed establish that the person was outdoors.
[Android aggregation documentation](https://developer.android.com/health-and-fitness/health-connect/aggregate-data),
[Android reading documentation](https://developer.android.com/health-and-fitness/health-connect/read-data).

Make the demo film about a minute: sleeping world; phone put away; one real
outdoor detail; return; feed; the creature's reply; a short, explicitly
simulated heat-day insert. Do not label a simulator screenshot as the walk or
edit a wait into an apparent latency benchmark.

If field evidence is unavailable, use the actual evaluation failure as the
article's opening. A defensible draft direction is: **“I asked my AI pet to
let me rest. It told me to walk in 46°C.”** Immediately identify it as a test
prompt, then show what changed. Do not present Phoenix's synthetic test
weather as Ahmed's experience in Oman.

### 3. Make the trained personality inspectable without a live GPU

**Implement a small evidence page or article insert, not another panel in the
normal pet flow.** The trained model's long cold start means a judge may only
meet the untuned fallback. Labelling fallback is necessary, but alone does
not demonstrate what fine-tuning achieved.

Create a small recorded comparison from the existing JSONL artifacts. It can
load entirely as static content and cost nothing to view. Lead with the exact
`S12-076` pair in
`finetune/eval/out/2026-10-08-r16/{base,tuned}.jsonl`: the same heat-day prompt,
state and base model, once without and once with `r16`. Display the user's
prompt, the relevant state, the visible replies and record identity. Display
only the public reply, not internal reasoning. Label the whole exhibit
**Recorded evaluation · October 8 · not a live reply**.

The heat example is the clearest expression of the product's values. Add only
one other example if useful: `D01-0042` shows a low-energy response that offers
a manageable starting point to a large house-move request. An Arabic example
should be a real stored reply and must not imply that blind Arabic review is
complete.

State that examples are illustrative selections. Link the full 170-prompt
evaluation, keep the base-model-judge limitation beside aggregate scores, and
retain the voice-score regression. The exhibit demonstrates an adapter's
behavioural effect, not a production safety guarantee. The evaluation's
prompt differs from the Worker's extra instructions and stream protections.

One short provenance card can accompany it: exact base checkpoint/revision,
adapter run, training configuration, evaluation files and license. A public
adapter download, model card and checksum would make the open-model argument
stronger still. The recorded adapter currently lives on a Modal volume; do
not say the precise trained artifact is publicly downloadable until it is.
Preparing the artifact/card is separable from publishing it and requires no
new training run.

The useful claim is that access to weights let the project train and inspect
the personality directly. Energy gating itself is possible with a closed
API. Google documents configurable thinking modes, but also notes that larger
Gemma 4 models can sometimes emit thought-channel material even with thinking
disabled; keep the application's parser/guards and avoid claiming a literal
guarantee about the model's internal computation.
[Gemma 4 prompt format](https://ai.google.dev/gemma/docs/core/prompt-formatting-gemma4).

### 4. Make growth and rest feel consistent with the promise

**Small UI/copy work, with the existing rules preserved.** Growth currently
increases capacity, which can reduce the energy percentage and available
effort even though the person just walked more. For example, a spore at 4,900
energy has high effort; the sprout at 5,000/12,000 has medium effort. This is
valid engine arithmetic and a confusing reward.

At the stage transition, show the actual conserved resource and new capacity:
“Sprout now. 5,000 energy kept; room for 12,000.” Follow, if needed, with a
plain explanation that a larger body takes more energy to reach high effort.
Use actual state values, not fixed example numbers. A deliberate creature
reveal and this explanation are more valuable than additional particles.
Do not preserve the tier or refill energy silently: that would change the
approved engine.

Make the heat reward equally coherent. Current fixed copy says “a hot day,
and you still moved.” The word “still” frames perseverance through heat as
the achievement, although the engine cannot tell where the movement occurred.
Prefer “Your steps arrived. No rescue needed today.” with the true step count.
Never infer indoor movement from the internal event name `heat_day_indoor`.

Finally, do not describe the current product as pressure-free. Four unprotected
zero-energy midnights cause death, and larger stages have larger nightly burn.
Those are Ahmed's explicit decisions. Quiet copy can avoid blame, but cannot
remove the consequence. Present it as a deliberate, bounded virtual-pet game
and disclose the rule plainly. A later rest/sabbatical design would be a new
product decision, not a last-minute copy fix or hidden balance change.

## Critical factual correction: the Gemma 4 license

The repository applied the older Gemma Terms of Use to this project's model
lineage. That is contradicted by the exact publishers' current model cards:

| Checkpoint | Where used | Publisher's stated license |
| --- | --- | --- |
| `google/gemma-4-31B-it` | Upstream base; Plan B | Apache 2.0 |
| `unsloth/gemma-4-31B-it` | `train.py` default and recorded `r16` command | Apache 2.0 |
| `RedHatAI/gemma-4-31B-it-FP8-dynamic` | `modal_app.py` Plan A | Apache 2.0 |

Sources: [Google model card](https://huggingface.co/google/gemma-4-31B-it),
[Unsloth training checkpoint](https://huggingface.co/unsloth/gemma-4-31B-it),
[Red Hat serving checkpoint](https://huggingface.co/RedHatAI/gemma-4-31B-it-FP8-dynamic),
[Google's linked Apache license](https://ai.google.dev/gemma/apache_2).
Checked October 9, 2026. `NOTICE-GEMMA.md` is corrected. This does not assign a
new license to an unpublished adapter or dataset whose own metadata was not
inspected.

The root editor should reconcile the stale assertions in `README.md`,
`docs/post_draft.md`, `docs/03_finetune_plan.md`, `docs/04_research_facts.md`,
`finetune/README.md`, and `brain-modal/README.md`. Historical research notes may
retain context if visibly corrected. Do not propagate the old claim that all
Gemma-generated data inherits those older derivative restrictions. Likewise,
do not retain unsupported claims that the Google Gemma 4 repository requires
accepting the old terms merely because earlier Gemma models did.

## Recommended finish order

1. Finish root's reliability, first-use and rendering work; ensure the public
   first visit has a clearly labelled, usable fallback.
2. Add the tiny departure/return ritual and coherent growth/heat copy.
3. Build the static model comparison from saved evidence and correct licensing.
4. Obtain one authentic phone/walk account if possible. This is the remaining
   step software work cannot substitute for.
5. Rewrite the essay around the real return or the genuine heat-test failure.
   Keep central limitations beside their claims; collect ancillary readiness
   details in one short evidence/status note. Preserve the required template.

Defer routes, GPS proof, camera quests, notifications, extra prize categories,
leaderboards, more growth currencies, and another model-training run. The
entry is most memorable when a reader can explain why this particular small
desert creature belongs in this particular person's day.
