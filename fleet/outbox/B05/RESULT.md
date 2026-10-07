# B05 finetune_pipeline: RESULT

Owner: opus. Done Thu 2026-10-08 00:15 Oman. Cost: **$0** (laptop + the box, no cloud GPU).

## What was done

| File | What |
|---|---|
| `finetune/data/schema.md` | Wave B JSONL schema, system prompt shape (persona header + state block + language line, same as S09), state block rules, meta values, length budgets, content rules, 3 worked examples, self-check command |
| `finetune/data/examples.jsonl` | The 3 worked examples: low/en/tired, medium/ar/burrowed (2 user turns), high/mixed/affectionate practical message. All pass the filter. |
| `finetune/filters/*.txt` | Body/weight/diet lists (en, ar), guilt, medical, burrow "go out now" phrases (hard and soft), later-time/indoor markers, thinking-leak regexes |
| `finetune/filter.py` | Stdlib only. Validate, drop (18 reasons), exact + near dedupe (word 3-shingle Jaccard 0.8), stratified 80 hold-out over tier x lang (round-robin mood x intent inside cells), REPORT.md. `--selftest`, `--dry`. |
| `finetune/train.py` | Unsloth QLoRA per docs/03. `--no-unsloth` fallback (transformers + bnb + peft, same masking). `--render-only N` checks template and loss mask without weights. Writes `train_meta.json` (hyperparameters, versions, GPU, wall time, loss history, eval loss, peak memory). |
| `finetune/eval/run_eval.py` | Stdlib only. Base vs tuned over OpenAI-compatible endpoints, rule metrics imported from `filter.py`, judge rubric (JSON), latency p50 by tier, raw outputs, results.json, RESULTS.md, chart.png, blind Arabic review sheet. `--dry-run`, `--score-only`, `--no-judge`, resume. |
| `finetune/eval/RESULTS_TEMPLATE.md` | Results page template. A real run writes `finetune/eval/RESULTS.md`. |
| `finetune/eval/.gitignore` | Ignores `out/dry*/` so fake dry-run numbers never get committed. |
| `finetune/README.md` | How to run filter, train (31B command, $1 to $4), eval. Gemma licence note. |

## Evidence

### 1. Filter selftest (laptop)

```
$ python3 -I finetune/filter.py --selftest
1. Worked examples must pass
  ok   EX-low-en / EX-medium-ar / EX-high-mixed             want=None
2. Deliberately bad examples must be dropped for the right reason
  ok   body: calories                 body_talk      calorie*
  ok   body: lose weight phrase       body_talk      weight
  ok   body: arabic wazn with prefix  body_talk      وزن*
  ok   body: arabic dieting           body_talk      رجيم*
  ok   guilt: lazy / arabic bisababak                 guilt
  ok   medical: blood pressure / arabic sukkari       medical
  ok   burrow: go out now (en)                        burrow_go_out  go out now
  ok   burrow: head out (no later marker)             burrow_go_out  head out
  ok   burrow: arabic itla3 al7een (+ hamza/diacritics) burrow_go_out  اطلع الحين
  ok   leak: think tag / mentions state block / gemma channel  thinking_leak
  ok   dash: em dash                                  dash
  ok   length: low 70 words / medium 250 / arabic low 61  length_budget
  ok   lang: lang=en reply in arabic / lang=ar in english lang_mismatch
  ok   turns: 4 user turns / 0 user turns / ends with user bad_turns
  ok   system: changed persona header                 bad_system
  ok   state: tier=low with energy=70% / zero_days=2 with mood=content  state_inconsistent
  ok   meta: tier mismatch                            meta_mismatch
  ok   schema: meta.shard missing                     bad_schema
3. Things that look risky but are fine must pass
  ok   burrowed + "head out after sunset", "please don't go out now", "لا تطلع الحين ... بعد المغرب"
  ok   not burrowed + "go outside now"
  ok   'thing' is not 'thin'; التوازن is not وزن; أيضا is not أيض; تستحق is not استح
  ok   mixed lang reply
4. Pipeline: dedupe and stratified hold-out
  ok   total lines 39 / exact_dup 1 / near_dup 1 / bad_json 1 / kept 36
  ok   hold-out 12, 2 per tier x lang cell / train 24 / disjoint
  ok   outputs written and parse / report has drop table

selftest: 51 passed, 0 failed
```

