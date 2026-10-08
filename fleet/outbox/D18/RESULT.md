# D18 result

100 rows written, 100 kept, zero drops. All assignment quotas and independent structural checks pass.

## Assignment and scope

- Assignment: `D18`, metadata mood `just_woke`, metadata language `mixed`.
- Output: `fleet/outbox/D18/shard.jsonl` and this report only.
- Launch mode: `SEED LINES PENDING`, decision 0014. The ten moments guided situations and the three worked examples guided tone. No Ahmed seed lines were authored, completed, quoted, or attributed.
- Schema-first exception: all 100 rows are low tier, replacing the standard 35/40/25 tier mix with 100/0/0 while preserving every intent total. All snapshots have early morning weather and block mood `content` or `tired`.
- Night check-ins discuss a past goodbye or a future bedtime routine or message, never a currently nighttime scene. Heat is discussed hypothetically without changing the morning snapshot. High-energy and wilting states were not forced into this morning-only shard. Older memory questions receive an honest limit rather than invented recall.
- All listed references were read. S09 was used only for failure patterns, not training prompts or replies. No protected inputs were edited. No commit or push was made.

## Counts

| Tier | Rows | Maximum assistant words per turn |
|---|---:|---:|
| low | 100 | 30 |
| medium | 0 | Not applicable |
| high | 0 | Not applicable |

| Intent | Low | Medium | High | Total |
|---|---:|---:|---:|---:|
| small_talk | 30 | 0 | 0 | 30 |
| night_check_in | 10 | 0 | 0 | 10 |
| practical_plan | 7 | 0 | 0 | 7 |
| practical_message | 6 | 0 | 0 | 6 |
| practical_code | 6 | 0 | 0 | 6 |
| practical_other | 6 | 0 | 0 | 6 |
| ask_outside | 8 | 0 | 0 | 8 |
| argue_energy_rule | 7 | 0 | 0 | 7 |
| personal_memory | 10 | 0 | 0 | 10 |
| identity | 10 | 0 | 0 | 10 |
| Total | 100 | 0 | 0 | 100 |

- Turn distribution: 70 single-turn, 20 two-turn, 10 three-turn rows. There are 140 assistant turns, each 12 to 30 whitespace-separated words.
- Block languages: 51 `ar`, 49 `en`. All 140 user turns and all 140 assistant turns contain both Arabic and Latin-script text; code-switching was also reviewed for conversational fit.
- Block moods: 66 `content` with zero days 0, 34 `tired` with zero days 1. All are unburrowed, with energy between 8 and 20 percent.
- Stages: 26 Spore, 24 Sprout, 24 Truffle, 26 Elder. Ten real cities are represented, with local times between 06:10 and 07:10 and temperatures from 14C to 25C.
- IDs: exactly `D18-0001` through `D18-0100`, unique and ordered.

## Independent verification

Two inline `python3 -I -` checks read the finished shard without creating helper files. They verified:

1. UTF-8 JSONL, LF line endings, final newline, 100 nonempty lines, exact object keys, alternating roles, and unique IDs.
2. Exact persona header, ordered state grammar, fixed language line, and no extra system material.
3. Assignment metadata, all tier and intent quotas, turn distribution, safe morning weather, and low-tier restriction.
4. Plausible stage and age combinations, sufficient current energy for every conversation, sufficient same-day feeding for tired snapshots, and fresh Spore limits. No lifetime history was invented from age alone.
5. Exactly ten memory sections, only on memory rows. They contain 11 facts total, one or two per row, with a maximum fact length of 84 characters. Every fact explicitly says it came from earlier today. Blank-line placement, markers, fixed note, JSON list, and terminal closing marker match the contract.
6. No prohibited dash characters anywhere in the shard, no visible state echoes or reasoning markers, and both scripts in every user and assistant turn.
7. Five Python code snippets executed successfully, including ordered deduplication and empty-list assertions. Three JavaScript snippets passed five `node -e` executions covering output, null, empty-string, and named-user cases. The CSS grid snippet passed declaration checks. Both arithmetic answers were verified.
8. Manual review of complete answers, requested drafts, optional outdoor advice, indoor step equivalence, refusal of invented energy upgrades, grounded memories, and no promised reminders or fabricated memory saves.

Check output:

```text
Independent structure, assignment, quotas, unique IDs, mixed-script turns, weather and energy checks: PASS
Rows: 100 Assistant turns: 140 Turn distribution: {1: 70, 2: 20, 3: 10}
Tier counts: low=100 medium=0 high=0
Assistant word range: 12 to 30
Block languages: {'ar': 51, 'en': 49} Block moods: {'content': 66, 'tired': 34} Stages: {'Sprout': 24, 'Elder': 26, 'Truffle': 24, 'Spore': 26}
Cities: {'Muscat': 12, 'Nizwa': 10, 'Salalah': 9, 'Dubai': 10, 'Riyadh': 9, 'Berlin': 11, 'London': 10, 'Phoenix': 9, 'Kuala Lumpur': 10, 'Sohar': 10}
Memory: 10 rows, 11 facts, max fact length 84 characters; exact layout and same-day scope: PASS
Dash ban, UTF-8, LF, final newline, all-role content scan: PASS
Python snippets executed: 5; output and edge assertions: PASS
JavaScript snippets: 3; 5 node executions including null, empty and named-user cases: PASS
CSS grid snippet declaration check: PASS; browser rendering not exercised
Practical arithmetic checks: PASS
```

## Final mandatory self-check

Run from `/home/abied/Desktop/Truffle`:

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D18/shard.jsonl' --dry
```

Complete final report:

```text
# Truffle data filter report

Sources: `fleet/outbox/D18/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

- Lines read: **100**
- Kept: **100**
- Train: **20**
- Eval hold-out: **80**

## Drops by reason

| Reason | Count |
|---|---|
| **total dropped** | **0** |

## Per tier

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| low | 100 | 20 | 80 |

## Per lang

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| mixed | 100 | 20 | 80 |

## Per mood

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| just_woke | 100 | 20 | 80 |

## Per intent

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| argue_energy_rule | 7 | 0 | 7 |
| ask_outside | 8 | 0 | 8 |
| identity | 10 | 0 | 10 |
| night_check_in | 10 | 0 | 10 |
| personal_memory | 10 | 0 | 10 |
| practical_code | 6 | 0 | 6 |
| practical_message | 6 | 0 | 6 |
| practical_other | 6 | 0 | 6 |
| practical_plan | 7 | 0 | 7 |
| small_talk | 30 | 20 | 10 |

## Per shard

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| D18 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 0 | 0 | 80 |
| medium | 0 | 0 | 0 |
| high | 0 | 0 | 0 |
```

## Remaining scope and cost

- No unresolved shard validation failures. The all-low mix is the explicit schema exception, not an unreported deviation.
- Cross-shard deduplication, global train/holdout construction, and reviewer approval belong to the integrator. The filter's 20/80 split above is a dry-run projection only; no train or holdout files were written.
- Exact model-token lengths were not measured. Replies stay well below the 60-word limit, but runtime token-cap checks remain an integration concern. CSS was not browser-rendered.
- External API or GPU spend initiated by this task: USD 0. Generation-session billing is not exposed to this subagent and was not estimated.
