# S04 open_meteo_burrow
Owner: astra        Wave: A        Due: Thu 2026-10-08 10:00 Oman

## Goal
Exact Open-Meteo request for our fields and a sanity check of the 42C apparent burrow threshold.

## Inputs
Read first: docs/01_product_spec.md, docs/02_architecture.md, docs/04_research_facts.md (relevant section). Repo: ~/Desktop/Truffle.

## Deliverable
A TypeScript parser function (pure) returning {daytimeMaxApparentC, currentApparentC, precipitationNow, windNow, isDay}, plus RESULT.md with today's values for Muscat, Riyadh, Phoenix, Berlin, Kuala Lumpur and whether each would burrow.

## Acceptance
Daytime window 06:00-22:00 local using timezone=auto. Function has 3+ unit tests with recorded fixtures.

## Do not
Do not add caching logic (the DO does that).

## Report
fleet/outbox/S04/RESULT.md: what was done, evidence (commands + output pasted), open questions, cost if any. No secrets anywhere.
