# Truffle - Playbook

The one document to read before anything else. Specs live in `docs/`. This is the why, the bet, and the rules of the road.

## 1. The bet

We are entering a DEV challenge where the write-up is weighed most and the field is full of near-identical "offline Gemma trail buddy" apps. We win by being the one entry that is **a creature, not a guide**, with **a real reason behind it** (Ahmed loves nature and lives where the heat keeps people inside), **a culturally rooted name** (Truffle, فقع, the desert truffle that hides from heat and is found by walking), **real data** (your actual steps, real weather, real growth numbers), and **one hard technical thing explained simply** (a model whose effort is gated by a number we own, with personality fine-tuned into open weights).

## 2. The product in five lines

1. Truffle only eats steps. Your Samsung phone feeds it.
2. Energy decides how hard its Gemma 4 31B brain is allowed to think. Thinking costs energy.
3. It grows through four stages; bigger Truffle eats more per day.
4. Four days at zero and it dies. On dangerously hot days it burrows and cannot die.
5. Beat your own weekly average and it gets affectionate.

Exact rules: `docs/01_product_spec.md`. Executable rules: `tests/golden/energy_cases.json`.

## 3. The stack in one breath

Cloudflare Workers + Durable Objects + Pages for everything the user touches. Modal for one serverless GPU running vLLM with Gemma 4 31B (FP8) plus our Truffle LoRA. Workers AI Gemma 4 26B as the always-warm fallback brain. Health Connect on Android for steps. Open-Meteo for weather. Unsloth for the fine-tune. Details: `docs/02_architecture.md`, `docs/03_finetune_plan.md`.

## 4. Decisions already made (do not reopen)

See `decisions/`. In short: name Truffle; 31B not 26B; cloud serving allowed and chosen; all app infra on Cloudflare; Modal over RunPod for serving; Gemma category only; Tinker dropped; death at 4 zero-days; burrow at 42C apparent; rules in code, soul in weights; quests are a Saturday stretch.

## 5. How we work

- Phases: research (done) -> design (done) -> build (Thu - Fri) -> write (Sat). No building during writing, no redesign during building.
- Spec-by-test for the engine. Verify on the phone before saying done.
- Fleet: Fable integrates; 5 Opus builders; 25+ astra agents for spikes, data and red-team, front-loaded before the ChatGPT plan may lapse (~Oct 9). `docs/05_fleet_orchestration.md`.
- Money: $20 loaded + Modal $30 free. Cap $50. Ledger in `fleet/costs.md`.
- Voice: human, short, no em dashes, numbers over adjectives. `docs/06_writeup_plan.md`.
- Every session ends with STATE.md + HANDOFF.md updated and a session log.

## 6. What Ahmed owns

- Sign-ins and credits (DEV, hacktoberfest promos, Modal, Hugging Face Gemma licence, Cloudflare).
- The 30 seed lines of Truffle's voice (Thursday noon).
- Walking. Three diary evenings with screenshots and honest feelings.
- Final say on the post's words.

## 7. What kills us, and the counter

| Risk | Counter |
|---|---|
| Thin write-up | Half of Saturday is writing. Two critique rounds. Diary with real numbers. |
| Fine-tune not serving in time | Plan B (merged weights) by Thu noon decision; Plan C (base + persona) at Fri 20:00 gate. Eval table ships either way. |
| Cold start on judging day | Modal snapshots + Workers AI half-awake fallback, shown honestly. |
| Steps never arrive | Tasker bridge Thursday; Kotlin app Friday; judge mode needs neither. |
| GPT fleet dies Oct 9 | All astra work front-loaded to Wed/Thu; nothing critical depends on it. |
| Laptop disk (9GB) | No local weights; Android SDK on the box. |
| Scope creep | Quests are stretch. Core list in CLAUDE.md rule 9. |

## 8. Timeline

`docs/07_timeline.md`. Publish Saturday 22:00 Oman.
