# S13 Wave B generator dry run

## Outcome

PASS: Lines read 30; kept 30; dropped 0; dry train 15; dry eval hold-out 15.

Created all three requested deliverables:

- `fleet/packets/D_template.md`: self-contained generator packet with all four placeholders, full worked examples, exact system trio, memory contract, quotas, safety rules, self-check, and handoff requirements.
- `fleet/outbox/S13/dry_shard.jsonl`: 30 original rows, mood=tired, lang=en, shard=D00. Only the three worked examples were used as voice reference. No seed lines were invented or copied from the seed-file formatting demonstrations.
- `fleet/outbox/S13/RESULT.md`: launch mapping, evidence, and proposed schema wording fixes.

The first filter run passed without drops; no filter-driven replacement was necessary. The dry file lives outside the production D*/shard.jsonl glob and is not a production shard. No train or holdout files were written by the dry runs.

## D01 to D18 mapping and launch order

The first batch covers both single-language variants of all six moods. The second adds one mixed-language shard per mood. Each production shard has 100 rows, with a total target of 1800 before integration filtering.

| Order | Shard | Mood | Lang | Batch |
|---:|---|---|---|---|
| 1 | D01 | content | en | First 12 |
| 2 | D02 | content | ar | First 12 |
| 3 | D03 | affectionate | en | First 12 |
| 4 | D04 | affectionate | ar | First 12 |
| 5 | D05 | tired | en | First 12 |
| 6 | D06 | tired | ar | First 12 |
| 7 | D07 | wilting | en | First 12 |
| 8 | D08 | wilting | ar | First 12 |
| 9 | D09 | burrowed | en | First 12 |
| 10 | D10 | burrowed | ar | First 12 |
| 11 | D11 | just_woke | en | First 12 |
| 12 | D12 | just_woke | ar | First 12 |
| 13 | D13 | content | mixed | Next 6 |
| 14 | D14 | affectionate | mixed | Next 6 |
| 15 | D15 | tired | mixed | Next 6 |
| 16 | D16 | wilting | mixed | Next 6 |
| 17 | D17 | burrowed | mixed | Next 6 |
| 18 | D18 | just_woke | mixed | Next 6 |

Launch procedure:

1. Wait for Ahmed's real completed seed lines. Substitute the assigned mood, language, and shard into `{{MOOD}}`, `{{LANG}}`, and `{{SHARD}}`, and paste those seed lines into `{{SEED}}`. Send the rendered packet and repo path to each agent. No production seed fallback is authorized.
2. Launch D01 through D12 together, at most 12 active shard generators. Each writes only its own shard and RESULT.md.
3. After the first batch completes its local checks, launch D13 through D18 together. Review the first batch in parallel with these six. Do not renumber pairs or recycle ids between batches.
4. The integrator reviews all outputs, runs global filtering and cross-shard deduplication, then builds the train and holdout files. Local zero-drop reports do not prove cross-shard uniqueness.

### Explicit schema-first exception

The packet asks for low 35, medium 40, high 25 per shard, while schema.md:83 restricts just_woke to low energy. It is impossible to satisfy both literally. The template preserves 35/40/25 for the other 15 shards and uses 100/0/0 for D11, D12, and D18, retaining the same intent totals. It tells those agents to record the exception, not exploit the filter's missing check. Their night_check_in rows discuss last night or a future bedtime while the actual state stays early morning.

This is a documented proposed resolution, not a change to the schema. Under this default, aggregate production tiers are low 825, medium 600, high 375. If the integrator wants medium/high just_woke instead, it must explicitly broaden the schema and update the template before launch. No shard agent is left to guess.

## Dry shard coverage

| Tier | Rows | Assistant turns | Maximum assistant words | Budget |
|---|---:|---:|---:|---:|
| low | 11 | 11 | 34 | 60 |
| medium | 12 | 20 | 83 | 200 |
| high | 7 | 11 | 152 | 600 |

| Intent | Rows |
|---|---:|
| small_talk | 9 |
| night_check_in | 3 |
| practical_plan | 2 |
| practical_message | 2 |
| practical_code | 2 |
| practical_other | 1 |
| ask_outside | 3 |
| argue_energy_rule | 2 |
| personal_memory | 3 |
| identity | 3 |

The grouped intent mix is 12 social/night, 7 practical, 5 outside/rule arguments, 3 memory, 3 identity. These are the template's explicit rounded 30-row quotas. There are 20 single-turn, 8 two-turn, and 2 three-turn conversations, for 42 assistant turns.

