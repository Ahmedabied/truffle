# C07: Open innovation and craft

## Outcome

**Overall: 6.8/10 on the current evidence.** The deterministic engine is substantially more trustworthy than the README's claims about the brain, privacy and completed product. Top cut: the claim that this mechanic is impossible on a closed API, alongside present-tense claims about an undeployed fine-tune. Top addition: a reproducible deployed-model evidence table with a real, controlled base-versus-tuned evaluation.

Reviewed revision: `8b630e8`, on 2026-10-08. This is a current-repository assessment, not a score for an unpublished final post. The overall score is my judgment, not an official weighted calculation.

## Official criteria, quoted

Source: https://dev.to/challenges/hacktoberfest-week1-2026-10-05, fetched with WebFetch on 2026-10-08. These are the page's exact criterion labels:

> Writing Quality (weighted most heavily)
>
> Relevance to the Prompt and Theme
>
> Creativity
>
> Technical Execution
>
> Use of Partner Technology (optional)

The page also says: "Build something with open-source AI at its core." Its theme instruction is: "Build something with open-weight models or open-source AI that gets people off the screen and into the world."

No numerical weights were supplied in the retrieved criteria section. A separate direct Python HTTP fetch received 403; WebFetch successfully retrieved the criteria. Its content was truncated before the Gemma category, so this report does not invent category-specific eligibility rules.

| Criterion | Score | Judgment |
|---|---:|---|
| Writing Quality (weighted most heavily) | 5.5/10 | The premise is memorable, but the README presents planned capabilities as facts and sends readers into internal build logistics instead of a short, evidenced product story. |
| Relevance to the Prompt and Theme | 8/10 | Steps materially gate the AI and the Oman heat exception fits the theme thoughtfully, but actual Samsung-to-pet use and a real outdoor diary remain unverified. |
| Creativity | 9/10 | Desert-truffle lore, metabolism, heat protection and the dithered world form one coherent idea rather than decorative AI attached to a step counter. |
| Technical Execution | 7.5/10 | A readable pure engine and 291 passing Worker tests provide strong craft evidence, but weather-failure safety, the optional feed day and training/runtime contract drift remain unresolved. |
| Use of Partner Technology (optional) | 6/10 | Gemma genuinely powers the live fallback and effort routing, but the advertised 31B adapter and its measured benefit have not been demonstrated. |

## Would I trust the energy rules?

**Yes for the pure engine; not yet for every end-to-end guarantee.** `worker/src/engine.ts` is 284 lines with explicit inputs, centralized constants, immutable transitions and a clear separation between tier admission and charging. The golden runner executes the real functions and checks that each input remains unchanged. Its 32 cases cover absolute totals, repeat/lower feeds, tier boundaries, growth, heat protection, affection, death and restart. Additional DO tests cover stale replies, generation fencing and charging failures, which is much stronger evidence than a happy-path screenshot.

The limits matter:

- `worker/src/do.ts:179-182` treats an uncached catch-up forecast as unprotected; `docs/02_architecture.md:102` promises yesterday's protection, while `worker/README.md:193` documents the actual missing-forecast behavior. Passing goldens do not resolve this safety policy conflict.
- Decision 0013 and `worker/test/b09-units.test.ts` correctly permit high energy with an admitted low tier, but `finetune/data/schema.md:67` and `finetune/filter.py:307-311` require the maximum energy tier. I reproduced rejection of a legal `energy=70%, tier=low` state. The training corpus cannot represent that runtime case under the current validator.
- Golden case `06_high_tier_costs_200` actually expects medium and a 60-point charge; case `11_energy_below_cost_drops_a_tier` does not exercise a tier drop. The assertions are useful, but their names oversell what they cover. The JSON constants block is not directly asserted against `worker/src/config.ts`.
- The 1,800-row report establishes filter acceptance and a reproducible 1,720/80 split, not natural Arabic, safe generated behavior or model improvement. The older S09 baseline reports one dangerous heat response; it is valuable negative evidence, not a measurement of today's hardened production prompt.

## Fleet: strength or noise?

Both. The strongest story is a traceable chain: S10/S11 finding, decision 0012 or 0013, B09 fix, executable regression test. Keep those decisions, the original baseline failures and dataset provenance public. Do not delete uncomfortable findings to make the project look finished.

The navigation is currently upside down: `fleet/` accounts for **457 of 617 tracked files**, including **267 files in the superseded A01/A02 reference packs**. Archive obsolete previews and scratch scaffolding outside the default checkout, with a stable archive link. Keep `fleet/outbox/D01` through `D18` source shards accessible because the documented filter command depends on them. Keep `decisions/` as first-class engineering evidence. Keep the three `sessions/` summaries as optional provenance, not the judge's starting point. Curate and redact one agent-session excerpt rather than publishing raw sessions by default.

## Five cuts, ranked by impact

1. `README.md:5,11-14`; post "Why Does Open Innovation Matter": cut "impossible on a closed API" and present-tense 31B/LoRA claims until deployed, since code-based gating is provider-independent and some proprietary APIs also support fine-tuning or effort controls.
2. `README.md:15`; `docs/06_writeup_plan.md:20`: cut the blanket claim that steps and location never leave infrastructure you control, since Open-Meteo receives coordinates and Cloudflare/Modal are third-party processors.
3. `fleet/outbox/A01/`, `fleet/outbox/A02/`, obsolete `fleet/outbox/*/scratch/`: remove superseded preview packs and duplicate scaffolding from the normal checkout while preserving a linked archive, source shards and failure evidence.
4. `STATE.md`; `docs/01_product_spec.md`; `docs/02_architecture.md`: remove stale competing current-state claims about test totals, feeder SDK, weather fallback and phrase-only ownership, separating historical plans from the authoritative shipped contract.
5. `README.md:38`; post "How I Built It" and "My Agent Session": cut fleet rosters, quota scheduling and account-setup narrative from the judge's main path, replacing self-congratulation about agent volume with one finding-to-test-to-fix story.

