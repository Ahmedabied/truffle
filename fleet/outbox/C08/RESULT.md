# C08 judge read: Touch Grass and the human story

## Outcome

**Overall: 6.0/10 for the evidence available on October 8, not for the promised final build.** The desert truffle, Arabic voice and Oman heat rule make a memorable idea, but the repository currently proves that simulated steps change a pet, not that the pet made Ahmed take a walk or spend less time on a screen. The biggest improvement is one documented real walk, not another feature.

Top cut: the README's present-tense claim that the live brain is fine-tuned Gemma 4 31B. Top addition: Ahmed's first-person, timestamped outdoor field test, placed before the technical story.

## Actual challenge criteria and scores

Source: https://dev.to/challenges/hacktoberfest-week1-2026-10-05, fetched with WebFetch on October 8, 2026.

The theme says: "Build something with open-weight models or open-source AI that gets people off the screen and into the world."

The bonus says: "Bonus points if you take it outside, use it, and tell us how it went."

The following criterion labels are quoted verbatim. The page provides no numeric weights, only the stated priority for writing. The overall score above is an editorial assessment, not an invented official weighting formula.

| Quoted criterion | Score | One-sentence assessment |
|---|---:|---|
| "Writing Quality (weighted most heavily)" | 5/10 | The hook and local setting are strong, but the human diary is still a plan, appears seventh in the outline, and competes with unsupported present-tense claims in the README. |
| "Relevance to the Prompt and Theme" | 5/10 | Steps fund a real interaction loop, but indoor steps also count and no completed real-world field test in the supplied evidence shows an additional outdoor walk or reduced screen time. |
| "Creativity" | 9/10 | A Gulf desert truffle that burrows in heat and spends walking energy on conversation connects place, character and mechanics unusually well. |
| "Technical Execution" | 7/10 | The live engine and fallback chat work, including protected midnights and death, but Samsung verification, the public APK and the planned trained serving path remain unproven here. |
| "Use of Partner Technology (optional)" | 6/10 | The live response identifies Workers AI Gemma and the router implements tier-dependent inference settings, but neither a deployed 31B LoRA nor its measured contribution to voice has been demonstrated. |

## Five cuts, ranked by impact

1. **Cut planned work presented as shipped** from `README.md:5,13` and post "What I Built": remove the current fine-tuned 31B claim until a deployed adapter is verified, and put the actual Workers AI fallback status directly below the hook instead of contradicting it near the bottom.
2. **Cut the exclusivity and privacy absolutes** from `README.md:11-15` and post "Why Does Open Innovation Matter": request gating is code, not proof that a closed API cannot implement the mechanic, while weather coordinates go to Open-Meteo, so replace both absolutes with the concrete controls and data destinations actually used.
3. **Cut death as the headline threat and unqualified guilt-free language** from `docs/06_writeup_plan.md:8-9,15` and `README.md:5`: "dies if you stay inside" is false because indoor steps count, and a pet that loses affection or dies during inactivity needs an honest care discussion rather than a reassurance slogan.
4. **Cut unlimited-memory and intelligence-growth promises** from `README.md:5` and the post title candidates: more steps unlock an inference budget, not demonstrated greater intelligence, and the spec stores at most 60 facts rather than remembering everything.
5. **Cut the pre-diary technical procession** from post "What I Built" and "How I Built It" in `docs/06_writeup_plan.md:16,19-21,41-45`: move the full energy table, three separate stage portraits, fleet detail and serving alternatives behind links so the reader reaches the walk before the infrastructure.

## Five additions, ranked by impact

1. **Add the walk as the opening scene** to `docs/06_writeup_plan.md` "Opening", "Demo" and "The diary": use Ahmed's actual reason for leaving, departure and return times, before/after steps, observed weather, one exact pet reply and his own feeling, then follow with the three-day diary including a day that did not work.
2. **Add a reproducible phone-to-pet receipt and first-run path** to `README.md`, `feeder-android/README.md` and the APK release notes: publish the tested APK link and demonstrate Samsung Health, Health Connect, Feed now and Truffle agreeing after a real walk, with measured sync delay, screen-off behavior and credentials hidden.
3. **Add an honest care and safety box** to post "What I Built", `docs/01_product_spec.md` and a proposed `decisions/` record: explain that heat pauses burn and the death counter but not affection, disclose missing-weather and illness/rest limitations, and require approved rules plus tests before promising protected rest or fail-safe weather handling.
4. **Add a dated brain-status and voice-evidence table** to `README.md` and post "How I Built It": separate the live 26B fallback from planned 31B training, show exact model/adapter identity and paired held-out results if training ships, and label the 1,800 filtered rows as training preparation rather than quality proof.
5. **Add a short, explicitly simulated judge walkthrough and evidence index** to `README.md` and post "Demo": reset, feed 3,000 steps, chat once, enable heat and advance midnight, then reset and advance four zero-energy midnights, linking the five proof assets below and keeping simulation separate from the real walk.

## The five screenshots or numbers that matter most

These are collection priorities, not invented results or existing diary entries.

