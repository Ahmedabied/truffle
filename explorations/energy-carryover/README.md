# Energy carryover exploration

Throwaway offline models. None is wired into the app or Worker. No production
engine, golden case, product spec, data or deployment is changed.

Run from the repository root, using the already installed Worker dependencies:

```sh
node explorations/energy-carryover/run.mjs
```

The command imports the **actual** production energy engine for the current
model, bundles into an OS temporary directory, runs deterministic assertions,
writes `results.json`, and removes its temporary bundle. It makes no network or
paid model calls. Source hashes in the JSON identify the engine inspected.

- `models.ts`: current-engine adapter and three alternative economy models.
- `simulation.ts`: trajectories, conservation checks and boundary probes.
- `results.json`: generated results, assumptions and assertion names.
- [Report](../../docs/reviews/energy-carryover-exploration.md): recommendation,
  limits, migration and production tests still required.

The simulator is a small economy probe, not a replacement Durable Object.
It does not verify HTTP authentication, concurrency, provider quality, Android
sensor accuracy or production chat reservation. The date/zone wrapper applies
the existing feed contract; the production tests were run separately.

All three proposals use exact elapsed consumption, no debt while empty, and a
96-hour nonheat empty clock. They retain death for comparison. The report does
not endorse irreversible death as a consequence of ordinary rest.

Model keys:

| Key | Consumption | Extra storage | Chat reserve |
|---|---|---|---|
| `current` | Actual stage burn at local midnight | None | None |
| `gentle_continuous` | 1,000 per actual 24h for every stage | None | None |
| `pantry_current_rate` | Existing stage rates, elapsed | Up to 12,000 | None |
| `pantry_gentle_protected` | 1,000 per actual 24h for every stage | Up to 12,000 | 1,000 points |

The proposed numbers are product choices. They are not calorie conversions,
biological rates, measurements of model compute cost or exercise advice.
