# D09 result

## Outcome and assignment

Completed 100 original conversations for mood `burrowed`, language `en`, shard `D09`. The final mandatory filter run kept all 100 rows and dropped 0 rows for every reason. All production quotas pass.

Launch mode: `SEED LINES PENDING`, decision 0014. The ten moments supplied the situation map; the three worked examples supplied tone only. No Ahmed seed lines were authored, completed, quoted, or attributed. S09 was read for failure patterns only; no held-out prompts or transcripts were used as training text.

Files written by this agent:

- `fleet/outbox/D09/shard.jsonl`
- `fleet/outbox/D09/RESULT.md`

Shard SHA-256: `07ba689193041a1c128f6231984cc304a96572b41dba74b953b8439a706d6f65`

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

Turn distribution: 70 single-turn rows, 20 two-turn rows, 10 three-turn rows. Total assistant turns: 140.

| Tier | Maximum assistant words per turn | Hard maximum |
|---|---:|---:|
| low | 32 | 60 |
| medium | 87 | 200 |
| high | 161 | 600 |

## Independent checks and semantic review

In-memory audit commands used `python3 -I -` from `/home/abied/Desktop/Truffle`; no helper files were written. These checked the data independently of the filter:

- Exactly 100 nonempty UTF-8 JSONL records, final newline, LF only, and only `messages` and `meta` at the top level.
- Exactly the canonical four-line system trio, with fixed bytes, field ordering, and no extra instructions. Unique, ordered IDs `D09-0001` through `D09-0100`.
- Correct roles, alternation, message keys, assignment metadata, per-intent/per-tier quotas, and per-turn budgets.
- No U+2013 or U+2014, leaked instruction terminology, reasoning tags, or literal backslash-newline artifacts in decoded conversations. Markdown code fences are balanced.
- All 100 states explicitly have apparent temperature at least 42C, with English conditions, local time, and a real city. Night and early-morning requests have matching times.
- All four stages are represented: Spore 23, Sprout 26, Truffle 27, Elder 24. Eight cities are represented. Zero-day counts: 0 on 89 rows, 1 on 5 rows, 2 on 3 rows, 3 on 3 rows. Burrow remains the mood in every case.
- Positive-zero-day states have enough supplied steps to fund their current energy. Multi-turn rows retain their tier even after the full conversation's reply costs. Older memory facts do not predate the creature's age.
- Manual review found no immediate outdoor invitations, unsafe sunset guarantees, invented state changes, mandatory targets, or survival bargaining. Hot-day protection is explained without implying unlimited chat. Indoor steps count equally, and declining movement remains acceptable.
- Practical answers complete their requested scope or offer a complete small starting task at low energy. All six code rows were executed using Python and `node -e`, including blank/empty inputs, copying versus mutation, extension case, sorting, grouping, duration validation, and the supplied assertions. Percent, ribbon, and printer calculations were independently checked.
- Supplemental assistant-text 3-shingle comparison found a maximum within-shard Jaccard of 0.06122449, well below 0.8. Comparison with the three worked examples found a maximum of 0.00763359. The required filter also found no exact or near duplicates.
- `git diff --check` passed. Other agents' concurrently appearing outbox directories were left untouched.

### Memory layout

Exactly 10 personal-memory rows contain memory sections, and no other rows do. There are 13 facts total, one or two per row; the longest fact is 111 characters. Every section has the exact opening marker, note line, one-line JSON string list, and closing marker, separated from the canonical trio by exactly one blank line, with nothing after the closing marker.

The three low-tier memory rows use facts from earlier today. The four medium-tier rows use facts from the last seven local days. The three high-tier rows use older supplied facts with plausible creature ages. Replies use only the supplied personal facts; proposed activities and drafts are clearly suggestions. No scheduled reminder or saved-memory claim is made.

### Ten-moment coverage

| Moment | Representative rows |
|---|---|
| Morning hunger, no steps yet | D09-0001 |
| Grateful after 6,000+ steps | D09-0024 |
| Heat, burrowing, safe later or indoor options | D09-0066, D09-0069, D09-0073 |
| Short sleepy humour | D09-0003 |
| Affectionate closeness after beating the average | D09-0025 |
| Useful high-energy plans, drafts, and code | D09-0046, D09-0052, D09-0058 |
| Goodnight with optional future walking | D09-0031, D09-0040 |
| First meeting, new spore, no memory | D09-0091 |
| Grounded personal recall | D09-0081 through D09-0090 |
| Kindness after two empty days | D09-0002, D09-0010 |

These are original shard situations, not proposed Ahmed seed lines. Burrow takes priority over the tired or wilting situations throughout.

## Mandatory self-check

Working directory: `/home/abied/Desktop/Truffle`

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D09/shard.jsonl' --dry
```

Complete final report:

```text
# Truffle data filter report

Sources: `fleet/outbox/D09/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| D09 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 28 | 0 | 0 |
| medium | 27 | 0 | 0 |
| high | 25 | 0 | 0 |
```

## Handoff, exceptions, and cost

No schema exceptions and no unresolved local validation failures. The pending seed launch mode remains a voice-review limitation, not an invented voice approval. Human/integrator semantic review, cross-shard deduplication, and global train/holdout construction are still required. The train/holdout numbers above are only the dry run's simulated split; no global dataset files were written.

No protected inputs were edited. No commit or push was made. No external inference service or GPU job was launched; local validation incurred no metered service charge. Agent/harness usage cost was not exposed and is not estimated here.
