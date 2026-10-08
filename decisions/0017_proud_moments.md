# 0017 Proud moments: the reward layer

Date: 2026-10-08, 23:30 Oman. Status: accepted.

## Decision

The engine emits **moments**: small, true events about the person's walking, computed by a pure function `momentsFor(before, after, ctx)` next to the energy engine. They live in the Durable Object as a ring of the last 20 and come back in every `StateSummary` as `moments: Moment[]` (ascending `id`). Clients remember the last id they showed. Nothing is cleared on read, so the web app and the phone app can both show them.

```
Moment = { id: number; kind: MomentKind; at_ms: number; value: number }
MomentKind =
  | "stage_up"         // value: stage index 1..3
  | "best_day"         // steps_today beat every day in history7, and is at least 2,000. Once per day.
  | "beat_avg7"        // steps_today crossed avg7 (avg7 > 0). Once per day.
  | "day_10k"          // steps_today crossed 10,000. Once per day.
  | "streak"           // at midnight: trailing completed days at or above 3,000 steps hit value (3, 7, 14, 30)
  | "lifetime"         // lifetime_steps crossed value (10,000, 50,000, 100,000, 250,000, 500,000)
  | "heat_day_indoor"  // burrowed day and steps_today crossed 2,000. Once per day.
```

Rules, in code: moments never change energy, tier, mood or death. They are never produced in judge mode from the slider (demo pets get them from the same function, so the demo can show them, but they carry `demo` in the summary as today). The model never decides a moment. Copy for each moment is fixed text in the web app and the phone app, in English and Arabic, in Truffle's voice. The brain may be told about the newest moment through the prompt later (separate decision).

Goldens: `tests/golden/moment_cases.json` is law for `momentsFor`, same runner style as `energy_cases.json`.

## Why

The challenge asks for something that gets people outside. Rewards that work are specific, immediate and honest. A moment is the engine noticing a real thing the person did. No streak shaming when a streak breaks: the moment simply does not fire. No daily goal pressure: the floor of 3,000 is low on purpose and the best day is relative to the person's own week.

## Consequences

- B12 implements the engine function, DO storage and summary field with goldens.
- B13 shows moments in the web world (celebration in the fx layer plus one line of fixed copy) and offers a share card.
- B14 shows moments in the phone app's World screen through the web view, and the Walk screen shows the streak.
