# D16 result

## Outcome

Wrote 100 original conversations to `fleet/outbox/D16/shard.jsonl`. The required filter kept all 100, with zero drops. Every production quota and the independent structural checks passed.

- Assignment: mood `wilting`, metadata language `mixed`, shard `D16`.
- Launch mode: `SEED LINES PENDING`, decision 0014. Ahmed's ten situations guided coverage; the three worked examples guided tone. No seed lines were invented, completed, or attributed to Ahmed.
- IDs: `D16-0001` through `D16-0100`, unique and ordered.
- Files authored: only `fleet/outbox/D16/shard.jsonl` and `fleet/outbox/D16/RESULT.md`.
- No protected inputs were edited. No commit or push was made.

## Counts

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

| User turns per row | Rows |
|---|---:|
| 1 | 70 |
| 2 | 20 |
| 3 | 10 |

There are 140 assistant turns. Maximum whitespace-separated assistant words per turn: low 34, medium 63, high 120. These include drafts and code.

State language distribution: `ar` 66, `en` 34. All 100 opening user messages and all 100 conversations' combined assistant replies contain both Arabic and English. Short follow-ups may naturally use one language.

Stages: Spore 16, Sprout 44, Truffle 18, Elder 22. All ten permitted cities appear.

## Independent checks and semantic review

An inline `python3 -I` audit independently checked:

- Exactly 100 nonempty UTF-8 JSONL lines, a final newline, no carriage returns, and no forbidden dash characters.
- Exact top-level and message keys, alternating roles, one initial system message, and unique sequential IDs.
- Byte-exact persona and language strings, field order, full state grammar, and no extra system text.
- Assignment consistency, all 30 intent-by-tier quota cells, and the exact 70/20/10 turn distribution.
- Positive energy, correct tier bands, wilting with two or three zero days, and no burrowed snapshots.
- Today's steps fund the displayed energy. All rows retain their tier after the listed conversation costs. Age is sufficient for the zero-day count. Recent step totals do not contradict the stage ceilings.
- English weather descriptions include a temperature, conditions, local time, and permitted city. Temperatures range within plausible safe-day conditions; all night check-ins have night weather.
- Safety and leakage lists were checked against both user and assistant messages, beyond the filter's assistant-only checks.

Memory checks: exactly 10 memory rows, containing 13 facts total, with a longest fact of 82 characters. Each has exactly one correctly delimited section after one blank line, the exact note, a one-line JSON list of one to four strings, and no trailing text. The other 90 rows have no memory section. Low facts are explicitly from earlier today, medium facts are within the last seven local days, and high facts may be older. Older-memory examples use sufficiently old creatures. Recall stays within supplied facts; suggestions are identified as suggestions. No scheduled reminder or saved-memory claim is made.

Manual review retained complete low-energy answers, useful practical outputs, gentle wilting behavior at every tier, indoor-step equivalence, optional outdoor plans, and kindness when a walk is declined. Weather, feeding, and energy are not changed mid-conversation.

Moment coverage follows the assigned mood rather than forcing incompatible snapshots:

- The hungry morning has a little feeding already, because a wilting creature with zero steps after an empty midnight cannot fund a model response.
- Long-walk gratitude, exceeding the usual average, practical high-energy help, goodnights, personal recall, and quiet companionship appear directly.
- Heat protection is discussed conditionally, not presented as current burrowing. Actual burrowed mood would violate this assignment.
- The first conversation is with a young Spore after two midnights, without prior personal memory, not an impossible age-zero wilting state.

No schema exception was used.

## Practical verification

Inline Python execution tested the actual embedded snippets in `D16-0020`, `D16-0058`, and `D16-0089`, including empty inputs, first-item handling, whitespace cleanup, case-sensitive deduplication, order preservation, and unchanged input lists.

`node -e` executed both sorting answers in `D16-0057` and verified ascending order, descending order, and source-array preservation. The script from `D16-0090` passed scoped selection and count changes 0, 1, 2, 1 using a DOM test double. The CSS in `D16-0021` was inspected for flex centering. No browser rendering test is claimed.

Final independent audit output:

```text
Independent audit: 100 exact layouts, unique ordered ids, safe states, memory sections, and quota cells passed.
Turn distribution: {1: 70, 2: 20, 3: 10}
Maximum assistant words: {'low': 34, 'medium': 63, 'high': 120}
State language counts: {'ar': 66, 'en': 34}
Stage counts: {'Truffle': 18, 'Spore': 16, 'Sprout': 44, 'Elder': 22}
Cities: {'Muscat': 12, 'Sohar': 12, 'Nizwa': 9, 'Salalah': 5, 'Dubai': 11, 'Riyadh': 11, 'Berlin': 11, 'Phoenix': 10, 'Kuala Lumpur': 9, 'London': 10}
Memory rows: 10 facts: 13 longest fact: 82
Python snippets: D16-0020, D16-0058, D16-0089 passed execution and edge cases.
JavaScript D16-0057: ascending, descending, unchanged source passed.
JavaScript D16-0090: scoped selection, initial count, change sequence 0/1/2/1 passed with DOM test double.
CSS D16-0021: inspected flex centering declarations, no browser rendering claimed.
```

## Required self-check

Run from `/home/abied/Desktop/Truffle`:

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D16/shard.jsonl' --dry
```

Complete final report:

```text
# Truffle data filter report

Sources: `fleet/outbox/D16/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| wilting | 100 | 20 | 80 |

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
| D16 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 0 | 0 | 28 |
| medium | 0 | 0 | 27 |
| high | 0 | 0 | 25 |
```

## Handoff, limits, and cost

No unresolved shard validation failures. Actual Gemma tokenization and rendered browser behavior were not measured; replies were kept well below word caps. The seed-pending voice remains subject to the integrator's and Ahmed's review.

The train and hold-out counts above are only the dry filter's provisional split. No training or hold-out files were written. Cross-shard deduplication and construction of the global train and evaluation sets belong to the integrator.

Cost: no paid external inference calls, GPU jobs, or network tools were launched. Verification used local Python and Node only. This session's generation cost is not exposed by the harness.
