# D11 result

Completed: 100 original rows written, 100 kept by the final filter, zero drops for every reason.

## Assignment and scope

- Shard: D11. Metadata mood: `just_woke`. Language: `en`.
- Output: `fleet/outbox/D11/shard.jsonl` and this report only.
- Launch mode: `SEED LINES PENDING`, decision 0014. The ten moments guided situations and the three worked examples guided tone. Ahmed's lines were not invented, completed, quoted, or edited.
- Schema-first exception: all 100 rows are low tier, replacing the standard 35/40/25 tier mix. Every state has early morning weather and either `content` with zero quiet days or `tired` with one. Intent totals are unchanged.
- Night check-ins discuss the previous night or a future bedtime routine, not a current night. Hot-day shelter is discussed hypothetically without inventing a current burrow. Older personal details are recalled only when supplied as something learned earlier today.

## Counts

| Tier | Rows | Maximum assistant words per turn |
|---|---:|---:|
| low | 100 | 35 |
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

| User turns per row | Rows |
|---|---:|
| 1 | 70 |
| 2 | 20 |
| 3 | 10 |

There are 140 assistant turns, each containing 9 to 35 whitespace-separated words. State moods: 69 content, 31 tired. Stages: 25 Spore, 25 Sprout, 25 Truffle, 25 Elder. The shard covers all ten allowed cities, with explicit local times from 06:05 to 06:55 and energy from 8% to 20%.

## Independent verification

Read the full packet and every required input before generating. S09 was used only for its reported failure patterns, not its held-out prompts or transcripts.

Additional isolated Python checks, run through `python3 -I -`, passed:

- Exactly 100 nonempty UTF-8 JSONL lines, a final newline, no CRLF, and no extra top-level or message fields.
- Exact canonical persona header, state field order, language line, and system layout. No additional system instructions or trailing material.
- Correct role alternation, unique ordered IDs from `D11-0001` through `D11-0100`, assignment metadata, intent quotas, and the 70/20/10 turn distribution.
- All rows low tier and early morning, with consistent content or tired states and no current burrow. Tired snapshots have enough recorded steps to fund their energy. Multi-turn snapshots remain low after reply costs. Young Spore histories and first-meeting feeding totals were checked for plausibility.
- Ten personal-memory rows, containing 21 facts total. Each has exactly one section after one blank line, the exact marker and note text, one JSON-list line, and the closing marker. All other rows omit memory. Every fact is explicitly from earlier today, with one to four facts per row and a maximum fact length of 75 characters.
- No prohibited long dashes in any message. No visible state echoes, internal-instruction references, reasoning tags, or copied worked-example assistant answers.
- All assistant turns fit the low word budget. Manual review checked complete small tasks, optional weather-aware invitations, no invented recall or state transitions, and kindness after declining a walk.

A separate `python3 -I -` command extracted and exercised the Python snippets, including list cleanup, case-insensitive sorting, JSON parsing, missing keys, and malformed input. It tested the SQL query in an in-memory SQLite database and used `node -e` to check the JavaScript default for zero, null, undefined, and a positive number. All passed. The CSS grid example was reviewed for the requested single-child layout; no browser rendering test was run.

Protected-input verification passed with no diff:

```bash
git diff --exit-code -- finetune/data/schema.md finetune/data/examples.jsonl finetune/filter.py finetune/filters finetune/seed/TRUFFLE_VOICE_SEED.md docs/01_product_spec.md docs/05_fleet_orchestration.md fleet/outbox/S09/RESULT.md
```

## Mandatory final self-check

Working directory: `/home/abied/Desktop/Truffle`.

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D11/shard.jsonl' --dry
```

Exit status: 0. Complete final report:

```text
# Truffle data filter report

Sources: `fleet/outbox/D11/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| en | 100 | 20 | 80 |

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
| D11 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 80 | 0 | 0 |
| medium | 0 | 0 | 0 |
| high | 0 | 0 | 0 |
```

## Handoff, limits, and cost

- No unresolved local schema or filter failures. The reported train and hold-out counts are dry-run calculations only; no split files were written.
- Cross-shard deduplication and global train/hold-out construction belong to the integrator and were not performed here.
- Exact Gemma token counts and runtime generation were not measured. Answers were kept short, with a maximum of 35 words including code and drafts.
- No paid external API requests or GPU jobs were launched. Harness inference cost is not exposed here.
- No protected inputs were edited. No commit or push was made.
