# D10 result

Completed: 100 rows written, 100 rows kept, zero drops in every filter category.

## Assignment and scope

- Assignment: mood `burrowed`, language `ar`, shard `D10`.
- Launch mode: `SEED LINES PENDING`, decision 0014. The ten moments supplied the situation map; the three worked examples supplied the tone. No lines were authored for Ahmed, attributed to him, or added to his seed file.
- Deliverables: `/home/abied/Desktop/Truffle/fleet/outbox/D10/shard.jsonl` and `/home/abied/Desktop/Truffle/fleet/outbox/D10/RESULT.md` only.
- Read the packet and all required references. S09 was used only to identify failure patterns, not as training text.
- No protected inputs were edited. No commit or push was made.

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
| **Total** | **35** | **40** | **25** | **100** |

| User turns per row | Rows |
|---|---:|
| 1 | 70 |
| 2 | 20 |
| 3 | 10 |

There are 140 assistant turns. Maximum whitespace-separated assistant words per turn, including drafts and code:

| Tier | Observed maximum | Hard maximum |
|---|---:|---:|
| low | 24 | 60 |
| medium | 48 | 200 |
| high | 106 | 600 |

## Independent checks and semantic review

An additional `python3 -I -B -` stdin audit checked the serialized shard independently of the filter's schema validator:

- Exactly 100 nonblank UTF-8 JSONL records, final newline, no CR characters, exact top-level and message keys, and alternating roles.
- Unique sequential IDs `D10-0001` through `D10-0100`, exact assignment, all 30 intent/tier quota cells, and the 70/20/10 turn distribution.
- Exact canonical system header, ordered state grammar, fixed language line, and no extra system text.
- Exactly ten memory rows and no memory sections elsewhere. Each section has the exact markers and note line, one JSON list line, and nothing after its closing marker. There are 13 facts total, one or two per memory row; the longest fact is 71 characters.
- Low memories are explicitly from earlier today. Medium memories are from one to four days ago. High memories are older, with snapshot ages sufficient to support the stated history. Memory ages in rows 0089 and 0090 were corrected during semantic review before the final check.
- All snapshots are burrowed and explicitly supply apparent temperature from 42C to 47C. Night check-ins use hot nighttime weather, not an assumed cool sunset.
- Recovered energy can be funded by the day's steps wherever the zero-day counter is nonzero. All conversations can afford their replies without crossing their assigned tier.
- Stage distribution: Spore 25, Sprout 27, Truffle 24, Elder 24. Zero-day distribution: 0 on 28 rows, 1 on 24, 2 on 25, 3 on 23.
- Eight cities: Dubai 16, Sohar 15, Muscat 15, Nizwa 12, Riyadh 11, Phoenix 11, Kuala Lumpur 10, Salalah 10.
- All user and assistant turns passed the lexical and leakage scans. All assistant turns passed the burrow safety check. No prohibited dash characters occur in any role or this report.
- Maximum within-shard normalized assistant-text 3-shingle Jaccard similarity is 0.04, below the 0.8 rejection threshold.
- Manual review covered completed low-tier answers, natural follow-ups, grounded memory use, unchanged state snapshots, optional movement, indoor alternatives, and refusal of current outdoor walking. Later outdoor plans require genuinely safe conditions rather than sunset alone. Protected hot days are explained without promising unlimited chat.

The situation map includes the hungry morning with no steps in 0001, low-energy humor in 0002, gentle company after two zero days in 0003, gratitude after 7,800 indoor steps in 0024, affection without pressure after beating the average in 0026, high-energy practical work in 0046 through 0059, goodnights in 0031 through 0040, heat alternatives in 0066 through 0073, older memories in 0088 through 0090, and a first meeting with a new spore in 0091. Burrowed mood remains authoritative in all of them.

## Practical code verification

A separate `python3 -I -B -` stdin test extracted code directly from the final shard without creating auxiliary files:

```text
PASS: Python snippets 54, 56, 58 executed with examples and edge cases
PASS: JavaScript snippets 55 and all revisions in 59 executed under Node
PASS: CSS snippet 57 structurally checked and manually reviewed; no browser rendering test
```

Python checks cover empty lists, first-element selection, ordered deduplication, whitespace cleanup, chunk remainders, and invalid sizes. Node checks cover title normalization, search behavior, the changed empty-query behavior, and independent result arrays.

## Mandatory self-check

Working directory: `/home/abied/Desktop/Truffle`.

Exact command:

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D10/shard.jsonl' --dry
```

Exit code: 0. Complete final report follows. The train and hold-out counts are dry-run previews only; no train or hold-out files were written.

```text
# Truffle data filter report

Sources: `fleet/outbox/D10/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| D10 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 0 | 28 | 0 |
| medium | 0 | 27 | 0 |
| high | 0 | 25 | 0 |
```

## Exceptions, remaining work, and cost

- No schema exception was used. There are no unresolved local validation failures.
- Ahmed's seed lines remain pending. These are original expansion examples, not approved quotations or a claimed human Arabic naturalness score.
- Exact model-token counts were not measured; all assistant turns remain well below the word maxima. CSS was not rendered in a browser.
- Cross-shard deduplication, final review, and global train/hold-out construction belong to the integrator. This shard's dry-run split is not the global training split.
- No paid API calls, GPU jobs, downloads, or deployments were launched. Additional external compute cost: $0. The coding-session model cost was not exposed by the harness.
