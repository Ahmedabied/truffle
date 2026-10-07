# B01 RESULT: energy engine and goldens

Status: done. All 30 goldens pass. Typecheck clean. No cost. No secrets.

## What was done

- `worker/src/engine.ts`: every body filled in. Every original export, type and signature is unchanged.
- Added exports (additive only): `TIER_ORDER`, `allowedTier(state)`, `gravestoneOf(state, memory)`.
- `worker/src/config.ts`: not touched. No constant changed.
- `worker/test/golden.test.ts`: loads `../tests/golden/energy_cases.json` with fs. One `it(case.id)` per case. Asserts only the keys in `expect`. Also asserts the input state is not mutated.
- `worker/test/engine.test.ts`: 10 extra edge tests (stage thresholds, history cap, gravestone cap, dead midnight, burrowed death guard, state block sanitising).
- The engine is pure. No fetch, no Date, no Math.random, no I/O. Every function returns new objects with copied arrays.

## Evidence

```
$ cd worker && npm test
 Test Files  2 passed (2)
      Tests  41 passed (41)

$ npm run typecheck
> tsc --noEmit
(no output, exit 0)
```

Per-case list (`npx vitest run --reporter=verbose`):

```
 ✓ test/golden.test.ts > golden energy cases > has 30 cases
 ✓ 01_new_spore_is_asleep
 ✓ 02_feed_3000_spore_medium
 ✓ 03_feed_is_absolute_total_not_delta
 ✓ 04_feed_lower_total_is_ignored
 ✓ 05_user_asks_high_but_energy_allows_medium
 ✓ 06_high_tier_costs_200
 ✓ 07_high_tier_on_spore_at_5000
 ✓ 08_low_tier_costs_20
 ✓ 09_boundary_ratio_exactly_0_25_is_medium
 ✓ 10_boundary_ratio_exactly_0_60_is_high
 ✓ 11_energy_below_cost_drops_a_tier
 ✓ 12_energy_below_20_is_asleep_for_this_message
 ✓ 13_midnight_burn_spore
 ✓ 14_midnight_to_zero_sets_zero_days_1
 ✓ 15_fourth_zero_midnight_is_death
 ✓ 16_burrowed_day_skips_burn_and_zero_count
 ✓ 17_burrowed_day_burn_skipped_even_with_energy
 ✓ 18_feed_on_burrowed_day_feeds_but_does_not_grow
 ✓ 19_growth_crosses_into_sprout
 ✓ 20_energy_caps_at_stage_max
 ✓ 21_affection_increments_when_beating_avg_by_10pct
 ✓ 22_affection_does_not_increment_at_plus_5pct
 ✓ 23_affection_needs_min_500_steps_on_first_day
 ✓ 24_affection_caps_at_5
 ✓ 25_new_spore_after_death_resets_everything
 ✓ 26_dead_truffle_refuses_feed_and_chat
 ✓ 27_mood_priority_burrowed_beats_wilting
 ✓ 28_burrow_threshold_from_weather
 ✓ 29_no_burrow_just_under_threshold
 ✓ 30_state_block_reflects_engine_not_model
 (plus 10 engine.test.ts edge tests, all passing)
```

Case 21 avg7: `(6*4000 + 5000)/7` equals `4142.857142857143` exactly in JS. The runner uses `toBeCloseTo(want, 9)` for non-integer expectations. History math is never rounded.

## Ambiguities and how I resolved them

1. **Gravestone age_days.** Golden 15 expects 11 from age 10. So the stone records the post-increment age. In code, step 6 (age += 1) runs before the stone is written. The death decision itself still uses the step 4 result. No golden changed.
2. **Who writes the gravestone.** `midnight` writes it on death, with `favourite_memory`. Golden 25 starts from a dead state with no stones and expects one stone after `newSpore`. So `newSpore` also writes a stone for a dead state, but only if the newest stone does not already match it (same age_days, lifetime_steps, stage). In the normal flow there is no duplicate. Spec: "On death the engine writes a gravestone".
3. **Energy cap on feed that crosses a stage.** Followed "Stage is re-derived (growth happens the moment the threshold is crossed)". Energy is capped at the energy_max of the stage after growth. Golden 19 is consistent with this.
4. **Lower total on feed.** Golden 4 says a lower total is ignored. So `steps_today` never goes down. The spec line "steps_today = total" applies only when delta > 0.
5. **Tier drop.** Followed "If energy < cost of the allowed tier, drop one tier. If energy < 20, treat as asleep". The drop is applied once, to the tier after the request cap. Then the under-20 rule applies.
6. **Death on burrowed day.** Followed "Death is never caused by a burrowed day". The death check is skipped on a burrowed day.
7. **Midnight on a dead Truffle.** The spec is silent. I made it a no-op, so the gravestone and age freeze until "plant a new spore".
8. **avg7_before_today.** Taken from the stored `state.avg7`, not recomputed from history7.
9. **Stage in the runner.** No golden relies on a given stage that differs from the derived one. The runner derives stage only when a case omits it.
10. **Weather text in the state block.** `"` becomes `'`. `]`, CR and LF become spaces. This keeps the block one line with balanced quotes. Golden 30 text is unaffected.

## Notes for B02 (the DO)

- `decideTier` is the single source of truth for tier. `stateBlock` calls `decideTier(state)` with no requested tier. Do not compute tier anywhere else.
- Chat flow: `d = decideTier(state, requested)`. If `d.model_call` is false, send a canned sleepy line. After the reply, `state = chargeChat(state, d)`. Cost is 0 for asleep.
- `feed` takes the absolute total since local midnight. Dead state: returns an unchanged copy.
- `midnight(state, burrowed_tomorrow, favourite_memory)` appends the gravestone to `state.gravestones` on death (max 20, newest last). Pass the favourite memory in. The engine does not pick it.
- `newSpore(state)` keeps gravestones and resets everything else to `DEFAULT_STATE`.
- `moodOf` is derived. Never store mood.
- Every function returns a fresh object. Persist the return value.
- Golden `default_state` has no `gravestones` key. The engine `DEFAULT_STATE` does. Old rows without it must be merged with `DEFAULT_STATE` on load.

## Open questions for the integrator

- Should `midnight` on a dead state still advance `age_days`? I chose no.
- Point 2 above: a golden for "midnight death then new_spore gives exactly 1 stone" would lock the no-duplicate rule. It is covered in `engine.test.ts` today.
