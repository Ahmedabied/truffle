# D15 result

Completed 100 original conversations. The final filter kept all 100, with zero drops for every reason.

## Assignment and scope

- Packet: `fleet/packets/waveB/D15_tired_mixed.md`.
- Assignment: `mood=tired`, `meta.lang=mixed`, `shard=D15`.
- Launch mode: `SEED LINES PENDING`, decision 0014. The ten situations guided coverage and the three worked examples guided tone. No Ahmed seed lines were authored, completed, attributed, or copied.
- Outputs: `fleet/outbox/D15/shard.jsonl` and this report only.
- All required references were read, including all seven lexical files. S09 was used only for failure patterns. D05, D06, and S13 training text was not read or reused.
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

There are 140 assistant turns. Maximum whitespace-separated assistant words per turn: low 26, medium 61, high 160. All turns are complete and below their tier budgets.

Block languages: 88 `ar`, 12 `en`. Every opening request contains Arabic and English, and every conversation includes mixed-script assistant text. English drafts and code occur in the requested tasks, with conversational Arabic around them.

Stages: Spore 13, Sprout 35, Truffle 34, Elder 18. Weather covers all ten permitted cities, with safe current conditions and explicit local times.

## Independent validation

An inline `python3 -I -` audit independently checked:

- Exactly 100 UTF-8 JSONL rows, final newline, no blank rows or CRLF, only the required top-level and message fields.
- Unique sequential IDs `D15-0001` through `D15-0100`, assignment metadata, the full tier-by-intent matrix, and 70/20/10 turn distribution.
- Exact persona header, field order and state grammar, language line, and no extra system text.
- All snapshots are tired with one zero day and no burrow. Energy matches the tier, today's steps cover current energy and conversational spending, and no multi-turn row crosses its tier boundary after deductions.
- Plausible stages, ages, averages, funded steps, named cities, safe temperatures, and night timing for all night check-ins.
- Exactly 10 memory sections, only on personal_memory rows, with exact markers, note line, JSON list line, and closing marker. There are 15 facts total, with 1 or 2 facts per section and a maximum fact length of 105 characters.
- Low memory facts are from earlier today; medium facts are from the last six days; high facts are older and fit the creature's age. Replies do not invent remembered events, claim facts were saved, or promise reminders.
- No prohibited dash characters in any role. No visible reasoning tags, state echoes, or internal-instruction commentary.
- Both user and assistant messages pass the body, guilt, and medical lexical lists.

Within-shard maximum assistant-text word 3-shingle Jaccard similarity was 0.0202, between D15-0019 and D15-0055, well below 0.8. Cross-shard deduplication remains the integrator's responsibility.

Practical verification used inline Python and Node subprocesses, without extra output files:

- D15-0020: Python last-item lookup tested on empty, single-item, and multi-item lists.
- D15-0057: Python filename filtering executed and its result checked.
- D15-0089: Python grouping assertions executed, with additional repeated-name and trailing-dot checks.
- D15-0090: JavaScript sorting, invalid times, equal-time stability, empty input, and original-array preservation tested in Node. Assertions were made fatal in the test runner.
- D15-0021: Button click and Arabic text follow-up executed with a mocked DOM.
- D15-0058: CSS brace checks and manual responsive-grid review. No browser execution is claimed.
- D15-0023 and D15-0091: Pagination, print totals, and the integer price crossover verified.

Semantic review checked optional, weather-aware outings, equally counted indoor steps, kindness after declining a walk, completed low-tier help, bounded effort, grounded memory, and no invented state transitions.

## Situation coverage and schema decisions

No schema exceptions were used. This is a tired shard, not a just_woke shard.

- Morning energy and breakfast: D15-0001 and D15-0035.
- Grateful after a long walk: D15-0041 and D15-0076.
- Heat protection, shelter, and genuinely safe later conditions: D15-0071, explicitly hypothetical rather than a false current burrow.
- Sleepy short humor: D15-0011 and other low small-talk rows.
- Company after beating the average: D15-0077, without claiming a mood update.
- Real high-energy help: D15-0085 through D15-0092.
- Goodnight and optional tomorrow walks: all ten night_check_in rows.
- First conversation with a small spore and no shared history: D15-0033. It was paired yesterday, preserving the required tired snapshot.
- Grounded older recollection: D15-0067 through D15-0070 and D15-0096 through D15-0098.
- Kindness during a hypothetical second zero day: D15-0072, without changing the actual one-zero-day snapshot.

A literal current tired snapshot with no steps after a zero-energy midnight cannot fund a reply. The no-steps morning situation therefore appears as a hypothetical in D15-0035, rather than an unfunded state. Hot-day and two-zero-day situations are likewise discussed hypothetically so all rows retain the assigned mood.

## Final self-check

Run from `/home/abied/Desktop/Truffle`:

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D15/shard.jsonl' --dry
```

Complete final report follows. The train and hold-out counts are dry-run calculations only; no split files were written.

```text
# Truffle data filter report

Sources: `fleet/outbox/D15/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| D15 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 0 | 0 | 28 |
| medium | 0 | 0 | 27 |
| high | 0 | 0 | 25 |
```

## Cost and remaining review

- No paid external API, model, or GPU calls were launched. Validation used local Python and Node only. Agent-session usage was not separately metered.
- No unresolved filter drops, quota mismatches, or layout failures remain.
- Ahmed's voice lines remain pending, and no human naturalness rating is claimed. The shard still needs the normal integrator review.
- Actual Gemma tokenizer output lengths were not measured. Responses are deliberately short; runtime token limits still need integration validation, especially for Arabic and code.
- Global cross-shard deduplication and train/hold-out construction are deferred to the integrator, as required.
