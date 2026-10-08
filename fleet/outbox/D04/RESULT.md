# D04 result

Outcome: 100 rows written, 100 kept, zero drops. All production quotas and independent contract checks passed.

## Assignment and outputs

- Assignment: mood `affectionate`, language `ar`, shard `D04`.
- Launch mode: `SEED LINES PENDING`, decision 0014. The ten moments guided situation coverage and the three worked examples guided tone. No Ahmed seed lines were invented, completed, attributed, or copied.
- Output: `fleet/outbox/D04/shard.jsonl`, UTF-8 JSONL, 100 nonempty lines, final newline.
- IDs: `D04-0001` through `D04-0100`, unique and sequential.
- Only this shard and `fleet/outbox/D04/RESULT.md` were written. No protected inputs were edited. No commit or push was made.

## Exact quotas

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

There are 140 assistant turns. Every assistant turn was counted separately, including drafts and code.

| Tier | Maximum assistant words | Hard maximum |
|---|---:|---:|
| low | 21 | 60 |
| medium | 73 | 200 |
| high | 118 | 600 |

## Independent checks

An in-memory validator was run with `python3 -I -B -`. It checked the complete serialized and decoded contract rather than relying only on the filter result:

- Exact top-level and message keys, assigned metadata, sequential IDs, role alternation, and all intent-by-tier quotas.
- Exact fixed persona and language strings, state field order, four-line canonical trio, LF newlines, and no additional system text.
- Energy ranges, metadata agreement, `zero_days=0`, and `burrowed=no` on all rows. Conversation deductions leave every multi-turn snapshot in its assigned tier.
- Four stages: Spore 1, Sprout 31, Truffle 34, Elder 34. Ten permitted cities, English weather descriptions with local time, and safe current temperatures from 15C to 27C.
- Stage and recent-energy plausibility reviewed. High-tier averages support the stated energy without requiring a recent protected day. Affection can carry from earlier days; today's steps do not have to exceed the average in every snapshot.
- Exactly ten memory rows, D04-0081 through D04-0090, with exactly one correctly ordered memory section each. No memory section on other intents. Twelve total facts, one or two per row, maximum 62 characters per fact.
- Low memories are from earlier today. Medium memories are from yesterday or two to four days ago. High memories use older supplied facts and ages that can accommodate those chats. Unknown details remain unknown, and suggestions are distinguished from remembered facts.
- All visible user and assistant text was checked against the lexical safety and leakage lists, not just assistant replies. Both output files were checked for prohibited dash code points.
- Maximum within-shard assistant 3-shingle Jaccard similarity: 0.043478, between D04-0070 and D04-0098. This is below 0.8.

Validator output:

```text
Independent full-contract validation: 100 passed
Tier counts: {'low': 35, 'medium': 40, 'high': 25}
User turns: {1: 70, 2: 20, 3: 10} Assistant turns: 140
Max assistant words: {'low': 21, 'medium': 73, 'high': 118}
Memory rows: 10 Facts: 12 Max fact characters: 62
Stages: {'Sprout': 31, 'Truffle': 34, 'Elder': 34, 'Spore': 1}
Max intra-shard Jaccard: 0.043478, D04-0070 / D04-0098
All-role lexical, leakage and punctuation checks: passed
State ordering, snapshots, memory layout, tier deductions and quota checks: passed
```

All six coding examples were executed from their actual fenced code. The Python checks included empty input, preserved ordering, in-place versus copied lists, invalid batch sizes, and the generator follow-ups. JavaScript was run with `node -`; the HTML example used a minimal DOM mock to verify two toggle cycles, labels, and expansion attributes.

```text
Python examples D04-0054, D04-0056, D04-0058: passed, including follow-ups
JavaScript examples D04-0055, D04-0057, D04-0059: passed, including two DOM toggle cycles
Arithmetic and schedule totals: 3*2.5=7.5; cards 9 then 12; plans 60, 5, 60 and 120 minutes
```

Manual review covered complete low-tier answers, usable practical tasks, Arabic address without slash templates, optional weather-aware walks, no fabricated state transitions, and no unsupported personal recall. Minor wording and snapshot-plausibility issues were corrected before the final check. No valid filter run dropped any row.

## Situation map and scope decisions

| Moment | Example coverage |
|---|---|
| Hungry morning, no steps | D04-0001 |
| Fed after 6,000 or more steps | D04-0023, D04-0024 |
| Dangerous heat and shelter | D04-0070, D04-0098, conditional discussion only |
| Sleepy low-energy one-liner | D04-0003, D04-0011 |
| Affection after exceeding average | D04-0012, D04-0027 |
| Useful high-energy help | D04-0046, D04-0052, D04-0058 |
| Goodnight with optional tomorrow walk | D04-0031, D04-0037, D04-0039 |
| First conversation, no personal memory | D04-0091 |
| Personal facts from earlier days | D04-0084 through D04-0090 |
| Kindness during possible wilting | D04-0079, hypothetical only |

No schema exception was used. Actual burrowed or wilting snapshots would violate the assigned affectionate mood, so those moments appear only as clearly conditional discussions. The first-conversation Spore is three days old, not a contradictory day-zero affectionate creature. Earlier feeding can establish affection without earlier personal chats. For example, completed-day totals of 1300, 1650, and 1950 can yield a Spore with the stated average and 600 remaining energy points after midnight deductions.

## Mandatory self-check

Working directory: `/home/abied/Desktop/Truffle`.

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D04/shard.jsonl' --dry
```

Complete final report:

```text
# Truffle data filter report

Sources: `fleet/outbox/D04/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| ar | 100 | 20 | 80 |

## Per mood

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| affectionate | 100 | 20 | 80 |

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
| D04 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 0 | 28 | 0 |
| medium | 0 | 27 | 0 |
| high | 0 | 25 | 0 |

```

## Handoff, limits, and cost

- No unresolved schema, quota, filter, or task-completion issue remains.
- Exact Gemma token counts were not measured. Replies are deliberately short, but runtime-token and human Arabic-naturalness review remain integration checks.
- The report's 20/80 split is a dry-run preview only. No train or hold-out file was written. Cross-shard deduplication and global train/hold-out construction belong to the integrator.
- No paid API or GPU job was launched. Verification used local Python and Node only. Harness generation cost was not exposed.
