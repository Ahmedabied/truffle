# 0019 Release integration safeguards

Status: accepted. Date: 2026-10-08.

Ahmed asked Codex to finish the interrupted app, world, rewards and post work.
He explicitly approved both pending feed and weather safeguards during this
session: require dated, time-zone-matched step uploads, and preserve a known
heat-safe day when the weather service temporarily fails.

## Feed and weather

Real feeds require `day` and `day_tz`. The date and aggregation zone must match
the pet's active local day and pinned zone. A mismatch earns no steps and
returns the active zone so the Android feeder can read the correct window and
retry. Clients without a day envelope must upgrade. Judge controls remain
explicit simulations. A missing forecast cannot revoke known heat protection;
fresh usable weather is needed to clear it. Existing energy goldens stay intact.

## Pet ownership and origins

An incoming pet link is removed from browser history immediately. A different
pet requires a clear confirmation and a successful state lookup before the
browser adopts it. A demo pet cannot become a real pet by following a link.
Browser credentials are scoped to API origin. Changing the API must never send
the previous origin's secret to the new server. Existing default-origin pets
remain available when returning to the default server. Native pairing responses
must not overwrite a pet selected while the request was in flight. Native
origin changes are explicit settings actions, not side effects of typing.

## Honest simulation and analytics

Judge and offline share cards visibly say their steps are simulated. The offline
demo uses the same pure moments function as the Worker. Reset clears the old
reply and pending celebrations. This resolves the contradictory sentence in
0017: judge sliders may emit simulated moments, and clients label them as such.
The DO persists a completed-day streak counter beyond `history7`, so 14-day and
30-day milestones remain possible.

Android daily analytics may use exact instant-bounded aggregate calls instead
of local-period grouping, so travel and daylight saving do not mix day windows.
Absent distance records remain absent; they are not displayed as a measured zero.

## Verification

Regression tests cover the new boundaries. Android source moves between machines
through GitHub only. Builds and runtime checks distinguish emulator evidence
from Ahmed's Samsung. Neither simulated steps nor emulator performance stand
in for a real walk or a handset frame-rate measurement. The post stays a draft.
