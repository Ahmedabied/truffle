# C06: Best Use of Gemma judge review

**Overall: 6/10 today.** The energy engine and Gemma fallback are real; the claimed trained personality and live 31B brain swap are not yet demonstrated. The best improvement is an auditable adapter release with a controlled base-versus-tuned evaluation, not more features.

Reviewed 2026-10-08, with the live API probe at about 20:55 Oman. This is a provisional assessment of available evidence, not credit for work promised before Monday. The overall score is my holistic judgment, not an official DEV formula.

## Actual judging criteria

Source: https://dev.to/challenges/hacktoberfest-week1-2026-10-05, fetched successfully as full HTML on 2026-10-08 and parsed for visible text. The initial WebFetch view truncated before Gemma; the full-page fetch supplied the category text below.

The page lists these exact criteria:

> Writing Quality (weighted most heavily)
>
> Relevance to the Prompt and Theme
>
> Creativity
>
> Technical Execution
>
> Use of Partner Technology (optional)

Under **Best Use of Gemma**, it says:

> Use Gemma, Google's open-weight model, in building your project: run it locally, fine-tune it, or serve it through Google Cloud or another provider.

The prompt also says:

> Build something with open-source AI at its core.

> Tell us where your open-based approach worked better than a closed one.

> Build something with open-weight models or open-source AI that gets people off the screen and into the world.

> Bonus points if you take it outside, use it, and tell us how it went.

**Important distinction:** the Gemma category permits provider serving and does not require local inference, a fine-tune, Gemma 4 specifically, or proof that a closed API could never reproduce the application. Those are differentiation questions, not additional eligibility rules. The live Workers AI integration fits the category's stated technology route, but does not by itself establish award-winning use.

## Scores against those criteria

| Criterion, quoted exactly | Score | Reason |
|---|---:|---|
| Writing Quality (weighted most heavily) | 5/10 | The pet and Oman heat story scan well, but the README presents future fine-tuning as accomplished and its closed-API and privacy absolutes undermine trust before the planned post supplies evidence. |
| Relevance to the Prompt and Theme | 7/10 | Walking literally funds interaction and heat protection fits the theme, but the available proof is a simulated slider rather than Ahmed using the phone feeder on a real walk. |
| Creativity | 9/10 | A desert truffle whose energy controls model effort, memory access and survival is a distinctive mechanical use of an AI companion. |
| Technical Execution | 7/10 | The pure engine, live tier charging and passing Worker tests are substantial, but 31B serving, trained adapter behavior and production failover have not been demonstrated. |
| Use of Partner Technology (optional) | 5/10 | Gemma 4 actually answers and the thinking flag is implemented, but no measured LoRA gain or live two-brain transition yet distinguishes this from a well-built wrapper around a hosted model. |

## Evidence ledger: implemented, observed, still missing

- **Rules are implemented and observable.** `worker/src/engine.ts:155-170` admits and charges the tier without asking the model; `tests/golden/energy_cases.json` covers no-call sleep, upward request clamping, boundaries and protected heat days.
- **The thinking switch is more than a prompt.** `worker/src/brain.ts:204-289` sends `chat_template_kwargs.enable_thinking` to both backends; `fleet/outbox/S03/RESULT.md:136-229` reports real provider trials, including five thinking-off passes and a thinking-on Arabic reply that exhausted its budget without visible text.
- **The public demo does not prove the effective thinking mode.** Its SSE exposes tier, provider and charge, not the backend flag, reasoning usage or retry status; latency alone cannot fill that gap.
- **The dataset is real, not a trained model.** The dry filter reproduced 1,800 accepted rows, 1,720 train and 80 hold-out, with 600 rows per language group; zero filter drops establish neither semantic safety nor improved personality.
- **The trained brain remains pending.** `STATE.md:7,27-32` says training and Modal serving have not started and Ahmed's seed lines are outstanding; `finetune/eval/RESULTS.md` was absent, while `brain-modal/modal_app.py:179-180` explicitly describes its dummy adapter generator as not a trained personality.
- **Routing code is not a completed brain swap.** `worker/test/brain.test.ts` tests Modal success, errors and timeout using mocks; live `/health` returned `{"ok":true,"service":"truffle","modal":false}`, which reports configuration, not an inference health check.

