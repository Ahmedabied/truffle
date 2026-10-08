# D06 result

100 original rows written, 100 kept, 0 drops. All production quotas pass.

## Assignment and deliverables

- Assignment: `mood=tired`, `lang=ar`, `shard=D06`.
- Launch mode: `SEED LINES PENDING`, decision 0014.
- Output: `fleet/outbox/D06/shard.jsonl` and this report only.
- IDs: `D06-0001` through `D06-0100`, unique and consecutive.
- Read the packet and all required references before generation. S09 was used only for failure patterns, not prompts or training text.
- Ahmed's ten moments supplied the situation map; the three worked examples supplied tone. No seed lines were invented, completed, quoted, or attributed to Ahmed.

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
| Total | 35 | 40 | 25 | 100 |

| Tier | One user turn | Two user turns | Three user turns | Assistant turns | Maximum assistant words |
|---|---:|---:|---:|---:|---:|
| low | 27 | 6 | 2 | 45 | 22 |
| medium | 26 | 9 | 5 | 59 | 48 |
| high | 17 | 5 | 3 | 36 | 119 |
| Total | 70 | 20 | 10 | 140 | |

Word counts use whitespace splitting on every assistant turn, including code and drafts.

## State, memory, and voice checks

- Every state is `mood=tired zero_days=1 burrowed=no`, with positive energy and matching metadata.
- All four stages appear: 19 Spore, 34 Sprout, 27 Truffle, 20 Elder. Ten allowed cities appear, with English weather strings and explicit local time of day.
- Weather snapshots are synthetic safe-day conditions, 16C to 27C. Night check-ins have night or late-evening weather. Large recovered-energy snapshots avoid implausible early-morning totals.
- Today's steps can fund the stated recovered energy. Deducting every assistant turn's runtime energy cost leaves each conversation within its initial tier.
- Ten personal-memory rows have exactly one correctly placed memory section each. Other intents have none. There are 14 facts, one or two per section, with maximum fact length 72 characters.
- Memory sections have the exact opening marker, note line, one-line JSON list, and closing marker, with one blank line after the language line and no trailing instructions.
- Low memories are from earlier today, medium memories are within seven days, and high memories reach earlier months. Explicit memory ages fit the creature's age. Replies use supplied facts, distinguish suggestions from remembered facts, and avoid promises of saved memories or scheduled reminders.
- Natural follow-ups include declining walks, narrowing practical scope, adjusting drafts, testing code, and correcting where an item was found. No mid-row feeding or weather changes are invented.
- Reviewed for completed low-tier answers, ordinary Arabic address, useful high-tier tasks, indoor-step equivalence, safe optional outdoor advice, and honest energy limits. No visible state echoes, hidden reasoning, survival pressure, or invented capability upgrades.
- Both user and assistant text were additionally checked against the safety lexical lists and leakage patterns. No hits. Neither output file contains U+2013 or U+2014.

### Situation map within the tired assignment

- Morning greeting after a small feed: D06-0001. A literal zero-step tired morning would have no recovered energy, so no asleep row was fabricated.
- Gratitude after a long walk: D06-0036 and D06-0076.
- Dangerous heat and underground shelter: conditional explanations in D06-0063, D06-0073, and D06-0099, without claiming today's safe tired state is burrowed.
- Sleepy one-liner: D06-0002.
- Warm company after exceeding the average: D06-0038 and D06-0077, without claiming a mood transition.
- Useful high-energy help: D06-0085 through D06-0092.
- Goodnight and optional tomorrow plans: the ten night_check_in rows.
- First meeting without personal memory: D06-0033, a young Spore on its first surviving day.
- Grounded recall from earlier days: medium and high personal_memory rows.
- Two-day depletion: a hypothetical, kind explanation in D06-0075, not a fabricated wilting snapshot.

No schema exception was used. Scenarios requiring another current mood remain conditional rather than violating this assignment.

## Verification

Independent inline `python3 -I` checks, without writing helper files, verified exact JSON keys, canonical system ordering, role alternation, IDs, all intent-by-tier quotas, turn counts, word budgets, memory layout and time windows, weather timing, stage plausibility, funding, and post-conversation tier margins.

Additional inline Python checks executed all six practical-code rows using Python, `node -e`, and in-memory SQLite. They covered 13 Python/SQLite checks plus JavaScript trimming, numeric sorting, pagination, invalid inputs, input conversion, and preservation of original data. Appointment timing, the shared bill, and the printing-price comparison were also checked arithmetically. All passed.

`git diff --check` passed. No protected inputs were edited. No commit or push was made. Other agents' files were left untouched.

### Required self-check

Working directory: `/home/abied/Desktop/Truffle`.

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D06/shard.jsonl' --dry
```

Complete final report:

```text
# Truffle data filter report

Sources: `fleet/outbox/D06/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| D06 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 0 | 28 | 0 |
| medium | 0 | 27 | 0 |
| high | 0 | 25 | 0 |
```

## Limits and cost

- Cross-shard deduplication, global train/holdout construction, and final voice review belong to the integrator. The dry report's 20/80 split is only a local preview; no training or holdout files were written.
- Runtime tokenizer counts were not measured. Answers are deliberately short, with per-turn maxima of 22, 48, and 119 words, but the integrator should still verify actual Arabic token fit.
- No unresolved local schema, quota, or filter failures remain.
- No external API calls, GPU jobs, or other paid runs were launched. Harness generation cost is not exposed here.
