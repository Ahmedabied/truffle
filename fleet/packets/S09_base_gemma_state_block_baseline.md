# S09 base_gemma_state_block_baseline
Owner: astra        Wave: A        Due: Thu 2026-10-08 10:00 Oman

## Goal
Baseline: does un-tuned Gemma 4 (26B on Workers AI) read our state block and act on it, in English and Arabic?

## Inputs
Read first: docs/01_product_spec.md, docs/02_architecture.md, docs/04_research_facts.md (relevant section). Repo: ~/Desktop/Truffle.

## Deliverable
20 transcripts (10 en, 10 ar) across tiers and moods with the exact state block format from docs/01, in fleet/outbox/S09/, plus a one-paragraph verdict and the obvious failure patterns (these become eval rubric items).

## Acceptance
Same prompts will be reused for the eval, so save them as prompts.jsonl.

## Do not
Do not prompt-engineer the persona beyond a two-line header; we want the baseline.

## Report
fleet/outbox/S09/RESULT.md: what was done, evidence (commands + output pasted), open questions, cost if any. No secrets anywhere.
