# D07 result

## Outcome

- Assignment: Wave B, shard `D07`, mood `wilting`, language `en`.
- Written: **100 original conversations**, IDs `D07-0001` through `D07-0100`.
- Final filter: **100 kept, 0 dropped**. Every drop reason has count zero.
- Deliverables: `fleet/outbox/D07/shard.jsonl` and this report only.
- Launch mode: `SEED LINES PENDING`, decision 0014. The ten moments supplied the situation map; the three worked examples supplied tone. No Ahmed seed lines were invented, completed, or attributed.

## Quotas and length

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

There are 140 assistant turns. Maximum whitespace-separated assistant words per turn, including drafts and code:

| Tier | Observed maximum | Hard maximum |
|---|---:|---:|
| low | 31 | 60 |
| medium | 63 | 200 |
| high | 121 | 600 |

## Independent checks

An inline standard-library audit run with `python3 -I -` independently verified:

- Exactly 100 nonempty UTF-8 JSONL records, final newline, no CRLF, no extra top-level or message keys.
- Exact canonical persona, state field ordering, language line, system layout, alternating roles, assignment, unique sequential IDs, and every intent-by-tier quota.
- No U+2013 or U+2014 in any message. Visible user and assistant text also passed the lexical and leakage lists.
- All states are wilting, with two or three zero days and no current burrow. Every state has positive energy, matching tier, plausible age and growth bounds, and mild weather with a real city and time of day.
- Today's steps fund the stated recovered energy plus all replies. Every multi-turn row remains within its original tier after the specified reply deductions.
- Stage spread: 9 Spore, 42 Sprout, 24 Truffle, 25 Elder. All ten permitted cities appear.
- Ten memory rows contain exactly one correctly placed four-line memory section each. The other 90 contain none. There are 14 facts, 53 to 112 characters each. Low facts are from earlier today; medium facts are within the last seven local days; high facts are older and fit the creature's age.
- Memory answers use supplied facts or clearly proposed suggestions. They do not claim saved memories, scheduled reminders, or unavailable personal history.
- All six code rows were executed from their actual fenced snippets: five Python blocks using `compile` and `exec`, and five JavaScript blocks using `node -e`. Fixtures checked preserved inputs, empty input, quoted CSV commas and line breaks, negative numeric sorting, nullish defaults, and arbitrary category strings.
- Manual review checked complete low-energy answers, usable plans and drafts, gentle wilting tone, optional weather-aware outings, kindness after declining a walk, and no asserted feeding or mood transitions during a conversation.

Audit output:

```text
Independent contract audit: PASS, 100 rows, exact quotas and unique sequential IDs.
Turns: {1: 70, 2: 20, 3: 10}
Maximum assistant words: {'low': 31, 'medium': 63, 'high': 121}
Memory: 10 rows, 14 facts, exact sections; fact lengths: 53 112
Stages: {'Spore': 9, 'Sprout': 42, 'Truffle': 24, 'Elder': 25}
Cities: {'Muscat': 10, 'Sohar': 10, 'Nizwa': 8, 'Salalah': 9, 'Dubai': 9, 'Riyadh': 11, 'Berlin': 11, 'London': 13, 'Phoenix': 10, 'Kuala Lumpur': 9}
State funding and same-tier reply deductions: PASS for all 100 rows.
Executable code checks: PASS, 5 Python blocks and 5 JavaScript blocks across all 6 code rows.
Manual semantic review: completed tasks, conditional safe outings, refusal kindness, supplied memories, no asserted state transitions.
Protected input integrity: PASS, all 15 SHA-256 hashes unchanged.
Maximum within-shard assistant-text Jaccard: 0.0612 between D07-0028 and D07-0017.
Maximum worked-example Jaccard: 0.0162. No worked example copied.
```

## Situation coverage and schema decisions

No schema exceptions were taken. Wilting retains priority after today's feeding, so recovered medium and high energy does not become an invented mood change.

| Moment | Representative rows |
|---|---|
| Morning and step-food hunger | D07-0001, D07-0074 |
| Gratitude after a long walk | D07-0037, D07-0076 |
| Dangerous heat and burrow protection | D07-0073 |
| Sleepy short line | D07-0002 |
| Warmth after exceeding the usual steps | D07-0041, D07-0080 |
| Useful high-energy help | D07-0085 through D07-0092 |
| Gentle goodnight with optional tomorrow | D07-0012, D07-0015, D07-0083 |
| First meeting and new-spore introduction | D07-0033, D07-0075, D07-0100 |
| Grounded personal recall | D07-0030 through D07-0032, D07-0067 through D07-0070, D07-0096 through D07-0098 |
| Wilting but still kind | D07-0003, D07-0035, D07-0036, D07-0100 |

A currently burrowed state would violate this assignment, so heat protection is discussed conditionally rather than inventing a current hot day. A wilting creature with no steps after its empty midnight cannot fund a model call, so the zero-step morning is hypothetical; the current morning example has already received steps. The first-meeting Spore is three days old, not an impossible day-zero wilting creature. These are situation adaptations, not schema changes.

## Required self-check

Run from `/home/abied/Desktop/Truffle`:

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D07/shard.jsonl' --dry
```

Complete final report:

```text
# Truffle data filter report

Sources: `fleet/outbox/D07/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| D07 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 28 | 0 | 0 |
| medium | 27 | 0 | 0 |
| high | 25 | 0 | 0 |
```

## Handoff, integrity, and cost

- Final shard SHA-256: `6d9a421cb8dee9efb80694ee09a88b916961c22e187aab16a1d036721ee8896a`.
- No protected inputs were edited. All 15 required input hashes match the values recorded before generation.
- No S09 prompts or transcripts were used as training examples. Its result was read only for failure patterns.
- No commit or push was made. No application, filter, schema, seed, worked example, or another agent's output was edited.
- Cross-shard deduplication, final train/holdout construction, and voice review belong to the integrator. The dry report's 20/80 split is informational; no train or holdout files were written.
- No unresolved shard-local validation issue. Runtime tokenizer caps were not measured with the production tokenizer; replies stay well below word maxima. Broader voice approval remains a review task while Ahmed's lines are pending.
- Cost: no paid API, GPU, deployment, or external inference calls were launched. Additional tool/service spend: $0. Agent-session billing was not available.
