# S03 workers_ai_gemma4_fallback
Owner: astra        Wave: A        Due: Thu 2026-10-08 10:00 Oman

## Goal
Characterise @cf/google/gemma-4-26b-a4b-it on Workers AI as the fallback brain and fact extractor.

## Inputs
Read first: docs/01_product_spec.md, docs/02_architecture.md, docs/04_research_facts.md (relevant section). Repo: ~/Desktop/Truffle.

## Deliverable
Worker snippet(s) in fleet/outbox/S03/: streaming chat with system prompt, thinking toggle behaviour (does chat_template_kwargs or an equivalent work? default on or off?), JSON-schema structured output for {facts: string[]}. RESULT.md with observed response shapes pasted.

## Acceptance
Observed, not assumed. Note neuron cost per call from the response or docs.

## Do not
Do not use any other model.

## Report
fleet/outbox/S03/RESULT.md: what was done, evidence (commands + output pasted), open questions, cost if any. No secrets anywhere.
