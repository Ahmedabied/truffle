# B02 worker_routes_do_router
Owner: opus        Wave: Wed night        Due: Thu 2026-10-08 20:00 Oman

## Goal
Routes, TruffleDO with SQLite, midnight alarm, weather fetch, brain router with Workers AI fallback, prompt builder, demo endpoints.

## Inputs
Read first: docs/01_product_spec.md, docs/02_architecture.md, docs/04_research_facts.md (relevant section). Repo: ~/Desktop/Truffle.

## Deliverable
worker/ complete per docs/02, wrangler.jsonc, README with curl examples, tests for pairing, rate limit, fallback routing, memory window.

## Acceptance
wrangler dev end-to-end with the fallback brain; deploys to workers.dev; no secrets in git.

## Do not
Do not implement the engine (B01) or the web UI.

## Report
fleet/outbox/B02/RESULT.md: what was done, evidence (commands + output pasted), open questions, cost if any. No secrets anywhere.
