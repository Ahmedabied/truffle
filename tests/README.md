# Tests

## Golden cases (spec-by-test)

`golden/energy_cases.json` is the executable spec of the energy engine. The build session implements `worker/src/engine.ts` as a pure function module (no I/O) and a runner that loads the JSON, applies each `event` to `default_state` merged with `state`, and asserts every key in `expect`.

Rules:

- Keys not listed in `expect` are not asserted.
- `energy_after` is the energy after the chat cost is deducted.
- `tier_check` computes tier and mood without spending.
- `midnight` carries `burrowed_tomorrow`, the weather result for the new day, so the case stays pure.
- `weather` tests only the threshold function.
- `state_block` tests the exact string the model will see.

Run (once the engine exists): `cd worker && npm test`. Use Vitest. The runner lives at `worker/test/golden.test.ts`.

## What else must have tests before Saturday

- Pairing phrase: generate, parse, reject bad input.
- `/feed` rate limit per phrase.
- Midnight alarm scheduling: next local midnight from an IANA timezone, including a DST zone (e.g. `Europe/Berlin`) and a non-DST zone (`Asia/Muscat`).
- Fallback routing: Modal timeout -> Workers AI, with the "half-awake" flag set in the response.
- Memory window filter per tier.

## Fine-tune eval

Lives in `finetune/eval/`. Not unit tests: a scored comparison of base vs tuned on a held-out prompt set. See `docs/03_finetune_plan.md`.