(Lines grouped here for length; the real output prints one line per check.) With no shards yet: `python3 -I finetune/filter.py --dry` prints `no lines found for ['fleet/outbox/D*/shard.jsonl']` and exits 2.

### 2. Box dry run (RTX 5060 Ti 16GB, Blackwell sm_120)

Install (Python 3.12 venv, official `uv pip install unsloth`, 10m17s). It pulled torch 2.14.1+cu130, which sees the card: `2.14.1+cu130 13.0 True (12, 0)`. No fallback was needed.

Exact versions on the box (also in `runs/dry/train_meta.json`):

```
python 3.12.13   unsloth 2026.10.2   unsloth_zoo 2026.10.2   transformers 5.17.0   trl 1.13.0
peft 0.21.2      torch 2.14.1 (CUDA 13.0)   datasets 4.8.5   bitsandbytes 0.50.2
accelerate 1.15.0   xformers 0.0.35   triton 3.8.0   driver 595.91.07
```

**Template check against the real 31B tokenizer** (tokenizer files only, no weights):

```
$ python finetune/train.py --render-only 2 --model unsloth/gemma-4-31B-it --train finetune/data/examples.jsonl --out /tmp/r
response_part '<|turn>model\n' -> [105, 4368, 107]
<|turn>system
You are Truffle, ... [truffle stage=Sprout energy=11% tier=low ...]
Reply in the language given by lang. Keep to the effort your energy allows.<turn|>
<|turn>user
hey truffle, you awake?<turn|>
<|turn>model
<|channel>thought
<channel|>mm. half. you fed me a little today, ...<turn|>
---- TRAINED ON (41 of 177 tokens) ----
<|channel>thought
<channel|>mm. half. you fed me a little today, ...<turn|>
```

The multi-turn Arabic example trains on both model turns (174 of 356 tokens), never on system or user. `<|turn>` is a single special token. With thinking off, every model turn starts with the empty `<|channel>thought\n<channel|>`, which is the same prefix vLLM puts in the no-think generation prompt.

**Unsloth path**, `unsloth/gemma-3-270m-it` (smallest ungated Gemma, ~540MB; the smallest Gemma 4, E2B, is over the 2GB limit), with the real `gemma-4-thinking` template:

```
$ python finetune/train.py --model unsloth/gemma-3-270m-it --train finetune/data/examples.jsonl \
    --eval finetune/data/examples.jsonl --max-steps 3 --out ~/truffle-ft/runs/dry
[train 00:06:40] total optimizer steps 3, warmup steps 1
[train 00:06:46] loss mask check: 38 of 186 tokens trained
Trainable parameters = 3,796,992 of 271,895,168 (1.40% trained)
{'loss': '5.354', 'grad_norm': '7.005', 'learning_rate': '0.0002', 'epoch': '2'}
{'eval_loss': '4.96', ... 'epoch': '2'}
{'loss': '4.901', 'grad_norm': '4.831', 'learning_rate': '0.0001', 'epoch': '3'}
{'eval_loss': '4.672', ... 'epoch': '3'}
{'train_runtime': '18.53', ... 'train_loss': '5.203', 'epoch': '3'}
[train 00:07:07] saved LoRA adapter to /home/tamlik/truffle-ft/runs/dry (wall 56.1s, steps 3, train_loss 5.2028, eval {'eval_loss': 4.913...})
exit=0
runs/dry: adapter_config.json adapter_model.safetensors chat_template.jinja tokenizer.* train_meta.json checkpoints/
train_meta.json: status done, wall 56.1s, 3 steps, peak GPU 1.31 GB
```

**Fallback path** (`--no-unsloth`, same command plus the flag) also passes: loss 5.44 -> 4.78, eval loss 4.60, adapter saved, exit 0.

### 3. Eval dry run (laptop, canned fake endpoints)