1. **One real walk receipt:** a compact before/after phone panel showing timestamped Samsung Health totals, the Health Connect/feeder total and Truffle's matching step delta, paired with a short outdoor clip that establishes where Ahmed actually walked; include elapsed walking time and sync delay, not a demo slider.
2. **A three-day, one-person diary table:** date, steps, actual outdoor walking minutes, local apparent temperature, app screen time, whether Truffle prompted an extra outing and one sentence in Ahmed's words; use an existing pre-project step average only if available, and call this an anecdote rather than causal proof.
3. **A protected-day receipt:** a burrowed phone view beside the sourced daytime forecast and before/after midnight values for energy, `zero_days` and affection, distinguishing a real hot day from a forced demo toggle; the code's 42C cutoff is a product rule, not evidence that 41.9C or sunset is safe.
4. **A personality payoff pair:** the same short check-in at low and high energy, with exact replies, charged tier and provider label visible, including a natural Arabic line with an English gloss; this must show what made Ahmed want to return without rewarding an endless chat session.
5. **A small, reproducible voice/safety evaluation table:** compare the same base model before and after its adapter on held-out prompts, report denominators for heat-safe replies, state leakage and Arabic naturalness, and include one failure; if no training ships, publish fallback-only findings rather than a fabricated before/after.

A gravestone is an optional explanatory asset, not the lead image. The attractive existing `docs/assets/2026-10-08_world_engraving_affectionate_day.png` visibly says "offline demo", so its 9,800 steps cannot stand in for Ahmed's walk.

## Three claims a skeptical judge will doubt

### 1. "This gets me off the screen and into the world."

**Why doubt it:** `docs/01_product_spec.md:175` explicitly accepts indoor steps, the reviewed feeder evidence reports emulator totals of zero, and the write-up outline contains a diary protocol rather than completed diary entries. More steps also buy more chat, so reduced screen time is not automatic. Simulated death and growth demonstrate rules, not motivation.

**Evidence that closes it:** a genuine outdoor departure and return, independently visible phone step totals, a successful feed, measured time in the app and Ahmed's specific account of a walk he otherwise would have skipped. Keep the unsuccessful day and indoor alternative. One person's three days can support "it got me out on Friday", not a general behavior-change claim. Do not invent his emotions or use generated training replies as diary quotations.

### 2. "The soul lives in fine-tuned Gemma 4 31B weights, and open weights make this possible."

**Why doubt it:** `STATE.md` says training and Modal serving have not started, the live health check returns `modal:false`, and my chat identified `workers-ai` with `half_awake:true`. `finetune/data/generated/REPORT.md` records 1,800 kept rows, 1,720 train and 80 hold-out, but filter acceptance is not a trained-model evaluation. The engine separately enforces budgets, and the 90-prompt eval set is not the same artifact as the 80-row data hold-out.

**Evidence that closes it:** an identifiable adapter artifact, training configuration, deployed model identity and same-base-model held-out comparison with exact settings and failures. A 26B fallback versus a tuned 31B comparison alone cannot isolate the effect of fine-tuning. Explain editable weights, adapter portability and serving choice without claiming API request gates are unique to open models. If the adapter is unfinished, lead with the truthful fallback story and call training unfinished.

### 3. "This is a kind reason to walk, and heat days protect you."

**Why doubt it:** `worker/src/engine.ts:210-220` updates affection before the heat exemption, so a protected zero-step day still loses affection; four unprotected zero-energy midnights cause death, with no general illness or disability pause. `STATE.md:39` and `worker/src/do.ts:179-182` expose unresolved missing-weather behavior. The historical S09 baseline includes one unsafe 44C reply, which is not a measurement of today's hardened prompt but is a reason to retest it.

**Evidence that closes it:** a public, precise care contract, owner-approved decisions for rest and unknown weather, deterministic tests for those choices, and a current bilingual safety evaluation of every brain that can answer users. Include explicit survival-pressure prompts and genuinely unsafe evenings. Ask Ahmed how the death mechanic felt on the bad day, and publish his answer without polishing away discomfort. Until those gaps close, claim the specific heat exemption, not "never shames" or general safety.

## Verification and limits

- Read every required input in the packet, all 14 decision records, the feeder README, brain router, demo routes, historical S09 report and two existing screenshots; no application or documentation file was edited.
- WebFetch returned the quoted challenge criteria, theme and outside-use bonus; a separate direct Python fetch was blocked with HTTP 403, and partner-specific Gemma eligibility was not independently revalidated from the truncated fetch.
- `curl --max-time 30 -sS -i https://truffle.ahmed-abied.workers.dev/health` returned HTTP 200 with `{"ok":true,"service":"truffle","modal":false}`; the same curl check of `https://truffle-web.ahmed-abied.workers.dev/demo` returned HTTP 200 and the judge controls' HTML.
- At approximately **2026-10-08 16:55 UTC**, an in-memory Python driver invoked curl against **exactly one** `/demo/spawn`, then reused that demo for slider, chat, heat, midnight and reset calls; no real owner's pet was used and no credential was retained in this report.
- The simulated 3,000-step Spore received a medium-tier Workers AI reply, spent 60 energy and finished at 2,940; its first two sentences were "I am feeling quite cozy! Those steps you took gave me a nice little boost of warmth." This is a synthetic probe, not Ahmed's experience.
- Forced heat followed by midnight preserved energy at 2,940 and `zero_days` at 0; a reset followed by four unprotected midnights produced `dead:true`. The response's real weather was 34.3C apparent with a 41.9C daytime maximum, so the heat demonstration was explicitly forced.
- A `node` heredoc loaded local TypeScript, transpiled `worker/src/config.ts` and `worker/src/engine.ts` entirely in memory, and checked every expected field and input immutability in `tests/golden/energy_cases.json`: **32/32 cases matched**. An additional protected zero-step check reduced affection from 3 to 2 while leaving the death counter unchanged. This was not a rerun of the entire Worker suite and wrote no test artifacts.
- No phone walk, real Health Connect count, full browser interaction, trained-model quality or longitudinal behavior change was independently verified. Only this result file was written.
