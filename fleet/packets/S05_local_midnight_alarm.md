# S05 local_midnight_alarm
Owner: astra        Wave: A        Due: Thu 2026-10-08 10:00 Oman

## Goal
Compute the next local midnight from an IANA timezone in a Worker using Intl only, and design alarm catch-up for missed midnights.

## Inputs
Read first: docs/01_product_spec.md, docs/02_architecture.md, docs/04_research_facts.md (relevant section). Repo: ~/Desktop/Truffle.

## Deliverable
worker/src/time.ts (pure) + Vitest cases for Asia/Muscat and Europe/Berlin across the Oct 25 2026 DST change, and a short catch-up design in RESULT.md.

## Acceptance
Tests pass. Handles tz change by the user (next alarm recomputed). Max catch-up of 14 midnights with cached weather or burrowed=false.

## Do not
Do not pull Luxon or date-fns unless Intl provably cannot do it.

## Report
fleet/outbox/S05/RESULT.md: what was done, evidence (commands + output pasted), open questions, cost if any. No secrets anywhere.
