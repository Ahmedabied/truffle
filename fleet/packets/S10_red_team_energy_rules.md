# S10 red_team_energy_rules
Owner: astra        Wave: A        Due: Thu 2026-10-08 10:00 Oman

## Goal
Find exploits in the energy rules (docs/01) and the golden cases.

## Inputs
Read first: docs/01_product_spec.md, docs/02_architecture.md, docs/04_research_facts.md (relevant section). Repo: ~/Desktop/Truffle.

## Deliverable
RESULT.md: a ranked list of holes (feed spam, clock and timezone games, demo slider abuse, overflow games, death dodging, burrow spoofing via fake coordinates) each with a proposed rule or code fix and, where needed, a new golden case.

## Acceptance
Each hole has a concrete reproduction. Fixes stay in the spirit of the spec (never shame, heat days protected).

## Do not
Do not change the spec or goldens yourself.

## Report
fleet/outbox/S10/RESULT.md: what was done, evidence (commands + output pasted), open questions, cost if any. No secrets anywhere.
