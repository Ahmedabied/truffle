# D01 result

Completed: **100 rows written, 100 kept, 0 dropped**. All assignment quotas and independent structural checks pass.

## Assignment and deliverables

- Assignment: `mood=content`, `lang=en`, `shard=D01`.
- Packet: `fleet/packets/waveB/D01_content_en.md`.
- Launch mode: `SEED LINES PENDING`, decision 0014. The ten moments guided situations, and the three worked examples guided tone. No Ahmed seed lines were authored, completed, quoted, or attributed to him.
- Outputs: `fleet/outbox/D01/shard.jsonl` and this `fleet/outbox/D01/RESULT.md` only.
- Shard: 100 UTF-8 JSONL records, 107249 bytes, final newline, no blank lines. IDs are exactly `D01-0001` through `D01-0100`.
- SHA-256: `db56359d2459705f9f3fcf71fb339df9701bb8fe332f14dec14bda516ed67616`.

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

| User turns per row | Rows |
|---|---:|
| 1 | 70 |
| 2 | 20 |
| 3 | 10 |

There are 140 assistant turns. Budgets were checked separately for every assistant turn, including drafts and code.

| Tier | Maximum assistant words | Hard maximum |
|---|---:|---:|
| low | 37 | 60 |
| medium | 76 | 200 |
| high | 169 | 600 |

## Coverage and key decisions

All rows retain content mood with zero consecutive empty days and no current burrow. The moment map was adapted to this assignment rather than fabricating incompatible states:

- Morning with no steps: D01-0001.
- Grateful after a long walk: D01-0024.
- Future hot-day shelter, safe cooling checks, and indoor alternatives: D01-0071. This is explicitly hypothetical, not a current burrow.
- Sleepy, short creature voice: D01-0003 and D01-0034.
- Warm company after exceeding an average: D01-0017, without claiming a mood transition.
- Useful high-energy plans, messages, code, and other help: the high rows in each practical intent.
- Goodnight with optional tomorrow plans: D01-0031 through D01-0040.
- New spore introduction without past memories: D01-0091.
- Grounded recall from previous days and older chats: D01-0084 through D01-0090.
- Kindness if wilting after two empty days: the conditional discussion in D01-0097, without pretending to be wilting now.

Actual affectionate, burrowed, and wilting snapshots belong to their assigned mood shards. No schema exception was needed here.

Stages are Spore 23, Sprout 24, Truffle 26, and Elder 27. Weather spans all ten permitted cities, with explicit local times and plausible safe-day temperatures. Outdoor suggestions are optional, indoor steps count equally, and sunset is not treated as a safety guarantee.

## Memory and independent validation

Executed inline `python3 -I -` audit programs without writing auxiliary files. These checked:

- Exact top-level and message keys, string contents, alternating roles, unique sequential IDs, and the full quota matrix.
- Exact four-line canonical system layout and field ordering, with no additional text outside the prescribed memory section.
- Exactly 10 memory rows, each with one correctly placed section; no memory section on the other 90 rows.
- Exactly one blank line before the four-line memory section, exact marker and note text, a single-line JSON list, and no trailing system content.
- 20 memory facts total: three rows with one fact, four with two facts, and three with three facts. Fact lengths range from 40 to 82 characters.
- Low memories explicitly come from earlier today. Medium memories explicitly come from the current week or two to three days ago. High memories are older facts on sufficiently established Elder snapshots.
- Valid tier ranges, safe multi-turn energy margins after reply deductions, plausible stage/age/step combinations, and nighttime weather for every night check-in.
- No forbidden dashes anywhere in conversation roles. User and assistant text both passed the leak, body, guilt, and medical lexical scans.
- Complete low-tier responses, usable practical answers, grounded memories, no fabricated saved memories or scheduled reminders, and no invented feeding or weather transitions.

Highest within-shard normalized assistant 3-shingle Jaccard was **0.0390**, between D01-0040 and D01-0079, below the 0.8 rejection threshold. There were also no near-duplicates against the three worked examples. S09 supplied failure patterns only, not training prompts or transcripts.

### Embedded code checks

Extracted snippets directly from the shard and executed Python with `exec` and JavaScript with `node -e`. All passed:

- D01-0054: three first-item/default cases.
- D01-0055: trimming result and unchanged source string.
- D01-0057: included assertion, blank/case/empty input cases, and input preservation.
- D01-0058: included interval tests plus negative endpoints, duplicates, disjoint intervals, list pairs, and input preservation.
- D01-0059: all three turns together, missing/blank project names, ordering, unusual keys, summary counts, empty input, and frozen-input non-mutation.
- D01-0056: static CSS check for one-column default, two columns starting at 600px, and the gap. Manual review corrected the initial breakpoint arrangement to also handle fractional widths below 600px. No browser rendering is claimed.

Runtime versions: Python 3.12.3 and Node v22.23.3.

## Mandatory self-check

Run from `/home/abied/Desktop/Truffle` after the final edit:

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D01/shard.jsonl' --dry
```

Exit status: 0. Complete final report follows. Train and hold-out counts are the filter's dry-run simulation, not generated output files.

```text
# Truffle data filter report

Sources: `fleet/outbox/D01/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| D01 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 28 | 0 | 0 |
| medium | 27 | 0 | 0 |
| high | 25 | 0 | 0 |
```

## Scope, cost, and remaining work

- No protected inputs were edited. All 14 required reference files retained their initial SHA-256 hashes. Application code, seed file, schema, filters, examples, and other agents' outputs were untouched.
- No commit or push was made. No train or hold-out files were written.
- No unresolved row-level issue was identified. Automated checks are not a substitute for the integrator's semantic review.
- Cross-shard deduplication, target-tokenizer/runtime evaluation, and global train/hold-out construction remain with the integrator.
- No external inference or paid GPU jobs were launched. Additional paid-run cost: $0. Agent-session billing is not exposed by this harness.
