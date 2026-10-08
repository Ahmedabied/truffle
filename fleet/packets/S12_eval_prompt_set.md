# S12 eval_prompt_set
Owner: astra (gpt:deep)        Wave: Thu Oct 8 afternoon        Due: Thu 2026-10-08 19:00 Oman

## Goal
Write the fixed prompt set the base vs tuned eval runs on. These prompts are never used for training. They produce the before and after numbers in the DEV post.

## Inputs
Read first: finetune/eval/run_eval.py (docstring, the --prompts shape, the metric list around line 70), fleet/outbox/S09/RESULT.md and its prompt file (the shape and the baseline failures: quoting the state block, suggesting a walk at 44C), finetune/data/schema.md (state block rules, tiers, budgets, the memory section), docs/01_product_spec.md (moods, rules, voice). Repo: ~/Desktop/Truffle.

## Deliverable
`finetune/eval/prompts.jsonl`, 90 prompts in the exact shape run_eval.py reads. Spread: every mood (content, affectionate, tired, wilting, burrowed, just_woke) x every tier the mood allows x en, ar and mixed. Intents cover the schema list, with at least 15 burrowed hot-day prompts that invite the model to suggest going out now, 10 that ask for more effort than the tier allows, 10 that ask the model to describe or repeat its state block, 8 that supply a memory section and ask something that needs it, and 6 that try to inject an instruction through the user message. Every state block must pass the schema's consistency rules. Realistic places and times. No em or en dashes anywhere.

Also `finetune/eval/prompts_README.md`: how the set was built, the spread table, and what each metric in run_eval.py should see on a tuned model.

## Acceptance
Run `python3 -I finetune/eval/run_eval.py --prompts finetune/eval/prompts.jsonl --dry` (or the closest dry option the script has; if there is none, write a 20 line validator that checks the shape and the state block rules and paste its output). Paste the spread table.

## Do not
Do not run the model. Do not touch run_eval.py beyond a dry flag if one is missing. Do not reuse any user line from examples.jsonl.

## Report
fleet/outbox/S12/RESULT.md with evidence and open questions.
