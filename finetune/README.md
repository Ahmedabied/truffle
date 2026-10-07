# finetune

Turns Gemma 4 31B IT into Truffle. Plan and reasons: `docs/03_finetune_plan.md`.

```
finetune/
  seed/TRUFFLE_VOICE_SEED.md   Ahmed's 30 voice lines (the soul; do not edit here)
  data/schema.md               Wave B shard schema, budgets, rules, 3 worked examples
  data/examples.jsonl          the 3 worked examples, one per tier (copy these)
  data/generated/              filter output: train.jsonl, eval_holdout.jsonl, REPORT.md (jsonl gitignored)
  filters/                     word and phrase lists used by the filter and the eval
  filter.py                    validate, filter, dedupe, stratified hold-out (stdlib only)
  train.py                     Unsloth QLoRA SFT (or --no-unsloth: transformers + peft)
  eval/run_eval.py             base vs tuned on two OpenAI-compatible endpoints, rules + judge
  eval/RESULTS_TEMPLATE.md     the results page template
  eval/RESULTS.md              written by a real eval run
  eval/out/<run>/              raw replies, results.json, chart.png, blind Arabic review sheet
```

Never download model weights to the laptop. Training runs on a cloud GPU. Dry runs run on the box (`ssh workstation`).

## 1. Filter the Wave B shards

Shards land in `fleet/outbox/D*/shard.jsonl` (schema: `data/schema.md`).

```
python3 -I finetune/filter.py --selftest     # 51 checks, no files touched
python3 -I finetune/filter.py --dry          # report only
python3 -I finetune/filter.py                # writes data/generated/{train,eval_holdout}.jsonl + REPORT.md
```

It drops, in this order, and counts each reason: bad JSON or schema, wrong turn shape (1 to 3 user turns), changed persona header, unparseable or inconsistent state block, meta that does not match the block, empty replies, thinking or state-block leakage, body/weight/calorie/diet words (`filters/blocklist_en.txt`, `blocklist_ar.txt`), guilt or shaming, medical claims, "go out now" when `burrowed=yes`, em or en dashes, tier length budget (low 60 words, medium 200, high 600), wrong reply language, exact duplicates, near duplicates (word 3-shingle Jaccard 0.8 or more on the assistant text). Then it holds out 80 examples spread evenly over tier x lang (and round-robin over mood x intent inside each cell). Fixed seed 3407, so the split is reproducible.

Options: `--glob` (repeatable), `--holdout 80`, `--jaccard 0.8`, `--seed`, `--out-dir`.

## 2. Train

### Real run: 31B on one 48GB GPU (integrator only)

On a RunPod A40 or L40S (48GB) or Modal L40S. Needs an HF read token in the environment (`HF_TOKEN`, never in git) if you use the gated `google/` repo. The Unsloth mirror is the default.

```
uv venv --python 3.12 .venv && . .venv/bin/activate
uv pip install unsloth                      # pulls a CUDA build of torch that fits the card
python finetune/train.py --render-only 2 --model unsloth/gemma-4-31B-it \
    --train finetune/data/generated/train.jsonl --out /tmp/render   # check template + loss mask first
python finetune/train.py \
    --model unsloth/gemma-4-31B-it \
    --train finetune/data/generated/train.jsonl \
    --eval  finetune/data/generated/eval_holdout.jsonl \
    --out   runs/truffle-r16
```

Defaults match docs/03: 4-bit QLoRA, `max_seq_length 4096`, LoRA `r=16 alpha=16 dropout=0` on attention + MLP of the language layers only, chat template `gemma-4-thinking`, loss on Truffle's replies only (`<|turn>user\n` / `<|turn>model\n` markers), batch 2 x grad accum 8, lr 2e-4 linear, warmup 5 percent, 2 epochs, bf16 when supported, log every 5 steps, checkpoint every 50 steps.

Expected: about 1,700 examples x 2 epochs / 16 per step = about 210 steps, **60 to 120 minutes**, **$1 to $4** (A40/L40S at $0.40 to $0.80/hr on RunPod, or Modal L40S at $1.95/hr). Dry-run the cost before any job over $3 and log it in `fleet/costs.md`.

Output in `--out`: the LoRA adapter (`adapter_model.safetensors`, `adapter_config.json`), the tokenizer with the chat template, and `train_meta.json` (exact hyperparameters, package versions, GPU, wall time, loss history, eval loss, peak memory). Upload the adapter to the Modal Volume. Merging to 16-bit is Plan B only (62GB), not by default.

Flags: `--model --train --eval --out --max-steps --max-seq-length --epochs --lr --batch --grad-accum --r --alpha --chat-template --instruction-part --response-part --thinking-render {off,tier} --no-4bit --no-unsloth --render-only N`.

`--thinking-render off` (default) renders every example with thinking off. Our data has no thought blocks, so this teaches voice in the no-think format and leaves the base model's thinking alone for high tier. `tier` renders high-tier examples with thinking on and an empty thought, which risks teaching the model to skip thinking.

### Dry run (box, tiny ungated model, no token)

```
rsync -a --exclude .venv --exclude runs --exclude data/generated finetune/ workstation:~/truffle-ft/finetune/
ssh workstation
cd ~/truffle-ft && . .venv/bin/activate
python finetune/train.py --model unsloth/gemma-3-270m-it \
    --train finetune/data/examples.jsonl --eval finetune/data/examples.jsonl \
    --max-steps 3 --out ~/truffle-ft/runs/dry
```

This proves the code path (load, LoRA, template, mask, train, eval, save, meta). It does not prove 31B memory fits. Results: `fleet/outbox/B05/RESULT.md`.

## 3. Eval

```
BRAIN_TOKEN=... TUNED_TOKEN=... JUDGE_TOKEN=... python3 -I finetune/eval/run_eval.py \
    --base-url  https://<base-endpoint>/v1  --base-model  <served base name> \
    --tuned-url https://<tuned-endpoint>/v1 --tuned-model <served lora name> \
    --judge-url https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1 \
    --judge-model @cf/google/gemma-4-26b-a4b-it \
    --run final
```

- Input: `data/generated/eval_holdout.jsonl` (80). Add `--prompts fleet/outbox/S09/prompts.jsonl` to include the 20 S09 baseline prompts.
- Every prompt goes to both endpoints with `max_tokens` by tier (120/400/1200) and `chat_template_kwargs.enable_thinking = (tier == "high")`. Tokens come from the environment only.
- Rule metrics (tier length, burrow safety, body talk, guilt/medical, language, thinking leakage) use the same lists as `filter.py`. Rubric metrics (in character, nudges outside at content mood, usefulness on practical tasks, burrow safety second opinion) come from the judge as JSON. Latency p50 by tier.
- Writes `eval/out/<run>/{base,tuned}.jsonl` (raw), `results.json`, `chart.png`, a blind Arabic review sheet (`human_review_ar.md`, key in `human_key.json`), and `eval/RESULTS.md`.
- `--score-only` re-scores saved outputs. `--no-judge` skips the judge. A rerun with the same `--run` skips prompts that already have a reply.
- `--dry-run` uses canned fake endpoints and writes to `eval/out/dry-*` (gitignored). Those numbers are fake.

## Licence

Gemma 4 is provided under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms). The Truffle LoRA, any merged weights, **and any training data generated with a Gemma model** are Model Derivatives. Keep `NOTICE-GEMMA.md` with them and follow the [Prohibited Use Policy](https://ai.google.dev/gemma/prohibited_use_policy).