## Five additions, ranked by impact

1. `README.md`; `finetune/eval/RESULTS.md`; post "How I Built It": add a dated deployed-model table with source revision, model and adapter hashes, actual fallback status, Gemma licensing, and real same-model base/tuned results with raw replies; mark unavailable cells "not run".
2. New weather-policy record in `decisions/`; `worker/src/do.ts`; `worker/test/do.test.ts`: add an explicit protected-unknown-weather policy and outage/catch-up regression tests, then require the feed day with an offline-retry test before claiming complete heat and replay protection.
3. New `.github/workflows/ci.yml`; `README.md`; `tests/README.md`: add a clean-checkout Node 22 test path using locked dependencies, Worker/web tests and typechecks plus filter validation, linking the green run and the 32 golden cases directly from the README.
4. `finetune/data/schema.md`; `finetune/filter.py`; `finetune/eval/prompts.jsonl`: add engine-derived contract fixtures for requested lower tiers and rounded energy boundaries, plus explicit GPT-generated data provenance and held-out Arabic/heat review rather than treating zero drops as semantic validation.
5. `docs/06_writeup_plan.md`, post "Demo" and "The diary": add a short real Samsung Health-to-feed-to-energy recording and dated outdoor diary with actual steps, apparent temperature and verbatim replies, clearly separating real observations from slider simulation.

## Three claims a sceptical judge will doubt

### 1. "Its brain is Gemma 4 31B, fine-tuned to be Truffle."

**Why doubt it:** `STATE.md` says training and Modal serving have not started; the live `/health` returned `{"ok":true,"service":"truffle","modal":false}`. The repository has an evaluation template and fixed prompts, not a completed real tuned evaluation.

**Evidence that closes it:** Publish the serving revision, model identifier, adapter checksum and one redacted response identifying the actual serving path. Compare untuned 31B against tuned 31B on the fixed 90 prompts with matched inference settings, raw outputs and blinded Arabic review. Report the 26B fallback separately, since comparing 26B base against 31B tuned confounds model size with tuning. Until then, say "live untuned Gemma fallback; adapter experiment pending." The valid open-weight argument is control over adapters, redistribution subject to Gemma terms and hosting portability, not exclusive ownership of step-based gating.

### 2. "The rules cannot be talked out of, and heat days cannot kill the pet."

**Why doubt it:** The model cannot mutate the pure engine, but upstream weather classification and feed admission determine its inputs; missing forecasts and undated retries remain outside the strongest guarantee. A trained reply can also recommend unsafe behavior even when engine counters are protected.

**Evidence that closes it:** Keep the passing golden and DO suites, add a regression starting at three zero days with a known hot day followed by missing forecast and missed alarms, and prove that protection survives catch-up. Add a previous-day feed replay with mandatory date rejection and no state mutation. Show the admitted tier in the prompt, provider options and actual charge for one high-energy/low-request example. Test heat language separately against the actual serving prompt and model; deterministic counters do not prove safe prose.

### 3. "Your steps and your location never leave infrastructure we control."

**Why doubt it:** `worker/src/weather.ts:11-14` constructs an Open-Meteo request containing coordinates, and inference is processed by external cloud providers. The README wording suggests a privacy boundary the implementation does not have.

**Evidence that closes it:** Replace the absolute with a small data-flow and retention table: coarse coordinates to Open-Meteo, step-derived state and selected memories to the brain provider, bounded state in Cloudflare, and no stored location trail. Include a redacted representative outbound request and identify which model path is currently active. Keep the MIT code license distinct from Gemma's open-weight terms and avoid implying on-device inference.

## Verification performed

- Read all packet inputs in full, all 14 decision records, the relevant test runners, data validator, Worker documentation and selected fleet/session evidence.
- Fetched `/health` and the `/demo` HTML with `curl -sS --max-time 25 -i`; both returned HTTP 200. No browser interaction, no model calls and **zero demo spawns** were performed, so this is not a visual or handset acceptance test.
- Ran the complete Worker suite: **14 files, 291 tests passed**, including all 32 golden cases; Worker TypeScript checking also passed.
- To avoid bundled-config/cache output, used the following command from `/home/abied/Desktop/Truffle/worker`:

```sh
node --input-type=module -e 'globalThis.__dirname = process.cwd(); process.argv = [process.argv[0], "./node_modules/vitest/vitest.mjs", "run", "--configLoader", "runner", "--no-cache"]; await import("./node_modules/vitest/vitest.mjs");'
./node_modules/.bin/tsc --noEmit --incremental false
```

- The initial unshimmed `--configLoader runner` invocation failed because the existing config uses `__dirname`; the in-memory shim above ran the unchanged config successfully.
- `python3 -I -B finetune/filter.py --selftest`: **59 passed, 0 failed**; its pipeline checks use temporary fixtures.
- `python3 -I -B finetune/filter.py --glob '/home/abied/Desktop/Truffle/fleet/outbox/D[01][0-9]/shard.jsonl' --dry`: reproduced **1,800 accepted, 1,720 train, 80 hold-out, zero drops** without regenerating repository artifacts.
- Independently called `filter.state_problem` on the legal lower-tier runtime state; it returned `tier=low does not fit energy=70%`.
- No source, documentation, dataset or configuration changes were made; this report is the only repository file written by C07.
