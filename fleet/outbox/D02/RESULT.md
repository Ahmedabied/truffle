# D02 result

Completed: 100 original rows written, 100 kept, 0 dropped. All required intent-by-tier quotas pass.

## Assignment and scope

- Assignment: `mood=content`, `lang=ar`, `shard=D02`.
- Launch mode: `SEED LINES PENDING`, decision 0014. The ten moments guided situations; the three worked examples guided tone. No Ahmed seed lines were authored, completed, or attributed.
- Output: `fleet/outbox/D02/shard.jsonl`, UTF-8 JSONL with 100 nonempty lines and a final newline.
- IDs: `D02-0001` through `D02-0100`, unique and sequential.
- Read the packet and every required input, including all seven lexical filter files. S09 was used only to understand failure patterns, not as training text.
- Only `fleet/outbox/D02/shard.jsonl` and this report were written. No protected inputs were edited. No commit or push was made.

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

| User turns per row | Rows | Total messages per row |
|---|---:|---:|
| 1 | 70 | 3 |
| 2 | 20 | 5 |
| 3 | 10 | 7 |

Total assistant turns: 140.

| Tier | Maximum assistant words | Hard maximum |
|---|---:|---:|
| low | 24 | 60 |
| medium | 60 | 200 |
| high | 136 | 600 |

Words were counted separately for every assistant turn, including drafts and code.

## Independent checks

An inline `python3 -I -B` audit, separate from the production filter, checked:

- Exact top-level, message, and metadata keys; role alternation; IDs; assignment; and every intent-by-tier cell.
- Exact fixed persona header, ordered state grammar, fixed language line, and no extra system text.
- Exactly 10 memory sections, all on personal_memory rows, and none on the other 90 rows. Each section has the required blank line, opening marker, exact note, one-line JSON list, and closing marker. Each contains one or two nonempty facts shorter than 160 characters.
- Low memories explicitly come from earlier today, medium memories from within seven days, and high memories from supplied older chats. Unknown details remain unknown. No saved-memory or scheduled-reminder promises.
- All states are content, zero_days=0, burrowed=no. Stage counts: Spore 1, Sprout 35, Truffle 42, Elder 22. Stage, recent averages, age, and current steps were reviewed for plausibility without treating age as a lifetime step counter.
- Every conversation stays within its original energy tier after allowing for all assistant-turn deductions. The zero-step morning retains existing positive energy; no row invents a new feeding event or a mid-conversation state transition.
- Weather is English, uses permitted real cities and local time descriptions, and ranges from 15C to 27C. Outdoor suggestions remain optional and conditional on appropriate conditions. Indoor steps count equally.
- No forbidden dash characters, visible state echoes, hidden-reasoning markers, literal backslash-n formatting errors, or slash-gender templates.
- Practical tasks finish within scope. Eight Python snippets were executed, including embedded tests and additional caller-input checks. The HTML example was checked with a Node VM and a minimal document stub: clicking the button updates the expected text. The print-quote calculation was independently verified.

Audit output:

```text
Independent audit: 100/100 pass exact layout, IDs, roles, metadata, intent-tier quotas, memory sections, no forbidden dashes, stable tiers and safe weather.
Turn counts: 1=70, 2=20, 3=10. Assistant turns=140.
Maximum assistant words: {'low': 24, 'medium': 60, 'high': 136}
Stage counts: {'Sprout': 35, 'Truffle': 42, 'Elder': 22, 'Spore': 1}
Memory rows: 10; low=3 today, medium=4 within seven days, high=3 older supplied facts.
Python snippets: 8/8 executed successfully, including embedded assertions and extra caller-input checks.
HTML/JavaScript click behavior: PASS
Print quote arithmetic: 52 vs 57, equality at 30 copies costing 44 each: PASS
```

## Situation coverage and decisions

- Morning hunger without new steps: D02-0001.
- Gratitude after at least 6,000 steps: D02-0024 and D02-0025.
- Low-energy, kind brevity: low-tier small talk and energy arguments.
- Warmth after exceeding the average: D02-0029, without changing the assigned content mood.
- Substantial useful help at high energy: high-tier practical rows.
- Goodnight with an optional future walk: night_check_in rows.
- First meeting as a new Spore with no memory: D02-0091.
- Grounded personal recollection: D02-0081 through D02-0090.
- Heat protection and wilting: D02-0095 and D02-0098 discuss those situations hypothetically. They do not pretend the current content state is burrowed or wilting.

No schema exception was needed. No unresolved shard-level drops or quota issues remain. Actual model-token counts were not measured; responses are deliberately below the word ceilings. Cross-shard deduplication, human voice review, and global train/holdout construction remain the integrator's responsibility.

Cost: no separately billed external API calls or GPU runs were launched. Agent token cost is not exposed by this session.

## Mandatory self-check

Run from `/home/abied/Desktop/Truffle`:

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D02/shard.jsonl' --dry
```

Exit status: 0. The complete final report follows. The train and hold-out counts below are the filter's dry-run projection only; no train or holdout files were written.

```text
# Truffle data filter report

Sources: `fleet/outbox/D02/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| D02 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 0 | 28 | 0 |
| medium | 0 | 27 | 0 |
| high | 0 | 25 | 0 |
```
