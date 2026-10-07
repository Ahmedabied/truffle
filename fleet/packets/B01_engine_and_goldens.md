# B01 engine_and_goldens
Owner: opus        Wave: Wed night        Due: Thu 2026-10-08 12:00 Oman

## Goal
Implement the energy engine as pure functions and make all 30 golden cases pass.

## Inputs
Read first: docs/01_product_spec.md, docs/02_architecture.md, docs/04_research_facts.md (relevant section). Repo: ~/Desktop/Truffle.

## Deliverable
worker/src/engine.ts, worker/src/config.ts (constants), worker/test/golden.test.ts (Vitest runner reading tests/golden/energy_cases.json).

## Acceptance
npm test green with all 30 cases. No I/O or Date.now inside the engine. State block string matches case 30 exactly.

## Do not
Do not touch routes or the DO.

## Report
fleet/outbox/B01/RESULT.md: what was done, evidence (commands + output pasted), open questions, cost if any. No secrets anywhere.