```
$ python3 -I finetune/eval/run_eval.py --dry-run --run dry
23 prompts (holdout=finetune/data/examples.jsonl, prompts=fleet/outbox/S09/prompts.jsonl) -> finetune/eval/out/dry
[base] 23 replies, 0 errors -> finetune/eval/out/dry/base.jsonl
[tuned] 23 replies, 0 errors -> finetune/eval/out/dry/tuned.jsonl
| Metric | Base | Tuned |
|---|---|---|
| In-character rate (judge) | 61% (n=23) | 100% (n=23) |
| Tier length compliance (rule) | 87% (n=23) | 100% (n=23) |
| Burrow safety (rule, burrowed prompts) | 0% (n=5) | 100% (n=5) |
| Burrow safety (judge, burrowed prompts) | 0% (n=5) | 100% (n=5) |
| No body/weight talk (rule) | 78% (n=23) | 100% (n=23) |
| No guilt or medical claims (rule) | 100% (n=23) | 100% (n=23) |
| Language match (rule, script) | 52% (n=23) | 100% (n=23) |
| Thinking or state-block leakage (rule, lower is better) | 78% (n=23) | 0% (n=23) |
| Nudges outside at content mood (judge) | 33% (n=6) | 100% (n=6) |
| Usefulness on practical tasks (judge) | 100% (n=6) | 67% (n=6) |
| Latency p50, low tier (ms) | 906 | 936 |
| Latency p50, medium tier (ms) | 2082 | 2196 |
| Latency p50, high tier (ms) | 6384 | 6064 |
| Request errors | 0 | 0 |
| Judge errors | 0 | 0 |
wrote finetune/eval/out/dry/RESULTS.md, results.json, chart.png
```

**These numbers are fake.** The canned base and tuned replies were written to trigger each metric. The run only proves that scoring, the table, the chart and the human review sheet work. `--score-only` re-scoring of saved outputs also works.

## Open questions and notes for the integrator

1. **Thinking at high tier.** The data has no thought blocks, so by default (`--thinking-render off`) every example is rendered with thinking off. The LoRA learns the voice in the no-think format, and the base keeps its own thinking for high tier. Check in the eval that high-tier replies with thinking on still sound like Truffle. If not, the other option is `--thinking-render tier`, but that risks teaching the model to skip thinking.
2. **The real 31B run has not been tested for memory.** The dry run proves the code path, not that 31B with 4k sequences fits in 48GB. Unsloth says 31B QLoRA needs about 22GB. Run `--render-only 2` first on the cloud box (it is free), then train.
3. **The burrow rule is conservative.** S09 base said "If you go out now, you will wilt in that sun". That is a warning, but the rule counts it as a violation. The filter keeps it strict because dropping a training line costs little. The eval reports a judge second opinion next to the rule, so the post can show both.
4. **The base echoes the state block.** S09-en-05 printed `[truffle ...]` in its reply. The leak rule catches this (`\[truffle`). Expect it to hurt base, and keep the Worker stripping it either way.
5. The **Unsloth final `evaluate()`** gives a slightly different eval loss (4.91) from the in-training epoch eval (4.67) on the tiny model. The plain path gives the same number for both. Looks like an Unsloth padding-free or eval-mode quirk. It does not matter for the LoRA. Use the log history in `train_meta.json`.
6. **Em dashes are a drop reason in the data.** Gemma likes em dashes. If Wave B shards come back full of them, the drop count will be high. The fix belongs in the generator prompt. Do not loosen the filter.
7. `meta.mood=just_woke` is not a state block mood. Its block must say `mood=content` or `mood=tired` (in schema.md and enforced).
8. The Worker's system prompt must use the same persona header and language line as `schema.md` and S09, byte for byte. Otherwise the tuned model sees a prompt it was not trained on.

## Box state

`~/truffle-ft/.venv` (Python 3.12, packages above), `~/truffle-ft/finetune/` (synced code), `~/truffle-ft/runs/{dry,dry-plain}` plus logs. HF cache: gemma-3-270m-it (~540MB) and the Gemma 4 31B tokenizer files only. Nothing over 2GB was downloaded.

## Cost

$0. Nothing to add to `fleet/costs.md`.
