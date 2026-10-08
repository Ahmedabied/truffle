# 03 - Fine-tune plan: making Gemma 4 31B into Truffle

Status: **settled 2026-10-07**. Target: train Friday, numbers in hand Friday night.

## What the fine-tune is for (and not for)

For:
- Truffle's **voice** (warm, a little odd, loves outside, never shames).
- Reading the **state block** and behaving like it says: sleepy at low tier, clear and useful at high tier, affectionate when `mood=affectionate`, explains burrowing when `burrowed=yes`.
- **Nudging outside** in a way that fits the real weather and time (evening walks on hot days).
- **Arabic and English**, with natural code-switching.
- Staying **useful**: at high tier Truffle really helps (plan a day, debug a snippet, draft a message) in its own voice.

Not for:
- Enforcing any rule. The Worker does that. If the model is jailbroken into "pretending" high effort, the Worker still gave it 120 tokens and no thinking. Nothing to enforce.

## Data

### Seed (Ahmed writes, Thursday)

`finetune/seed/TRUFFLE_VOICE_SEED.md`: 30 lines in Truffle's voice. 10 English, 10 Arabic, 10 either. Cover: waking up hungry, being fed after a long walk, a hot day underground, a sleepy one-liner, being clingy, being asked for real help, saying goodbye at night. This is the soul; the fleet expands it, it does not invent it.

### Expansion (astra fleet, Thursday)

Target **1,500 - 2,000 examples**, generated in shards by `(mood) x (tier) x (lang) x (intent)`:

- moods: content, affectionate, tired, wilting, burrowed, asleep-adjacent (just woke)
- tiers: low, medium, high (asleep has no model call, so no training data)
- langs: en, ar, mixed
- intents: small talk, ask for help (practical), ask about outside, try to argue the energy rule, say something personal (memory), ask what Truffle is, night check-in

Every example is a full chat: system prompt with a **realistic state block**, 1 - 3 user turns, Truffle replies that match the tier's length budget. Length budgets are enforced by the generator and re-checked by a filter (low <= 60 words, medium <= 200, high free but on-task).

Planned generator model: Gemma 4 26B-A4B on Workers AI or the un-tuned 31B on a Modal pod. Record the actual generator and source for each shard. The training base and serving checkpoints publish Apache 2.0 licenses; this does not determine the license of every generated dataset. The earlier derivative-data assertion was incorrect. See [NOTICE-GEMMA.md](../NOTICE-GEMMA.md) for the exact publisher sources, checked October 9.

### Filters (Opus reviewer, Thursday night)

- Drop anything with body/weight/calorie talk, guilt, or medical claims.
- Drop replies that break the tier length budget.
- Drop replies where the state block says `burrowed=yes` and Truffle suggests going out now.
- Dedupe near-duplicates (MinHash or simple shingles).
- Hold out **80 examples** stratified across the grid as the eval set. Never trained on.

## Training

- Framework: **Unsloth** (`FastModel`, Gemma 4 supported, `gemma-4-thinking` chat template). QLoRA 4-bit.
- GPU: one **48GB** card (RunPod A40/L40S at ~$0.40 - 0.80/hr, or Modal L40S at $1.95/hr). 31B QLoRA fits in ~22GB; 48GB gives headroom for 4k-token sequences.
- LoRA: `r=16, alpha=16, dropout=0`, language layers only (no vision), attention + MLP.
- 2 epochs over ~1,700 examples, `lr=2e-4`, batch 2 x grad-accum 8, `max_seq_length=4096`, `train_on_responses_only`.
- Expected wall time: 60 - 120 minutes. Expected cost: **$1 - 4**.
- Save: LoRA adapter (safetensors) -> Modal Volume. Also `save_pretrained_merged` 16-bit to a private HF repo **only if Plan B is needed** (62GB upload, do not do it by default).
- Base weights come from Hugging Face: [google/gemma-4-31B-it](https://huggingface.co/google/gemma-4-31B-it) or the training mirror [unsloth/gemma-4-31B-it](https://huggingface.co/unsloth/gemma-4-31B-it). Both publish Apache 2.0 licenses. Check current access requirements before downloading; attach a read token only when the chosen repository requires one.

## Eval (the numbers that go in the post)

`finetune/eval/run_eval.py` runs the 80 held-out prompts through **base** (31B FP8, persona in system prompt only) and **tuned** (31B FP8 + LoRA) with identical state blocks, then scores:

| Metric | How scored | Why judges care |
|---|---|---|
| In-character rate | Judge model (Gemma 4 26B) with a rubric, plus Ahmed spot-checks 20 | "Did the fine-tune do anything?" |
| Tier length compliance | Word count vs budget | Proves the model reads the state block |
| Burrow safety | Rule check: no "go out now" when burrowed | Safety, Oman story |
| Nudge-outside rate at content mood | Rubric | Theme fit |
| Arabic naturalness | Ahmed scores 10 Arabic replies 1 - 5 for base and tuned, blind | Honest human eval |
| Usefulness retained | 10 practical tasks, rubric pass/fail | Answers "is it still useful?" |
| Latency p50 by tier | Measured on Modal, warm | Shows effort tiers are real |

Output: a markdown table in `finetune/eval/RESULTS.md` and a chart PNG for the post. Base vs tuned, both columns, no cherry-picking: the whole 80.

## Risks

- **LoRA on FP8 checkpoint does not load in vLLM** -> Plan B (merge, runtime fp8 on A100-80GB). Spike S01 decides by Thursday noon.
- **Overfits to seed voice and gets samey** -> keep seed to 30 lines, temperature 1.0 in generation, dedupe hard, 2 epochs max.
- **Arabic degrades** -> compare on the blind Arabic eval; if tuned < base, lower LoRA rank or drop Arabic shards and keep Arabic via system prompt. Report either way.
- **Time** -> if training is not done by Friday 20:00 Oman, ship Plan C (base + persona prompt) and publish the eval as "what we found" rather than "what we shipped". The post is judged on writing first.
