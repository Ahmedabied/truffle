# B12 RESULT: proud moments in the Worker (decision 0017)

Status: done. Not committed, not deployed. Fable commits and deploys.

## What was done

- `worker/src/moments.ts` (new). `MomentKind`, `Moment`, `MomentContext`, `momentsFor(before, after, ctx)`. Pure: no Date.now, no I/O. Ids count up from `ctx.next_id`. Helpers: `pushMoments` (ring of 20), `markToday` (once-per-day list), `trailingStreak`, `nextStreak`. Constants are exported and checked against the golden file.
- `worker/src/do.ts`. Moment state lives in the meta JSON column (no new table, no migration):
  - `moments` ring, max 20, ascending id. Never cleared on read.
  - `next_moment_id`, only grows.
  - `moments_today`, the once-per-day list. Cleared at every local midnight tick (alarm catch-up and demo midnight), at a new spore and at demo reset.
  - `streak_days`, the streak counter. history7 holds 7 days, so 14 and 30 need a counter. When it is missing (old Truffles), it starts from the trailing run in history7.
  - `momentsFor` is called in the real `/feed` path, the demo slider, the catch-up midnight (at_ms is the midnight instant) and the demo midnight. Spore resets the day list and the streak and emits nothing. The ring is kept across lives, so ids never repeat.
  - Moments only touch meta. The engine state is never changed by them.
