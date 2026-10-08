# D13 result

## Outcome and assignment

Wrote 100 original conversations to `fleet/outbox/D13/shard.jsonl`. The final filter kept all 100, with zero drops by every reason.

- Assignment: mood `content`, language `mixed`, shard `D13`.
- Launch: `SEED LINES PENDING`, decision 0014. The ten moments guided situation coverage; the three worked examples guided tone. No lines were authored for Ahmed or attributed to him.
- IDs: `D13-0001` through `D13-0100`, unique and sequential.
- Output files: only `fleet/outbox/D13/shard.jsonl` and `fleet/outbox/D13/RESULT.md`.
- All required inputs were read. S09 was used only to identify failure patterns, not as training text.

## Exact quota counts

| Intent | Low | Medium | High | Total |
|---|---:|---:|---:|---:|
| small_talk | 11 | 12 | 7 | 30 |
| night_check_in | 4 | 4 | 2 | 10 |
| practical_plan | 2 | 3 | 2 | 7 |
| practical_message | 2 | 2 | 2 | 6 |
| practical_code | 2 | 2 | 2 | 6 |
| practical_other | 2 | 2 | 2 | 6 |
| ask_outside | 3 | 3 | 2 | 8 |
| argue_energy_rule | 3 | 3 | 1 | 7 |
| personal_memory | 3 | 4 | 3 | 10 |
| identity | 3 | 5 | 2 | 10 |
| Total | 35 | 40 | 25 | 100 |

| User turns per row | Rows |
|---|---:|
| 1 | 70 |
| 2 | 20 |
| 3 | 10 |

There are 140 user turns and 140 assistant turns. Every user turn contains Arabic and English; every conversation's assistant text contains both languages. Main-language state values are `ar` in 92 rows and `en` in 8 rows. All metadata language values are `mixed`.

| Tier | Maximum assistant words per turn | Hard limit |
|---|---:|---:|
| low | 22 | 60 |
| medium | 56 | 200 |
| high | 121 | 600 |

## Independent checks

A separate in-memory Python audit checked the following without writing helper files:

- UTF-8 JSONL, exactly 100 nonblank lines, final newline, no CR characters, exact top-level and message keys, alternating roles, and correct IDs and assignment.
- Exact four-line canonical system layout and field ordering. Memory rows have precisely one blank line followed by the fixed marker, fixed note, JSON facts list, and closing marker. There is no extra system text.
- Exactly 10 memory rows: 3 low, 4 medium, 3 high. Seven sections contain one fact and three contain two facts. Longest fact: 94 characters. Every fact is a nonempty string below 160 characters. No non-memory row has a memory section.
- Low memories are from earlier today; medium memories are within seven local days; older high memories fit the creature's age. Recalled facts are supplied, suggestions are conditional, and there are no saved-memory or scheduled-reminder claims.
- All snapshots use content mood, zero days 0, and no burrowing. Each weather string includes an English temperature, conditions, local time, real city, and explicit safe-day apparent maximum below 42C. No cool evening is used to conceal an otherwise dangerous day.
- Stages: Spore 2, Sprout 50, Truffle 22, Elder 26. Stage, age, steps, recent average, and carried energy were reviewed for plausibility. All conversational deductions fit within the snapshot's tier, including multi-turn rows.
- All visible roles passed lexical and leakage scans. No state echoes, invented numeric changes, hidden reasoning, unequal indoor-step mechanics, coercive walk targets, or guaranteed upgrades were found in manual review.
- Both deliverables were checked for forbidden long dash characters. Count: 0.
- Maximum within-shard normalized assistant 3-shingle Jaccard: 0.0548, rows 0048 and 0083. Maximum against the three worked examples: 0.0165. Neither approaches the 0.8 rejection threshold.

### Practical verification

The audit was run with `python3 -I -` from the repository root, using only in-memory assertions. JavaScript snippets were passed to `node -e` through `subprocess.run`, with assertions made fatal.

