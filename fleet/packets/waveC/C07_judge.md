# C07 judge read, lens 2
Owner: astra (gpt:deep)        Wave: C, Thu Oct 8 night        Due: Thu 2026-10-08 23:00 Oman

## Goal
Read the public repo the way a DEV Hacktoberfest judge will on Monday, with one lens, and return a ranked list of 5 cuts and 5 additions for the post and the repo.

## Your lens
Open innovation and craft: is the code honest, tested and readable? Would you trust the energy rules after reading tests/golden/energy_cases.json and worker/src/engine.ts? Is the fleet process (fleet/, decisions/, sessions/) a strength or noise to a judge? What would you cut from the repo before judging?

## Inputs
Repo: ~/Desktop/Truffle. Read README.md, docs/01_product_spec.md, docs/02_architecture.md, docs/06_writeup_plan.md, STATE.md, decisions/, tests/golden/energy_cases.json, worker/src/engine.ts, finetune/data/schema.md, finetune/data/generated/REPORT.md. Open the live demo https://truffle-web.ahmed-abied.workers.dev/demo in a headless browser or with curl against https://truffle.ahmed-abied.workers.dev if useful (at most one demo spawn). The challenge page: https://dev.to/challenges/hacktoberfest-week1-2026-10-05 (fetch it for the real judging criteria and quote them).

## Deliverable
fleet/outbox/C07/RESULT.md: the judging criteria as quoted from the challenge page; a score out of 10 per criterion with one sentence each; 5 cuts and 5 additions ranked by impact, each one line with the file or post section it touches; the three claims a sceptical judge will doubt and what evidence closes each. No em or en dashes. Do not edit any repo file.