### One-spawn live check

Fetched `/demo` HTML, then made exactly one `POST /demo/spawn` through curl and used that pet for four chats. No browser-rendering or real-phone claim is made. Every chat requested `high`; step totals increased through 1,000, 3,000 and 4,500 without crossing the Spore growth threshold.

| Admitted tier | Energy before | Provider reported by SSE | Half awake | Charged | Energy after | Full HTTP time |
|---|---:|---|---|---:|---:|---:|
| asleep | 0 | none | false | 0 | 0 | 2.254 s |
| low | 1,000 | workers-ai | true | 20 | 980 | 1.523 s |
| medium | 2,980 | workers-ai | true | 60 | 2,920 | 0.941 s |
| high | 4,420 | workers-ai | true | 200 | 4,220 | 9.650 s |

The three active requests used the same text, `Say hello in one short sentence.` Replies were `Hello there!`, `Hi!` and `Hey!`. This demonstrates real admission and charging, not superior high-tier reasoning or a matched quality benchmark. Each request inherited earlier chat context. No Modal response occurred.

## Five cuts, ranked by impact

1. **Cut the categorical closed-API impossibility claim** from `README.md:11-14` and post section 6, "Why Does Open Innovation Matter": application-side energy gating, context limits, backend routing and some hosted fine-tuning or effort controls are not exclusive to open weights; defend portable weights and owned adapters instead.
2. **Cut accomplished-tense 31B fine-tune and brain-swap claims until artifacts exist** from `README.md:5,13,22`, `docs/01_product_spec.md:7`, the `docs/02_architecture.md` diagram and post sections 5-6: clearly label the current untuned 26B fallback, implemented router and planned trained 31B service.
3. **Cut "steps and location never leave infrastructure we control"** from `README.md:15` and post section 6: `worker/src/weather.ts:11-14` sends coordinates to Open-Meteo, while step totals and city/weather context enter prompts processed by external inference providers.
4. **Cut "remembers everything you told it"** from `README.md:5` and the corresponding post explanation: high tier opens the full retained memory window, not unlimited recall, because facts and conversation history are bounded.
5. **Cut the long fleet, GPU shopping and renderer tour from the main narrative** in post section 5 and `docs/06_writeup_plan.md:19`: link implementation detail in an appendix and spend the recovered space on Gemma measurements, one failure and the real walking diary.

## Five additions, ranked by impact

1. **Publish the actual adapter and a controlled improvement table** in `finetune/eval/RESULTS.md`, a model release and post section 5: compare the same 31B checkpoint with and without LoRA on the frozen 90 prompts, include a production-prompt baseline, artifact hashes, complete outputs and blinded Arabic review.
2. **Add a 60-second model-control proof** to `/demo`, `worker/src/brain.ts` telemetry and post "Demo": show energy, admitted tier, requested and effective thinking, provider/model, retry, total token ceiling and charge, including asleep, boundary crossings and a high-tier empty-answer retry without exposing private reasoning text.
3. **Add a real two-provider transition recording** to `brain-modal/README.md`, the live demo evidence and post "brain router": capture a trained Modal response, an induced timeout or failure, the marked 26B fallback and recovery, with unchanged app revision, state continuity and one charge per reply.
4. **Add a front-page shipped/proven/planned table and accurate data-flow diagram** to `README.md`, `docs/02_architecture.md` and post section 6: name the active model and adapter revision, distinguish model replacement from adapter portability, disclose external recipients and link short reproduction commands.
5. **Add one documented walk-to-Gemma sequence and an honest heat-day entry** to post "The diary" and `docs/assets/`: connect Samsung Health totals, an accepted feed, the resulting effort tier and an exact bilingual reply, with Ahmed's own account of leaving the screen and no slider masquerading as field use.

## Three claims a sceptical judge will doubt

### 1. "The soul lives in the weights, and the fine-tune made Truffle better."

**Why doubtful:** the README makes this claim while `STATE.md` says training has not begun; 1,800 filtered examples and a training-script dry run are prerequisites, not results. The live prompt still carries explicit persona and safety guidance in `worker/src/prompt.ts:25-34`.

