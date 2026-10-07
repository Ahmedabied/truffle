# CLAUDE.md - Truffle build runbook

Read this first, then `STATE.md`, then `HANDOFF.md`. Everything else is in `PLAYBOOK.md` and `docs/`.

## What this is

A DEV Hacktoberfest Week 1 ("Touch Grass") entry. Deadline **Mon 2026-10-12 10:59 Oman time** (Oct 11, 11:59 PM PDT). We publish **Saturday night**, leaving Sunday and Monday morning as buffer. The repo is **public** and judges read it.

## Ground rules (non-negotiable)

1. **Phase discipline.** Research -> design -> build. The design is settled in `docs/01_product_spec.md` and `docs/02_architecture.md`. Build to it. If a spec change is needed, write a decision record in `decisions/` first, then change the spec, then the code.
2. **The energy engine is spec-by-test.** `tests/golden/energy_cases.json` is the law. The engine must pass every case before anything else touches it. Add cases when behaviour is added. Never edit a golden to make code pass without a decision record.
3. **Rules in code, soul in weights.** Effort tier, refusal when asleep, death, burrow: all enforced in the Worker. The model is never trusted to enforce a rule. The fine-tune only teaches voice, mood and how to read the state block.
4. **Verify before claiming done.** Run the thing. Paste the output. "Should work" is not a status. For anything user-facing, verify on the phone, not just curl.
5. **Public voice.** Anything that can end up in the DEV post, README, UI copy or commit messages: no em dashes or en dashes, short sentences, one idea each, no "X rather than Y" tics, no unsourced superlatives. See `docs/06_writeup_plan.md`.
6. **Secrets never touch git.** `.dev.vars`, Modal tokens, HF tokens, Cloudflare tokens live in env or `.dev.vars` (gitignored). Grep before every commit. Agent session transcripts get uploaded to DEV later: do not paste secrets into chat either.
7. **Money.** Budget is $20 loaded + Modal's $30 free credit. Hard cap $50 total. Log every paid run in `fleet/costs.md` (what, GPU, minutes, $). Dry-run estimates before any GPU job over $3.
8. **This laptop has ~9GB free disk and a 4GB GPU.** Never download model weights here. All GPU work is cloud (Modal / RunPod). Android SDK (~4GB) goes on the box (`ssh workstation`) unless space is freed first.
9. **Scope.** Core = steps -> energy -> tiered Gemma brain -> ASCII world -> feeder -> fine-tune with before/after numbers -> judge mode. Quests from OpenStreetMap are a **stretch** for Saturday only if core is done Friday night.
10. **Session hygiene.** Every session ends by updating `STATE.md` and `HANDOFF.md` and adding `sessions/YYYY-MM-DD_session-NN_<slug>.md`. Commit often with messages a judge can read.

## Fleet

Fable (this harness, main production line) integrates and decides. Opus 5.5 agents (5, medium effort) build modules against task packets. GPT "astra" agents (`gpt:max`, `gpt:deep`) do spikes, dataset generation and red-team. Full protocol in `docs/05_fleet_orchestration.md`. The gpt plugin only runs when Ahmed's own message asks for GPT/astra, so the session that launches the astra waves must be started with a message that says so. The ChatGPT plan may end around Oct 9: front-load astra work to Wed night and Thursday.

## Stack (decided, do not re-litigate)

- App infra: Cloudflare Workers + Durable Objects (SQLite, alarms) + Pages. Geo from `request.cf`. Weather from Open-Meteo.
- Brain: Gemma 4 31B IT + Truffle LoRA on vLLM on Modal (serverless, scale to zero). Fallback brain: Workers AI `@cf/google/gemma-4-26b-a4b-it` when Modal is cold or down, flagged in UI as "half-awake".
- Steps: Android (Samsung) via Health Connect. Day 1 bridge = Tasker + TaskerHealthConnect plugin. Real deliverable = small Kotlin feeder app, sideloaded.
- Fine-tune: Unsloth QLoRA on a 48GB GPU, eval harness base vs tuned.
- Web: vanilla TypeScript, ASCII rendered in a `<pre>` grid, mobile-first, no framework.

## Commands you will want

- `wrangler dev` in `worker/`, `wrangler deploy` when verified.
- Tests: see `tests/README.md`.
- Cost ledger: `fleet/costs.md`.