- `worker/src/types.ts`. `StateSummary.moments: Moment[]` (always present, `[]` when none). Meta fields above.
- `web/src/types.ts`. One field: `moments?: Moment[]`, imported from the worker. It is optional on the web side because `web/src/mock.ts` (another agent's file) builds a StateSummary without it and would not compile. An older deployed Worker also omits it. Web `tsc --noEmit` is clean.
- `tests/golden/moment_cases.json` (new). 36 cases, same style as energy_cases.json, plus a constants block.
- `worker/test/moments.golden.test.ts` (new). Loads the goldens, asserts exact output, purity, the constants block, that every kind is covered, and that every live after state is one `engine.feed` or `engine.midnight` really produces from the before state.
- `worker/test/moments.do.test.ts` (new). 10 DO tests: two feeds in /state, once per day, not cleared on read, ignored feed makes nothing, engine state unchanged, ring of 20 with growing ids, demo paths and day list clearing, a stored streak reaching 14, the real alarm with the midnight instant, death and new spore.
- `tests/README.md`. New section on moment cases.

## Rules as built

- A daily kind (`best_day`, `beat_avg7`, `day_10k`, `heat_day_indoor`) fires when its condition turns true in one feed and it is not in `already_today`.
  - best_day: steps_today at least 2,000 and above every day in history7.
  - beat_avg7: avg7 above 0 and steps_today above avg7 (equal is not beating).
  - day_10k: steps_today at least 10,000.
  - heat_day_indoor: after.burrowed and steps_today at least 2,000.
- `value`: stage index for stage_up, threshold for lifetime, streak length for streak, steps_today for the daily kinds.
- Order inside one call: stage_up, best_day, beat_avg7, day_10k, lifetime, heat_day_indoor.
- streak: midnight only, from the closed day. Fires at 3, 7, 14, 30 only.
- before or after dead: nothing. spore: nothing.

## Commands and output

Full worker suite (320 before, 402 now: 72 golden runner tests, 10 DO tests):

```
$ cd worker && npm test
 Test Files  17 passed (17)
      Tests  402 passed (402)
```

Typecheck:

```
$ cd worker && npx tsc --noEmit; echo tsc_exit=$?
tsc_exit=0
$ cd web && npx tsc --noEmit; echo web_tsc_exit=$?
web_tsc_exit=0
$ git diff --quiet tests/golden/energy_cases.json && echo "energy_cases.json unchanged"
energy_cases.json unchanged
```

`wrangler dev --ip 127.0.0.1 --port 8787`, real pet. A fresh pet has avg7 = 0, so beat_avg7 cannot fire on day one. The second feed was refused by the jump cap, which also shows a refused feed makes no moment:

```
pair: tz=Asia/Muscat 0 []
--- feed 1 (2100)
{"energy":2100,"energy_max":6000,"stage":"Spore","mood":"content","tier":"medium","steps_today":2100,"burrowed":false,"expected_day":"2026-10-08","active_tz":"Asia/Muscat"}
--- feed 2 (2500)
{"error":"That is 400 new steps since the last sync, more than 20 a second. Nothing changed. Sync again in 18 s.","retry_after_s":18}
--- /state moments
{"steps_today": 2100, "avg7": 0, "moments": [{"id": 1, "kind": "best_day", "at_ms": 1791488030352, "value": 2100}]}
```

Same server, demo pet through the slider (same feed path). Two midnights build avg7 = 2,000. Then one feed crosses 2,000 and beats avg7, and a second feed beats every day:

```
day 1: slider 4000
{"steps_today": 4000, "history7": [], "avg7": 0, "moments": [[1, "best_day", 4000]]}
midnight
{"steps_today": 0, "history7": [4000], "avg7": 4000, "moments": [[1, "best_day", 4000]]}
day 2: rest, midnight
{"steps_today": 0, "history7": [4000, 0], "avg7": 2000, "moments": [[1, "best_day", 4000]]}
day 3: feed 2100 (crosses 2,000 = avg7)
{"steps_today": 2100, "history7": [4000, 0], "avg7": 2000, "moments": [[1, "best_day", 4000], [2, "stage_up", 1], [3, "beat_avg7", 2100]]}
day 3: feed 4100 (beats every day)
{"steps_today": 4100, "history7": [4000, 0], "avg7": 2000, "moments": [[1, "best_day", 4000], [2, "stage_up", 1], [3, "beat_avg7", 2100], [4, "best_day", 4100]]}
--- GET /state
[
 { "id": 1, "kind": "best_day", "at_ms": 1791488041749, "value": 4000 },
 { "id": 2, "kind": "stage_up", "at_ms": 1791488041812, "value": 1 },
 { "id": 3, "kind": "beat_avg7", "at_ms": 1791488041812, "value": 2100 },
 { "id": 4, "kind": "best_day", "at_ms": 1791488041835, "value": 4100 }
]
```

(stage_up on day 3 is right: lifetime went from 4,000 to 6,100, past the 5,000 Sprout line.) The dev server was stopped after the run.

## Golden cases (tests/golden/moment_cases.json)

- 01_best_day_first_day_at_2000
- 02_best_day_beats_every_day_in_history7
- 03_best_day_not_when_one_day_is_higher
- 04_best_day_needs_2000_but_beat_avg7_fires
- 05_best_day_and_beat_avg7_once_per_day
- 06_best_day_then_beat_avg7_in_order
- 07_beat_avg7_equal_is_not_beating
- 08_beat_avg7_needs_avg7_above_zero
- 09_day_10k_crossing
- 10_day_10k_once_per_day
- 11_day_10k_does_not_fire_again_above_10k
- 12_stage_up_spore_to_sprout
- 13_stage_up_two_stages_in_one_feed
- 14_lifetime_60000_jump_from_zero_fires_10k_then_50k
- 15_stage_up_to_elder_and_lifetime_100000
- 16_lifetime_250000
- 17_lifetime_500000_exact
- 18_heat_day_indoor_burrowed_crosses_2000
- 19_heat_day_indoor_needs_burrowed
- 20_heat_day_indoor_once_per_day
- 21_heat_day_indoor_below_2000
- 22_other_kind_today_does_not_block_day_10k
- 23_dead_truffle_feed_no_moments
- 24_dead_truffle_midnight_no_moments
- 25_death_at_midnight_drops_the_streak_moment
- 26_spore_emits_nothing
- 27_midnight_streak_3_from_history7
- 28_midnight_streak_7_from_history7
- 29_midnight_streak_8_is_silent_when_history7_is_full
- 30_midnight_streak_14_fires_once
- 31_midnight_streak_15_is_silent
- 32_midnight_streak_30
- 33_midnight_streak_4_is_silent
- 34_midnight_streak_broken_by_2999
- 35_midnight_never_fires_daily_kinds
- 36_midnight_burrowed_day_counts_for_streak

## Open questions for Fable

1. **Signature addition.** `ctx` has one optional extra field, `streak_before`. history7 holds 7 days, so a 14 or 30 day streak cannot come from history7 alone. Without the field, the count comes from history7 (cases 27 to 29). The DO always passes its stored counter. Worth one line in decision 0017.
2. **best_day on day one.** With an empty history7, "beat every day" is true by default, so the first feed past 2,000 is a best day (case 01). That felt right for a new pet. Change case 01 if not.
3. **Crossing rule.** Every daily kind fires when its condition turns true, not merely when it is true. A Truffle already past 10,000 when this deploys gets no day_10k until tomorrow. That seemed better than a burst of stale moments on the first feed after deploy.
4. **Demo reset** clears the day list and the streak and keeps the ring, same as a new spore. Clients compare ids, so nothing is shown twice.
5. **Values for daily kinds** are steps_today, so copy can say the number. Decision 0017 did not fix these values.
6. **FeedSummary** (the phrase-only `/feed` reply) does not carry moments. That reply is for the feeder and has no secret. Moments come back on `/state`, demo routes, `/spore`, pair and the chat done event.
7. `web/src/types.ts` has `moments?` (optional), see above. B13 may want to make it required once `web/src/mock.ts` sets it.
