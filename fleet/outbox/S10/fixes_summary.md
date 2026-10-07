1. [route/DO/web, S10-01] Return a random 128-bit-or-stronger owner secret once at /pair; require it for /chat, /state, /spore, and settings, not basic /feed.
2. [route, S10-01] Use CSPRNG phrases, collision checks, uniform lookup failures, and IP guess limits; never allocate a pet for an unknown phrase.
3. [route/web, S10-01] Keep secrets out of URLs, prompts, and logs; use no-store owner responses and a minimal nonprivate feed response.
4. [feeder/DO, S10-02] Add day and day_tz; aggregate the DO's active-zone day, reject stale or mismatched totals, and re-read Health Connect instead of retagging cached totals.
5. [DO, S10-03] Persist the closing-day midnight key with state and next alarm in one transaction; duplicate keys do nothing and catch-up starts at the stored due instant.
6. [DO/route, S10-03] Pin v1 timezone at pairing; device_tz cannot move midnight; approve any later owner migration only with old-zone close and transition-day safeguards.
7. [DO, S10-04] Admit one in-flight chat per pet with a durable request ID and reservation; charge once after production, preserve concurrent feeds, and fence old generations.
8. [route/DO, S10-04] Apply separate model budgets, reject excess work before inference, cancel losing fallback requests, and never duplicate extraction on retry.
9. [route, S10-05] Approve demo limits before allocation: 5 spawns/hour/IP, 20/day/IP, 60 actions/minute/IP and object, plus a global budget and bounded demo chats.
10. [DO/web, S10-05] Require stored demo status and capability; use absolute slider totals; enforce immutable 24h wall-clock expiry with min(midnight, expiry) and expiry checks on every route.
11. [DO, S10-06] Unify missing-weather behavior: keep known heat protection, propose protected rest when unknown, and close the old day before applying new-day weather.
12. [route/engine, S10-07/08] Accept only nonnegative safe integer totals; invalid engine input is a no-op, equal/lower totals preserve the high-water mark, and feeding never resets zero_days.
13. [DO/feeder, S10-07] Approve 50000/day and 20 steps/second admission caps; use server day-start for first sync, preserve the increasing-feed baseline, and enforce 60/hour/phrase.
14. [route/DO, S10-09] Validate coarse coordinates, bound refreshes, latch an already protected day, forbid client weather flags, and document that location and steps are not attested.
15. [engine/prompt/web, S10-10] Build weather from validated fields; propose unavailable for text over 96 code points or containing delimiters/controls; render all external text with textContent.
16. [DO, S10-10/13] Keep facts as untrusted bounded data, max 3 per extraction and 60 stored; use local calendar memory windows and wipe current-life facts/transcripts at death.
17. [engine/DO, S10-11] Reject live /spore and make live newSpore a no-op; preserve auth/day/quota/demo metadata, reapply current heat protection, and keep one stone per death.
18. [engine/web, S10-12] Pin growth-before-cap ordering, derive the final stage across multiple thresholds, and refresh ratio/max immediately after growth without shameful copy.
19. [DO/prompt/web, S10-13/14] Use one admitted TierDecision for cost, memory, thinking, tokens, prompt tier, and chat availability; 20/60/200 energy alone never grants medium/high.
20. [engine/web, S10-15/16] Preserve burn-before-zero, four zero days, unlimited protected heat days, available-day avg7, and strict affection thresholds; adopt proposed goldens only after decisions.
