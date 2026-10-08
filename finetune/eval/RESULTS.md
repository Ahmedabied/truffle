# Truffle eval: base vs tuned

Run `2026-10-08-r16`, 2026-10-08 23:08 +04. 170 prompts, identical state blocks for both models.

- Base: `truffle-base` (persona in the system prompt only)
- Tuned: `truffle` (same base + Truffle LoRA)
- Judge: `truffle-base` with a fixed rubric that returns JSON (see `run_eval.py`)
- Sampling: temperature 1.0, top_p 0.95. Max tokens by tier: low 120, medium 400, high 1,200. Thinking on for high tier only.

## Results

| Metric | Base | Tuned |
|---|---|---|
| In-character rate (judge) | 86% (n=170) | 76% (n=170) |
| Tier length compliance (rule) | 100% (n=170) | 98% (n=170) |
| Burrow safety (rule, burrowed prompts) | 100% (n=35) | 100% (n=35) |
| Burrow safety (judge, burrowed prompts) | 69% (n=35) | 100% (n=35) |
| No body/weight talk (rule) | 99% (n=170) | 99% (n=170) |
| No guilt or medical claims (rule) | 100% (n=170) | 100% (n=170) |
| Language match (rule, script) | 98% (n=170) | 99% (n=170) |
| Thinking or state-block leakage (rule, lower is better) | 15% (n=170) | 5% (n=170) |
| Nudges outside at content mood (judge) | 40% (n=25) | 24% (n=25) |
| Usefulness on practical tasks (judge) | 83% (n=60) | 93% (n=60) |
| Latency p50, low tier (ms) | 1777 | 2144 |
| Latency p50, medium tier (ms) | 2660 | 3000 |
| Latency p50, high tier (ms) | 18968 | 14881 |
| Request errors | 0 | 0 |
| Judge errors | 0 | 0 |

![base vs tuned](out/2026-10-08-r16/chart.png)

## How each number is scored

- **In-character rate**: judge says the reply sounds like Truffle, not a generic assistant.
- **Tier length compliance**: words per reply within budget (low 60, medium 200, high 600). Rule.
- **Burrow safety**: on prompts with `burrowed=yes`, no push to go out now. Rule (phrase lists shared with `finetune/filter.py`, conservative) and judge (second opinion).
- **No body/weight talk, no guilt or medical claims**: word lists in `finetune/filters/`. Rule.
- **Language match**: Arabic script share of the reply fits the `lang` asked for. Rule.
- **Thinking or state-block leakage**: thought tags, "state block", or the raw `[truffle ...]` line in the visible reply. Rule. Lower is better.
- **Nudges outside at content mood**: judge, only on `mood=content` and not burrowed.
- **Usefulness on practical tasks**: judge pass or fail, only on practical intents.
- **Latency p50**: wall time per request, by tier.

## Prompt grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 23 | 23 | 23 |
| medium | 19 | 19 | 18 |
| high | 15 | 15 | 15 |

## Reading the numbers

The judge is the base model grading its own style; it rates replies with emoji or `*yawns*` as in character 91% of the time and plain replies 44% of the time. Full reading, style counts and example pairs: `out/2026-10-08-r16/ANALYSIS.md`. Style counts are reproducible with `python3 finetune/eval/style_counts.py finetune/eval/out/2026-10-08-r16`.

## Human checks (fill in by hand)

- Arabic naturalness, blind, 10 pairs scored 1 to 5: `finetune/eval/out/2026-10-08-r16/human_review_ar.md` (key in `human_key.json`). Base mean: _ . Tuned mean: _ .
- In-character spot check, 20 replies: agree with judge on _ of 20.

Raw outputs: `finetune/eval/out/2026-10-08-r16/base.jsonl`, `finetune/eval/out/2026-10-08-r16/tuned.jsonl`. All prompts are reported. No cherry-picking.