**Evidence that closes it:** release a non-dummy adapter with checksum, base-model revision, training configuration, data/split hashes and actual run metadata; show a reproducible same-31B base-versus-LoRA comparison with matched quantization, prompt bytes, decoding and serving conditions. Add the base model with the current production persona prompt as a control so prompt improvements cannot be credited to weights. Report character, state leakage, heat safety, completed/useful answers and blinded Arabic naturalness, with denominators and failures.

Use the frozen 90-prompt set as the main independent check and disclose the 80-row training-distribution hold-out separately. S09's 18/20 state leaks and 3/4 heat-safe replies motivate the work, but its untuned 26B model, shorter prompt and thinking-off high tier are not the correct causal baseline for a tuned 31B gain. Before calling the evaluation production-parity, reconcile `finetune/eval/run_eval.py:174-177`, which sends 1,200 high-tier tokens, with the runtime's 2,224 total-token request and retry policy.

### 2. "Walking actually switches Gemma's thinking, not just its reply length."

**Why doubtful:** the engine and nested flag are convincing implementation evidence, but a "thinking on" UI label can survive an empty-answer retry with thinking disabled, and the public SSE does not reveal that distinction. The live high reply taking longer proves neither reasoning quality nor the effective backend setting.

**Evidence that closes it:** publish a compact trace linking one energy snapshot to `decideTier`, the exact provider request, response metadata and final charge; include low/medium false, high true, asleep no call and a controlled retry. Show available reasoning-presence or token metadata and finish reasons, not a reasoning transcript. State that high requests 1,200 plus 1,024 shared output-budget tokens, not a guaranteed 1,200-token visible answer, and that an empty Workers AI answer can retry with thinking off at the same 2,224 ceiling. The 20/60/200 deductions are game points, not measured GPU energy or token billing. Preserve the valuable narrower claim: Gemma offers a real configurable mechanism the application connects to walking.

### 3. "We swapped brains without changing the app, and kept Truffle intact."

**Why doubtful:** the healthy-Modal and failure tests use mocks, the observed deployment has no Modal URL configured, and a 31B LoRA is not an adapter that can simply be loaded into the architecturally different 26B fallback.

**Evidence that closes it:** record a successful trained Modal request with model and adapter revision, deliberately trigger a bounded failure, show the fallback marker and identical energy/memory state rules, then recover to Modal under the same application revision. Link sanitized provider logs and request IDs, including latency and exactly-once charging. Describe this as two-model routing through a common contract, not identical personalities or portable adapters. If claiming the same trained weights can move between hosts, separately serve that same hashed 31B artifact on another compatible host; the 26B fallback does not establish that stronger claim.

## Verification and scope

Read every packet input in full, including all 14 decision records, and inspected the router, prompt builder, Modal spike, S03/S09 evidence and eval code to separate plans from measurements. No implementation or documentation file was edited.

Commands run from `/home/abied/Desktop/Truffle` unless noted:

- `curl -fsS --max-time 25 https://truffle.ahmed-abied.workers.dev/health`: `modal:false`.
- `curl -fsS --max-time 25 https://truffle-web.ahmed-abied.workers.dev/demo`: live HTML returned; the one-spawn curl probe is summarized above and credentials are intentionally omitted.
- `python3 -B -I finetune/filter.py --selftest`: 59 passed, 0 failed.
- `python3 -B -I finetune/filter.py --glob 'fleet/outbox/D[01][0-9]/shard.jsonl' --dry`: reproduced the checked-in report without regenerating dataset files.
- In `worker/`, `./node_modules/.bin/tsc --noEmit`: passed.
- In `worker/`, the no-cache test command below: 14 test files and 291 tests passed.

```sh
CI=1 node --input-type=module -e 'globalThis.__dirname=process.cwd(); process.argv=[process.execPath,"vitest","run","--no-cache","--configLoader","runner"]; await import("./node_modules/vitest/dist/cli.js");'
```

The initial runner-loader test attempt encountered the existing config's `__dirname` assumption; the process-only directory shim avoided editing the config or generating a bundled config file. These tests validate application behavior with mocked model calls, not a real trained model or deployed Modal service. The only authored file for C06 is `fleet/outbox/C06/RESULT.md`.