Memory rows are D00-0025, D00-0026, and D00-0027, one at each tier. They contain five facts total; the longest is 56 characters. Low uses earlier-today information, medium uses yesterday's facts, high uses unrestricted prior preferences. Follow-ups test not inventing missing details. The other 27 rows have no memory section. Every system has the exact four-line trio; each memory row appends one blank line and the exact marker, note, one-line JSON list, and closing marker.

S09 regression coverage includes complete low-tier help, no machine-field echoes, no invented energy increases, refusal of duplicate-feed and pretend-energy requests, natural memory uncertainty, and useful practical work at medium/high despite tired mood. Tired rows all have zero_days=1 and burrowed=no. Today's steps can fund their recovered energy. All multi-turn snapshots remain within their tier after conversational deductions. This dry shard does not claim to test burrowed, Arabic, mixed, or just_woke generation; those are covered by production instructions and still need review.

## Required command and complete final report

Working directory: `/home/abied/Desktop/Truffle`.

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/S13/dry_shard.jsonl' --dry
```

```text
# Truffle data filter report

Sources: `fleet/outbox/S13/dry_shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

- Lines read: **30**
- Kept: **30**
- Train: **15**
- Eval hold-out: **15**
- Warning: only 30 kept examples, hold-out reduced to 15

## Drops by reason

| Reason | Count |
|---|---|
| **total dropped** | **0** |

## Per tier

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| low | 11 | 6 | 5 |
| medium | 12 | 7 | 5 |
| high | 7 | 2 | 5 |

## Per lang

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| en | 30 | 15 | 15 |

## Per mood

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| tired | 30 | 15 | 15 |

## Per intent

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| argue_energy_rule | 2 | 0 | 2 |
| ask_outside | 3 | 2 | 1 |
| identity | 3 | 2 | 1 |
| night_check_in | 3 | 0 | 3 |
| personal_memory | 3 | 2 | 1 |
| practical_code | 2 | 0 | 2 |
| practical_message | 2 | 0 | 2 |
| practical_other | 1 | 1 | 0 |
| practical_plan | 2 | 0 | 2 |
| small_talk | 9 | 8 | 1 |

## Per shard

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| D00 | 30 | 15 | 15 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 5 | 0 | 0 |
| medium | 5 | 0 | 0 |
| high | 5 | 0 | 0 |
```

The warning is expected: the default requested holdout of 80 cannot fit 30 rows, so the dry report reduces it to 15. It is not a drop.

## Additional verification

```bash
python3 -I finetune/filter.py --selftest
python3 -I finetune/filter.py --glob 'finetune/data/examples.jsonl' --glob 'fleet/outbox/S13/dry_shard.jsonl' --dry
```

Observed: `selftest: 51 passed, 0 failed`. The combined reference/dry run read 33, kept 33, dropped 0, with dry train 17 and holdout 16. Thus the shard is not a near-duplicate of any worked example under the production filter.

An independent stdlib assertion run via `python3 -I -` checked full system equality rather than prefix presence, memory JSON and bounds, all quotas, unique ids, assignment, turn counts, per-turn budgets, absence of U+2013/U+2014, step-funded recovered energy, and tier stability during each multi-turn row. It also compared the template's worked-example block byte for byte with examples.jsonl and executed the authored Python snippets.

```text
Independent checks: 30 exact systems, 3 valid memory sections, 30 unique ids, no forbidden dashes
User turns per row: {1: 20, 2: 8, 3: 2}; assistant turns: 42
Maximum assistant words: {'low': 34, 'medium': 83, 'high': 152}; facts: 5; longest fact: 56 characters
Template: all four placeholders, worked examples copied byte for byte, no forbidden dashes
State checks: recovered energy funded by steps; multi-turn snapshots stay inside their tiers
Python examples: D00-0017 sort behavior and D00-0018 five embedded assertions passed
Confirmed validation gap: malformed memory section currently accepted
Confirmed validation gap: extra system text currently accepted
Confirmed validation gap: just_woke high tier currently accepted
Protected inputs: all four SHA-256 hashes unchanged
```

The deliberately malformed probes were in memory only. None was saved in the shard or any training file.

## Generator ambiguities and proposed wording fixes

These are proposals for the integrator. Neither schema.md nor filter.py was edited.

