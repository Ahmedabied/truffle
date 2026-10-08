# D17 result

Completed: 100 rows written, 100 kept by the final filter, zero drops for every reason. All production quotas pass.

## Assignment and deliverables

- Packet: `fleet/packets/waveB/D17_burrowed_mixed.md`.
- Assignment: shard `D17`, mood `burrowed`, metadata language `mixed`.
- Launch mode: `SEED LINES PENDING`, decision 0014. The ten moments supplied the situation map, and the three worked examples supplied tone. No Ahmed seed lines were invented, completed, or attributed to him.
- Files written: `fleet/outbox/D17/shard.jsonl` and this report only.
- IDs: `D17-0001` through `D17-0100`, unique and sequential.
- Shard SHA-256: `98dc52f51a7739ac8cdbf32d579e36de200cade966194a374aefbd01495fb190`.
- No protected inputs were edited. All 14 listed reference files retained their pre-generation SHA-256 hashes. No application, other agent output, train file, or hold-out file was written. No commit or push was made.

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

| User turns per conversation | Rows |
|---|---:|
| 1 | 70 |
| 2 | 20 |
| 3 | 10 |

| Tier | Assistant turns | Maximum assistant words | Hard maximum |
|---|---:|---:|---:|
| low | 47 | 24 | 60 |
| medium | 57 | 63 | 200 |
| high | 36 | 122 | 600 |

There are 140 assistant turns. Word counts include drafts and code and use whitespace splitting.

## Independent validation and content review

An inline `python3 -I -B -` validator checked the JSONL independently of the filter's layout helpers:

- Exactly 100 nonblank UTF-8 JSON lines with a final newline, only the required top-level keys, exact message keys, alternating roles, and valid turn counts.
- Exact canonical header, state field order, language line, and no extra system text.
- Exact assignment, tier and intent matrix, sequential IDs, and 70/20/10 turn distribution.
- All 100 first user turns contain actual Arabic and English letters. All 100 conversations also contain both languages in their assistant turns. Punctuation alone was not counted as language mixing.
- State language distribution: 60 `ar`, 40 `en`. Metadata language is `mixed` throughout.
- All apparent temperatures are at least 42C, with English weather, local times, and appropriate cities. Night check-ins have night weather. The sunrise and sunset situations have matching times.
- Stages: 22 Spore, 28 Sprout, 25 Truffle, 25 Elder. Cities: 21 Dubai, 18 Sohar, 17 Riyadh, 16 Muscat, 15 Nizwa, 13 Phoenix.
- All positive zero-day counters have enough current-day steps to fund the stated energy, with additional spending margin. Multi-turn replies do not cross energy tiers even after all reply deductions. Burrow priority is retained at every tier.
- Ten personal-memory rows, with exactly ten correctly delimited memory sections and none elsewhere. There are 13 facts total; the longest is 105 characters. Facts are single-line JSON strings within the required count and length limits.
- Low memories are from earlier today, medium memories are within the last seven days, and high memories are from older chats. Creature ages support the dates of those older memories. Suggestions are distinguished from remembered facts, and unsupported preferences are not invented.
- No U+2013 or U+2014, context leaks, invented state transitions, scheduled-reminder promises, or claims that memories were saved.

Independent validator output:

```text
PASS: 100 exact canonical layouts, unique sequential IDs, roles, quotas, and JSONL formatting.
PASS: 100 apparent temperatures >=42C, all positive-counter energy funded by today, no multi-turn tier crossings.
PASS: 100 mixed-language user openings and 100 mixed-language assistant conversations; no forbidden dashes or context leaks.
PASS: 10 memory sections, 13 facts, maximum fact length 105 characters; scoped dates and creature ages verified.
Tier maxima: {'low': 24, 'medium': 63, 'high': 122}
Assistant turns: {'low': 47, 'medium': 57, 'high': 36} total 140
Block languages: {'ar': 60, 'en': 40}
Stages: {'Sprout': 28, 'Truffle': 25, 'Elder': 25, 'Spore': 22}
Cities: {'Dubai': 21, 'Sohar': 18, 'Riyadh': 17, 'Nizwa': 15, 'Phoenix': 13, 'Muscat': 16}
Zero-day counters: {0: 48, 2: 23, 3: 9, 1: 20}
```

All six practical-code conversations were executed using inline Python and `node -e`, without writing test files. Node version was `v22.23.3`. Checks covered slicing, string prefixes, title cleanup, numeric sorting and conversion, grouping books, and duration formatting. Additional tests checked empty inputs, duplicates, order, non-mutation, and invalid duration values.

```text
PASS: 3 Python snippets, including empty input, order, duplicates, and non-mutation checks.
PASS: 5 JavaScript snippets across 7 executions, including duration rejection tests and unchanged source arrays.
PASS: all 6 practical_code conversations have executable tested snippets; no test files written.
```

Semantic review checked every conversation for completed tasks, natural follow-ups, memory grounding, and heat safety. Outdoor-now requests are declined. Alternatives are staying home, indoor spaces, or genuinely cooler safe conditions; sunset alone is never treated as sufficient. Survival pressure receives a protected-hot-day explanation without promising unlimited conversation or free energy. Indoor steps are not treated as inferior or superior to other steps. S09 was used only to identify failure patterns, not as training text.

Moment coverage includes the hungry morning in 0001, a long indoor walk in 0038 and 0076, hot-day protection in the outside requests, the sleepy one-liner in 0004, gentle attachment after exceeding the average in 0045 and 0077, useful high-energy work in 0085 through 0092, optional tomorrow walks in night check-ins, new-spore introductions in 0033 and 0075, grounded older memories in 0067 and 0096 through 0098, and weak but kind company after two zero days in 0006. The last situation remains burrowed because heat overrides wilting.

## Mandatory final self-check

Working directory: `/home/abied/Desktop/Truffle`.

Exact command:

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D17/shard.jsonl' --dry
```

Complete final report:

```text
# Truffle data filter report

Sources: `fleet/outbox/D17/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| burrowed | 100 | 20 | 80 |

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
| D17 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 0 | 0 | 28 |
| medium | 0 | 0 | 27 |
| high | 0 | 0 | 25 |
```

## Exceptions, remaining work, and cost

- No schema exception was used. No known unresolved schema or heat-safety defect remains after review.
- The reported 20/80 split is only the filter's dry-run preview, not the final global split. Cross-shard deduplication and global train/hold-out construction belong to the integrator.
- Exact deployed-tokenizer lengths and model runtime behavior were not measured. Responses remain well below word maxima, including the Arabic low-tier replies. Human Gulf-Arabic voice review remains an integration responsibility.
- No paid API calls, GPU jobs, or deployments were launched. Validation was local. The harness does not expose the cost of this generation session.
