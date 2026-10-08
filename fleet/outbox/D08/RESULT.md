# D08 result

PASS: 100 rows written, 100 kept by the required filter, zero drops for every reason.

## Assignment and deliverables

- Assignment: `mood=wilting`, `lang=ar`, `shard=D08`.
- Launch mode: `SEED LINES PENDING`, decision 0014. The ten moments supplied the situation map; the three worked examples supplied tone. No Ahmed seed lines were authored, completed, quoted, or attributed.
- Output: `/home/abied/Desktop/Truffle/fleet/outbox/D08/shard.jsonl` and this report.
- IDs: `D08-0001` through `D08-0100`, unique and sequential.
- Encoding: UTF-8 JSONL, one object per line, final LF, no blank lines or CR characters.
- Shard SHA-256: `2df4d5c60a3e5ecb18f3982baab1c650fdb964a2ef5d197b4e6b7e85569a19ef`.

## Exact production counts

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

Turn distribution: 70 single-turn, 20 two-turn, 10 three-turn conversations. Total assistant turns: 140.

| Tier | Maximum assistant words per turn | Hard maximum | Maximum assistant characters |
|---|---:|---:|---:|
| low | 18 | 60 | 117 |
| medium | 48 | 200 | 280 |
| high | 77 | 600 | 522 |

All counts include quoted drafts and code. Higher-energy answers remain concise to preserve the wilting voice, while delivering complete requested tasks.

## Independent verification

An inline `python3 -I -` audit independently checked:

- Exact top-level and message keys, alternating roles, assignment metadata, all quota cells, sequential IDs, and turn distribution.
- Exact persona header, state field order, language line, LF layout, and absence of additional system text.
- Every snapshot has wilting mood, two or three zero days, positive energy, and no burrowing. Today's steps fund the recovered energy. Applying all conversation deductions leaves each row within its assigned tier.
- Safe current weather with English descriptions, real cities, and local times. Night check-ins have nighttime snapshots. Large-feed morning snapshots were moved to late afternoon for plausibility.
- Spore snapshots have fewer than 5,000 steps, zero prior average, and ages consistent with their zero-day counts. Older memories do not predate their creature's age. One memory snapshot was corrected before final verification to accommodate a three-week-old fact.
- Exactly 10 memory sections, only on personal_memory rows: 3 low, 4 medium, 3 high. Each uses the exact marker, note, JSON-list, and closing-marker layout after one blank line, with nothing afterward. There are 11 facts total, one or two per row; the longest is 85 characters. Low facts are from earlier today, medium facts from the last four days, and high facts from older chats.
- Full user and assistant text scans found no lexical safety hits, thinking leaks, state echoes, or literal escaped-newline mistakes. No U+2013 or U+2014 occurs in either output file.
- Within-shard normalized assistant 3-shingle Jaccard maximum: 0.0408, between D08-0084 and D08-0015, below the 0.8 rejection threshold.
- All six practical_code rows were executed in memory. Python examples passed conversion, joining, counting, stable deduplication, empty-input, order, and source-preservation checks. JavaScript examples passed filtering and storage tests covering absent, malformed, scalar, object, mixed-element, valid, and inaccessible storage. Node version: `v22.23.3`. No test scripts or caches were written.
- Manual content review checked complete low-tier replies, useful plans and drafts, optional outdoor advice, equal treatment of indoor steps, honest effort limits, grounded memories, and no claimed state transitions or scheduled reminders.

Independent audit output:

```text
PASS: 100 exact-layout rows, unique IDs, all quotas, 70/20/10 turns, 140 assistant turns.
PASS: 10 memory rows, 11 facts, maximum fact length 85 , tier windows and age consistency.
PASS: funded recovery snapshots, stable conversation tiers, safe temperatures, plausible Spore growth.
PASS: six code rows executed; Python edge cases and JavaScript empty, invalid, mixed, valid, inaccessible storage cases.
PASS: full-role lexical, leakage, literal-newline, and dash scans.
Maximum assistant words: {'low': 18, 'medium': 48, 'high': 77}
Maximum assistant characters: {'low': 117, 'medium': 280, 'high': 522}
Maximum within-shard assistant Jaccard: 0.0408 between D08-0084 and D08-0015
SHA256: 2df4d5c60a3e5ecb18f3982baab1c650fdb964a2ef5d197b4e6b7e85569a19ef
```

## Situation coverage and schema decisions

No schema exceptions were used. Situations that would conflict with a wilting snapshot were adapted rather than changing the assignment:

- Morning: D08-0001 has a small existing feed before the main outing. A literal zero-step morning after a zero-energy midnight cannot support a positive-energy wilting call.
- Gratitude after a long walk: D08-0036 and D08-0076 use 6,300 and 9,200 steps respectively.
- Dangerous heat: D08-0063 discusses a hypothetical protected burrow day, indoor alternatives, and checking actual conditions after sunset. It does not claim current burrowing.
- Sleepy brevity: D08-0003 and D08-0011.
- Quiet affection after exceeding the usual average: D08-0042 and D08-0077, without claiming a mood upgrade.
- Real high-energy help: D08-0085 through D08-0092.
- Goodnight and optional future walks: the ten night_check_in rows.
- First meeting: D08-0033 is a two-day-old Spore meeting the user without memory, not an impossible newborn wilting state.
- Older personal recall: D08-0067 through D08-0070 and D08-0096 through D08-0098.
- Kindness during wilting: D08-0005, D08-0035, and D08-0099, with the assigned mood retained across all rows.

## Required self-check

Working directory: `/home/abied/Desktop/Truffle`.

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D08/shard.jsonl' --dry
```

Complete final report:

```text
# Truffle data filter report

Sources: `fleet/outbox/D08/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| D08 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 0 | 28 | 0 |
| medium | 0 | 27 | 0 |
| high | 0 | 25 | 0 |
```

The 20/80 split is the filter's dry-run preview only. No training or holdout files were created. Cross-shard deduplication and global train/holdout construction belong to the integrator.

## Scope, cost, and remaining review

- No protected inputs were edited. All 14 requested reference files matched their initial SHA-256 hashes after generation and verification, including the seed, schema, filter, seven lexical lists, examples, product and fleet documents, and S09 result.
- S09 was consulted for failure patterns only. No S09 prompts or transcripts were used as training examples.
- Only the two assigned D08 output files were written. Concurrent changes from other shard agents were left untouched. No commit or push was made.
- External API and GPU cost: $0. No external paid calls or infrastructure were used. The authoring session's model cost was not measured.
- No unresolved schema or filter failures. Arabic naturalness and eventual seed-voice alignment still require human review. Actual model-token counts were not measured; the short replies provide headroom but are not a tokenizer-based runtime-cap proof.
