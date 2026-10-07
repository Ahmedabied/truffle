# S01 vllm_lora_fp8_modal
Owner: astra        Wave: A        Due: Thu 2026-10-08 10:00 Oman

## Goal
Prove the serving path: vLLM on Modal L40S with RedHatAI/gemma-4-31B-it-FP8-dynamic plus a dummy rank-16 LoRA adapter, thinking toggle per request.

## Inputs
Read first: docs/01_product_spec.md, docs/02_architecture.md, docs/04_research_facts.md (relevant section). Repo: ~/Desktop/Truffle.

## Deliverable
brain-modal/modal_app.py (class-based, Volume for weights, snapshots on, bearer proxy), brain-modal/README.md with run commands, fleet/outbox/S01/RESULT.md with a table: load ok?, cold start with and without snapshot, warm p50 for 120/400/1200 tokens, thinking on/off, pinned vllm/transformers versions.

## Acceptance
Script runs on Modal without edits by the main session. Numbers reported, not estimated. If LoRA on FP8 fails, document the exact error and write the Plan B variant (merged bf16 + --quantization fp8 on A100-80GB).

## Do not
Do not run anything that needs a token yourself; write the script and the exact command. Do not download weights anywhere but a Modal Volume.

## Report
fleet/outbox/S01/RESULT.md: what was done, evidence (commands + output pasted), open questions, cost if any. No secrets anywhere.
