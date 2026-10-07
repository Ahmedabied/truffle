# B05 finetune_pipeline
Owner: opus        Wave: Thu        Due: Fri 2026-10-09 12:00 Oman

## Goal
Data filters, Unsloth train script, eval harness and results table per docs/03.

## Inputs
Read first: docs/01_product_spec.md, docs/02_architecture.md, docs/04_research_facts.md (relevant section). Repo: ~/Desktop/Truffle.

## Deliverable
finetune/filter.py, finetune/train.py, finetune/eval/run_eval.py, finetune/eval/RESULTS.md template.

## Acceptance
Filters run on Wave B shards; train.py dry-runs on 20 examples for syntax; eval harness runs against two OpenAI-compatible endpoints and scores all metrics in docs/03.

## Do not
Do not run the real training (main session does, with tokens and the cost ledger).

## Report
fleet/outbox/B05/RESULT.md: what was done, evidence (commands + output pasted), open questions, cost if any. No secrets anywhere.
