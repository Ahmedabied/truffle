# D05 result

100 original rows written, 100 kept by the final filter, zero drops for every reason. All production quotas pass.

## Assignment and outputs

- Assignment: `mood=tired`, `lang=en`, `shard=D05`.
- Launch mode: `SEED LINES PENDING`, decision 0014.
- Dataset: `fleet/outbox/D05/shard.jsonl`, UTF-8 JSONL with a final newline and no blank lines.
- IDs: `D05-0001` through `D05-0100`, unique and sequential.
- Report: `fleet/outbox/D05/RESULT.md`.
- Only these two output files were written. No protected inputs were edited. No commit or push was made.

All required packet inputs were read. The three worked examples supplied the tone; the ten moments supplied the situation map. No Ahmed seed lines were authored, completed, or attributed. Seed-file formatting demonstrations were not used as voice references. S09 was consulted for failure patterns only, not as training text.

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
| **Total** | **35** | **40** | **25** | **100** |

| User turns per row | Rows | Messages per row |
|---|---:|---:|
| 1 | 70 | 3 |
| 2 | 20 | 5 |
| 3 | 10 | 7 |

There are 140 assistant turns. Maximum whitespace-separated assistant words per turn, including drafts and code: low 33, medium 75, high 168. All turns finish within their assigned word budgets.

Stage distribution: Spore 6, Sprout 76, Truffle 12, Elder 6. Weather covers all ten allowed cities, with English temperature, conditions, and local time descriptions.

## Independent checks and useful-task verification

In-memory Python audits were run with `python3 -I -`, without creating helper files. They checked:

- Exact top-level and message keys, string values, role alternation, unique IDs, assignment, and all 30 intent-by-tier quota cells.
- The exact four-line system layout, fixed persona and language bytes, state-field order, LF newlines, and absence of additional system text.
- Ten personal-memory sections and none elsewhere. The marker, note, JSON list, and closing marker match the contract. There are 18 facts total, one to three per row, with a maximum fact length of 99 characters. Low facts are from earlier today; medium facts are within seven days; high facts are from older chats compatible with the creature's age.
- Every state remains tired with one zero day and no burrow. Today's steps fund the stated percentage at the stage's capacity, with additional room for every reply's cost. Deducting all conversation costs does not cross a tier boundary. Stage, age, recent average, and steps were checked for plausibility without inferring lifetime steps from age alone.
- No U+2013 or U+2014 in any role. All user and assistant text also passed the lexical and leakage checks, not only the assistant text checked by the filter.
- Manual review for completed low-tier help, useful practical responses, grounded memories, optional weather-aware outings, no invented state transitions, and no fabricated memory-saving or scheduled-reminder claims.

Audit output:

```text
Independent audit: PASS, 100 rows, exact layouts, unique ids, all 30 quota cells.
User-turn distribution: {1: 70, 2: 20, 3: 10}
Assistant turns: 140
Maximum assistant words: {'low': 33, 'medium': 75, 'high': 168}
Memory rows: 10 facts: 18 facts per row: 1 to 3 maximum fact characters: 99
Stages: {'Spore': 6, 'Sprout': 76, 'Truffle': 12, 'Elder': 6} cities: 10
Funding, tier stability after all deductions, and recent growth feasibility: PASS.
Visible-message lexical, leakage, and all-role dash scans: PASS.
Maximum row Jaccard to S13: 0.057143; worked references: 0.016667.
```

S13 was compared read-only using normalized assistant-text word 3-shingles. No S13 row or assistant turn was reused. Maximum individual-turn similarity against S13 and the worked references was also 0.057143, well below 0.8. These are targeted reference checks, not global cross-shard integration.

All six practical-code rows were executed. Python examples were extracted and run with assertions; JavaScript examples were extracted and run using `node --input-type=commonjs -e`. Checks covered empty input, stable sorting, preserved input data, iterables, nonconsecutive repeats, URL decoding, duplicate query parameters, and first-seen ordering with last-record values. Practical arithmetic was checked separately.

```text
D05-0020: Python list ending, empty and nonempty cases PASS.
D05-0057: Python stable sorting, spacing, original list preserved PASS.
D05-0089: Python run grouping, generator, empty, singleton, unhashable cases PASS.
D05-0021: JavaScript execution and edge cases PASS.
D05-0058: JavaScript execution and edge cases PASS.
D05-0090: JavaScript execution and edge cases PASS.
Practical arithmetic checks PASS. All six practical_code rows executed successfully.
```

## Situation coverage and schema decisions

No schema exceptions were used. Tired mood takes priority throughout, including recovered medium and high energy and affectionate company after above-average steps.

The morning example follows a small indoor feeding rather than inventing positive energy with zero steps after a zero-energy midnight. First meetings use young spores without memory sections. Hot-day protection and deeper droop are discussed explicitly as hypothetical situations, not falsely asserted as the current tired state. Long-walk gratitude, sleepy brevity, useful high-energy work, optional tomorrow walks, and tier-accessible recall are covered directly.

There are no unresolved local validation failures. Runtime tokenizer counts and deployed model behavior were not tested. Human voice review, global cross-shard deduplication, and global train/holdout construction remain with the integrator. The 20/80 split below is only the filter's default dry-run simulation for this single shard; no train or holdout files were written.

Cost: no paid external API calls or GPU jobs were launched. Agent-session billing is unavailable, so no monetary estimate is asserted.

## Required self-check

Working directory: `/home/abied/Desktop/Truffle`.

Exact command:

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D05/shard.jsonl' --dry
```

The final command exited 0 and retained all 100 rows. Complete final report:

```text
# Truffle data filter report

Sources: `fleet/outbox/D05/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| en | 100 | 20 | 80 |

## Per mood

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| tired | 100 | 20 | 80 |

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
| D05 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 28 | 0 | 0 |
| medium | 27 | 0 | 0 |
| high | 25 | 0 | 0 |

```