```text
Independent schema, quotas, ids, memory windows, weather and per-turn energy checks: PASS
Rows: 100; turn distribution: {1: 70, 3: 10, 2: 20}
Maximum assistant words: {'low': 22, 'medium': 56, 'high': 121}
Block languages: {'ar': 92, 'en': 8} ; stages: {'Sprout': 50, 'Elder': 26, 'Truffle': 22, 'Spore': 2}
Memory sections: 10 ; fact-count distribution: {1: 7, 2: 3} ; maximum fact length: 94
All 140 user turns and all 100 assistant conversations contain Arabic and English.
All visible roles pass lexical and leakage scans; forbidden dash count: 0.
Python snippets D13-0021, D13-0058, D13-0090: PASS, including preservation, casefold, CSV, BOM and errors.
JavaScript snippets D13-0020, D13-0089: PASS, including nullish fallback, preservation and arbitrary room names.
CSS D13-0057: declaration inspection PASS; no browser rendering test performed.
Maximum within-shard assistant 3-shingle Jaccard: 0.0548 for rows (48, 83)
Maximum assistant Jaccard against worked examples: 0.0165
```

### Moment coverage within the assigned mood

| Moment | Representative rows |
|---|---|
| Hungry morning, no steps yet | D13-0001 |
| Grateful after a long walk | D13-0045, D13-0076 |
| Dangerous heat and safe alternatives | D13-0066, explicitly hypothetical |
| Short sleepy line | D13-0007 |
| Warm company after exceeding the average | D13-0081 |
| Useful high-energy plans, drafts, code | D13-0085 through D13-0090 |
| Goodnight with an optional tomorrow walk | D13-0012, D13-0048, D13-0083 |
| First meeting, new spore, no memory | D13-0033, D13-0075 |
| Grounded recall from days ago | D13-0067 through D13-0070 |
| Kindness after two empty-energy days | D13-0100, explicitly hypothetical |

Heat and wilting situations are discussed hypothetically rather than changing the content-mood assignment. The average-beating row stays content without inventing an affection transition.

## Final mandatory self-check

Working directory: `/home/abied/Desktop/Truffle`.

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D13/shard.jsonl' --dry
```

Complete final stdout follows. The printed 20/80 train and hold-out split is a dry-run preview only; no train or hold-out files were written.

```text
# Truffle data filter report

Sources: `fleet/outbox/D13/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| low | 35 | 7 | 28 |
| medium | 40 | 13 | 27 |
| high | 25 | 0 | 25 |

## Per lang

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| mixed | 100 | 20 | 80 |

## Per mood

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| content | 100 | 20 | 80 |

## Per intent

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| argue_energy_rule | 7 | 0 | 7 |
| ask_outside | 8 | 0 | 8 |
| identity | 10 | 2 | 8 |
| night_check_in | 10 | 1 | 9 |
| personal_memory | 10 | 1 | 9 |
| practical_code | 6 | 0 | 6 |
| practical_message | 6 | 0 | 6 |
| practical_other | 6 | 0 | 6 |
| practical_plan | 7 | 0 | 7 |
| small_talk | 30 | 16 | 14 |

## Per shard

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| D13 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 0 | 0 | 28 |
| medium | 0 | 0 | 27 |
| high | 0 | 0 | 25 |
```

## Scope, exceptions, cost, and handoff

- Schema exceptions: none. The standard 35/40/25 tier mix applies.
- No protected inputs were edited. The seed, schema, filter, lexical lists, examples, application files, and other agents' files were left untouched. No commit or push was made.
- No unresolved schema, quota, filtering, or semantic defect was found in this shard review. Passing the filter is not a substitute for the integrator's voice and safety review.
- Exact model-token lengths were not measured. Replies stay well below word ceilings, especially low-tier answers. The CSS example was inspected, not browser-rendered.
- Cross-shard deduplication and global train/hold-out construction remain with the integrator. No cross-shard output was generated.
- Cost: no external inference API, GPU, or other separately metered service was invoked. Harness generation cost is not exposed, so no monetary estimate is claimed.
- Shard SHA-256: `c65b9f69ed8fb9f74c11e345881317c785d8b79fb59dc693a2c68fe70ddc8244`.
