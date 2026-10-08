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

## Moment cases (decision 0017)

`golden/moment_cases.json` is the executable spec of `momentsFor` in `worker/src/moments.ts`. The runner is `worker/test/moments.golden.test.ts`.

Each case has `before`, `after`, `ctx` and `expected`:

- `before` and `after` merge over `default_state`. A missing `stage` is derived from `lifetime_steps`.
- `ctx` is `{ now_ms, event, next_id, already_today }`. `event` is `feed`, `midnight` or `spore`. Midnight cases may add `streak_before`, the streak the DO counted before this midnight.
- `expected` is the exact list of moments, in order, with ids counting up from `next_id`.
- The `constants` block must match the code. The runner checks it.
- The runner also checks that every live `after` state is one the engine really produces from `before`, so a case cannot describe an impossible day.

Rules the cases pin down:

- A daily kind (`best_day`, `beat_avg7`, `day_10k`, `heat_day_indoor`) fires when its condition turns true in one feed, and only if it is not in `already_today`.
- `value` is the stage index for `stage_up`, the threshold for `lifetime`, the streak length for `streak`, and `steps_today` for the daily kinds.
- One feed can emit several moments. Order: `stage_up`, `best_day`, `beat_avg7`, `day_10k`, `lifetime`, `heat_day_indoor`.
- `streak` fires only at midnight, only at 3, 7, 14 and 30.
- A dead Truffle gets nothing. `spore` emits nothing.

## What else must have tests before Saturday

- Pairing phrase: generate, parse, reject bad input.
- `/feed` rate limit per phrase.
- Midnight alarm scheduling: next local midnight from an IANA timezone, including a DST zone (e.g. `Europe/Berlin`) and a non-DST zone (`Asia/Muscat`).
- Fallback routing: Modal timeout -> Workers AI, with the "half-awake" flag set in the response.
- Memory window filter per tier.

## Fine-tune eval

Lives in `finetune/eval/`. Not unit tests: a scored comparison of base vs tuned on a held-out prompt set. See `docs/03_finetune_plan.md`.
