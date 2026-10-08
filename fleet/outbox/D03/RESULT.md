# D03 result

## Outcome and assignment

- Assignment: Wave B, D03, mood=affectionate, language=en, owner=astra.
- Wrote 100 original conversation rows, IDs D03-0001 through D03-0100.
- Final filter result: 100 read, 100 kept, 0 dropped. All production quotas pass.
- Launch mode: SEED LINES PENDING, decision 0014. The ten moments guided situations and the three worked examples guided tone. No Ahmed seed lines were authored, completed, or attributed to him.
- Authored only `fleet/outbox/D03/shard.jsonl` and `fleet/outbox/D03/RESULT.md`.
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
| Total | 35 | 40 | 25 | 100 |

| User turns per row | Rows |
|---|---:|
| 1 | 70 |
| 2 | 20 |
| 3 | 10 |

| Tier | Maximum words in any assistant turn | Hard maximum |
|---|---:|---:|
| low | 32 | 60 |
| medium | 88 | 200 |
| high | 169 | 600 |

Words include drafts and fenced code and are counted with whitespace splitting. The shard has 140 assistant turns. Stages: 33 Sprout, 32 Truffle, 35 Elder. All ten permitted cities occur.

## Voice map and scope decisions

| Moment | Representative rows |
|---|---|
| Hungry morning, no steps yet | D03-0001 |
| Fed after at least 6,000 steps, grateful and slightly silly | D03-0024, D03-0030 |
| Heat protection, indoor alternatives, genuinely safer later conditions | D03-0070, D03-0097 |
| Short sleepy greeting | D03-0003, D03-0011 |
| Affection after beating the average | D03-0012, D03-0025 |
| Useful high-energy practical help | D03-0046, D03-0052, D03-0058, D03-0059 |
| Goodnight with an optional future walk | D03-0031 through D03-0040 |
| First meeting without invented familiarity | D03-0091 |
| Grounded recall from earlier chats | D03-0081 through D03-0090 |
| Kindness if wilting | D03-0096 |

No schema exception was used. Every actual snapshot remains affectionate, with zero_days=0 and burrowed=no. Heat and wilting are explicitly hypothetical conversations, not incompatible current states. The first meeting is a first chat with an existing young Sprout, not an incorrectly affectionate newborn Spore. These choices preserve the assigned mood and plausible history rather than forcing every seed-map moment into a contradictory snapshot.

## Independent verification

In addition to the mandatory filter, inline `python3 -I -` checks independently verified:

- Exactly 100 UTF-8 JSONL objects, a final newline, no blank lines, exact top-level and message keys, sequential unique IDs, alternating roles, and all tier-by-intent quotas.
- Exact fixed persona and language strings, state-field ordering, LF layout, no extra system text, and metadata agreement.
- Exactly ten memory sections, exclusively on personal_memory rows. Each has the exact marker, note line, single JSON list line, and closing marker. There are 16 supplied facts in total, one or two per row, with a maximum fact length of 93 characters.
- Low memory facts are from earlier today, medium facts from within the last seven local days, and older high-tier memories fit the creature's age. Missing details are acknowledged rather than invented. Suggestions are distinguished from recalled facts. No saved-memory or scheduled-reminder claims occur.
- Safe weather descriptions with real cities and local times, plausible recent-step bounds for each stage, and enough distance from tier boundaries that all turns remain in the original tier after reply costs.
- No U+2013 or U+2014 in any role. No visible state echoes, hidden-reasoning tags, prompt commentary, or invented state transitions.
- All low-tier answers finish. Outdoor suggestions stay optional and weather-aware; indoor steps are accepted equally. Declining a walk or leaving the chat receives a warm response.
- Maximum within-shard normalized assistant word-3-shingle Jaccard: 0.0686, between D03-0070 and D03-0097. Maximum overlap with any worked example: 0.0128. No S09 prompts or transcripts were used as training text.

All six practical_code rows were exercised using Python 3.12.3 and Node v22.23.3. Eight fenced snippets were executed through inline Python and `node -`, without creating test files. Assertions covered ordered deduplication, padding, CSV quoting and round trips, non-mutating locale sorting, valid and invalid calendar dates, and debounce arguments, context, delay selection, and captured input values.

Verification output:

```text
PASS: 100 rows, exact schema and system layouts, unique sequential IDs, all quotas, 70/20/10 turns.
PASS: 10 memory sections only on memory rows; accessible dates, grounded facts, no extra system text.
PASS: safe temperature/time syntax, plausible stage bounds, stable tiers after all turn costs.
PASS: no prohibited Unicode dashes or visible conversation internals; all assistant word budgets.
Memory fact count: 16 maximum fact characters: 93
Stages: {'Sprout': 33, 'Truffle': 32, 'Elder': 35} cities: {'Muscat': 10, 'Sohar': 10, 'Nizwa': 9, 'Salalah': 9, 'Dubai': 10, 'Riyadh': 10, 'Berlin': 11, 'London': 12, 'Phoenix': 10, 'Kuala Lumpur': 9}
Maximum within-shard assistant 3-shingle Jaccard: 0.0686 rows: (70, 97)
Maximum worked-example assistant Jaccard: 0.0128
PASS: Python order-preserving dedupe, CSV round trip and escaping, monthly date counts and errors.
[ 'Amir', 'bea', 'zoe' ]
PASS: JavaScript padding, non-mutating locale sort, debounce args/context/delay, captured input.
All 6 practical_code rows exercised; 8 fenced snippets executed. No test files created.
```

## Mandatory self-check

Run from `/home/abied/Desktop/Truffle`:

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D03/shard.jsonl' --dry
```

Complete final report:

```text
# Truffle data filter report

Sources: `fleet/outbox/D03/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| D03 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 28 | 0 | 0 |
| medium | 27 | 0 | 0 |
| high | 25 | 0 | 0 |
```

## Handoff, limits, and cost

- No unresolved local filter drops or quota failures. Automated checks supplement, rather than replace, the manual semantic review.
- No external API, paid inference service, GPU, deployment, or network request was invoked. Incremental external execution cost: USD 0. Harness usage cost was not available.
- The dry filter's 20/80 train/hold-out split is a report-only preview. No train or holdout files were written.
- Cross-shard deduplication, global train/holdout construction, and final voice review belong to the integrator.