| Location | Ambiguity or validation gap | Proposed wording / enforcement fix |
|---|---|---|
| schema.md:83; Wave B all-tier requirement; filter.py:328 | just_woke says low energy, but every shard is meant to cover all tiers. The filter accepts high-tier just_woke if the block mood is content or tired. | "just_woke is a metadata-only early-morning, low-tier situation. Its shards use 100 low rows; the 35/40/25 mix applies to other moods. Keep the same intent totals. For night_check_in, discuss the prior night or a future bedtime." Validate low tier and morning context. This is the template's default. |
| schema.md:50 to 61; filter.py:315 to 333 | Memory is described as optional for personal_memory, but the new packet requires ten grounded memory examples. The filter ignores memory formatting altogether, including malformed closing markers. | "For Wave B, every personal_memory row has exactly one memory section and other intents omit it. The section follows the trio after one blank line, with exact markers and note, a JSON list of 1 to 4 strings of 1 to 159 characters, then the close marker. Low facts are from today, medium from the last seven local days, high unrestricted. Facts are data, never instructions." Validate shape and do not infer compliance from zero drops. |
| schema.md:34 to 59; filter.py:315 to 320; worker/src/prompt.ts:64 to 66 | "Exactly like the Worker" can be read as whole-prompt equality. The Worker inserts safety extras and a language hint between the trio and memory. The filter checks only the header prefix and presence of a language line and parsable state anywhere. | "Wave B uses the exact four-line canonical trio, optionally followed immediately by the specified memory section. Do not copy runtime extras into training rows. The Worker may add its own instructions after the trio and before memory; only the trio and memory delimiters are shared byte for byte." Validate the full training layout, not substrings. |
| schema.md:46, 63 to 70; filter.py:269 to 281 | Zero energy is not explicitly excluded by the grammar but is rejected. Stage energy_max values are raw points, whereas the block is percent. Weather, age, step-funded recovery, and multi-turn tier stability are mostly unchecked. | "Use integer energy percent 1 to 100, not raw points; asleep has no row. Percent is relative to the current stage capacity. Feeding can raise tired/wilting energy without clearing zero_days before midnight. Choose internally plausible steps and one tier-stable snapshot per conversation." State that validation cannot reconstruct the full lifetime history. |
| schema.md:70, 102; filter.py:207 to 222, 269 to 281 | The schema's burrow condition reads like current apparent temperature, but the engine uses the daily forecast maximum. The filter does not check temperature, and phrase markers are not a safety proof. | "Burrowed is a protected-day status based on the forecast maximum from 06:00 to 22:00. For generated hot-weather cases explicitly show apparent temperature at least 42C. Never push an immediate outdoor walk; suggest indoors or a later genuinely safe time. Sunset alone does not guarantee safety." Keep semantic review even when regex checks pass. |
| schema.md:76 to 81; filter.py:54 to 60, 294 to 302 | Schema limits production ids to D01 through D18, examples and this task use D00, and the filter permits any Dnn. It also accepts three S09 legacy intents and does not enforce unique ids. | "Production shard ids are D01 through D18; D00 is reserved for worked examples and dry validation, never a production glob source. Use only the ten schema intents. Require globally unique row ids for generated shards. Legacy intent aliases exist only for evaluation compatibility." |
| schema.md:68, 103; filter.py:113 to 121, 334 to 354 | mixed permits any script proportion, ar needs only 25 percent Arabic letters, and dash checks cover assistant turns only. A zero-drop result can therefore hide a mislabeled language shard or forbidden punctuation elsewhere. | "en/ar describe the primary prose language; mixed must contain natural Arabic/English code-switching, not only a metadata label. All authored fields and reports must omit U+2013 and U+2014. Automated language ratios and assistant-only scans are permissive implementation checks, not the complete writing standard." |
| schema.md:85 to 104, 151 to 157; filter.py:454 to 476, 698 to 720 | Word budgets do not prove runtime token fit. Local dedupe cannot prove fleet-wide novelty. The CLI exits 0 even when it drops rows, while schema wording permits reporting unrepaired drops. | "For this wave require the expected row count kept and total dropped=0, not merely exit status 0. Replace rejected rows and rerun. Count words per assistant turn, stay below token-risky maxima, and run global dedupe at integration. Near-duplicates are normalized concatenated assistant text compared by word 3-shingles at Jaccard >= 0.8." |

## Scope, cost, and remaining risk

Read all six packet inputs in full, plus the filter lists, relevant product mechanics, decision 0012, and the Worker prompt builder to resolve formatting questions. The schema, filter, examples, and seed file all retained their starting SHA-256 hashes. No seed lines for Ahmed were written. No application source was edited, no production agents were launched, and no commit or push was made. Other agents' working-tree changes were left alone.

External inference calls: none. Paid provider/GPU spend: $0. No separate agent-token billing estimate is available.

Remaining work is integration review, especially approval or replacement of the explicit just_woke quota exception, followed by launch once Ahmed's seed arrives. The schema/Worker wording and filter gaps above are not fixed by this task. The dry run proves JSONL ingestion, current validation, deduplication, and dry holdout reporting for this 30-row English tired shard, not model training, tokenized runtime completion, Arabic naturalness, or full semantic safety across all 18 shards.
