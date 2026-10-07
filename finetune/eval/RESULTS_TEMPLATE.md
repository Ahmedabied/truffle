# Truffle eval: base vs tuned

{{DRY_NOTE}}Run `{{RUN}}`, {{DATE}}. {{N}} prompts, identical state blocks for both models.

- Base: `{{BASE_MODEL}}` (persona in the system prompt only)
- Tuned: `{{TUNED_MODEL}}` (same base + Truffle LoRA)
- Judge: `{{JUDGE_MODEL}}` with a fixed rubric that returns JSON (see `run_eval.py`)
- Sampling: temperature 1.0, top_p 0.95. Max tokens by tier: low 120, medium 400, high 1,200. Thinking on for high tier only.

## Results

{{TABLE}}

{{CHART}}

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
{{GRID}}

## Human checks (fill in by hand)

- Arabic naturalness, blind, 10 pairs scored 1 to 5: `{{OUT_DIR}}/human_review_ar.md` (key in `human_key.json`). Base mean: _ . Tuned mean: _ .
- In-character spot check, 20 replies: agree with judge on _ of 20.

Raw outputs: `{{OUT_DIR}}/base.jsonl`, `{{OUT_DIR}}/tuned.jsonl`. All prompts are reported. No cherry-picking.
