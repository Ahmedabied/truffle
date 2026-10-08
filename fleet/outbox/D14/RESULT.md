# D14 result

**100 rows written, 100 kept, zero drops for every filter reason.**

## Assignment and scope

- Assignment: mood `affectionate`, language `mixed`, shard `D14`.
- Output: `fleet/outbox/D14/shard.jsonl`, with unique IDs `D14-0001` through `D14-0100`, and this report.
- Launch mode: `SEED LINES PENDING`, decision 0014. The ten moments supplied the situation map; the three worked examples supplied the tone. No Ahmed seed lines were invented, completed, or quoted as his words.
- Read the full packet and every required input, including all seven filter lists. S09 was used only for failure patterns, not prompts or training text.
- Only the two assigned output files were written. No protected inputs were edited. No commit or push was made.

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

- User-turn distribution: 70 single-turn, 20 two-turn, 10 three-turn rows, totaling 140 assistant turns.
- Maximum assistant words per turn: low 22, medium 75, high 151. Counts include code and drafts.
- State languages: 57 `ar`, 43 `en`; all 100 metadata languages are `mixed`.
- All 100 opening user messages mix Arabic and English. All 100 rows have bilingual assistant text. Of 140 assistant turns, 139 contain both scripts; the remaining turn is the explicitly requested two-word Arabic goodnight in D14-0051.
- Stages: 2 Spore, 31 Sprout, 33 Truffle, 34 Elder. Ten cities appear.

## Memory and layout checks

All 100 systems have the exact fixed header, ordered state line, and fixed language line, with LF separators and no extra guidance. Every row has only the required top-level and message keys.

Exactly 10 personal-memory rows have exactly one memory section after the required blank line. No other intent has a section. Every section has the exact opening marker, note, one-line JSON list, and closing marker, with no trailing text. Each contains one relevant fact, for 10 facts total; the longest is 110 characters.

The three low-tier facts are explicitly from earlier today. The four medium-tier facts are from yesterday or two to four days ago. The three high-tier facts are from earlier chats within the creature's stated age. Replies stay grounded in those facts, acknowledge missing details, and label suggestions as suggestions. No saved-memory or scheduled-reminder promises are made.

## Moment coverage and semantic review

| Moment | Representative rows |
|---|---|
| Morning hunger, no steps yet | D14-0001 |
| Thanks after a long walk | D14-0076 |
| Hot-day protection and indoor alternatives | D14-0025, D14-0061, D14-0094 |
| Sleepy one-liner | D14-0002 |
| Affection after beating the average | D14-0003, D14-0077 |
| Useful high-energy practical help | D14-0085 through D14-0092 |
| Goodnight with an optional tomorrow | D14-0012, D14-0048, D14-0083, D14-0084 |
| First introduction without assumed memory | D14-0034, D14-0075, D14-0100 |
| Grounded recall from earlier days | D14-0067 through D14-0070, D14-0096 through D14-0098 |
| Kindness if wilting after two zero days | D14-0035, D14-0066 |

No schema exception was taken. All current snapshots remain affectionate, with zero days at zero and no burrowing. Incompatible hot-day and wilting moments are explicit hypothetical discussions, not invented current conditions or state transitions. D14-0034 is the first chat with an existing three-day-old Spore, not a fabricated day-zero affectionate state. D14-0075 discusses a genuinely fresh spore hypothetically.

Reviewed all conversations for complete low-tier answers, natural follow-ups, optional outdoor invitations, safe heat alternatives, grounded recall, and unchanged snapshots. Sunset is never treated as proof of safety. Indoor and outdoor steps have equal energy value. Practical help remains usable without a repeated creature catchphrase.

## Additional verification

In-memory audits ran with `python3 -I -B -` and Node through `node -e`; no helper files were created.

- Passed independent checks for all 30 intent-tier cells, exact layouts, ID sequence, role alternation, metadata assignment, final newline, and no blank rows.
- Passed all-role lexical safety and leakage scans. No U+2013 or U+2014 appears in either deliverable.
- Checked tier ranges, mood consistency, safe weather descriptions, night timing, stage bounds, capacity/carryover feasibility, and enough energy margin for every multi-turn conversation.
- D14-0020: executed both Python expressions with empty and populated lists.
- D14-0021: parsed the anchor and verified target and opener-isolation attributes.
- D14-0057: executed both JavaScript snippets and tested ordering and case-insensitive first-spelling retention.
- D14-0058: checked CSS structure, breakpoint, and column rules. Not browser-rendered.
- D14-0089: executed the original function, its supplied tests, and the duplicate-removal modification; checked author isolation.
- D14-0090: checked HTML linkage and executed two toggle clicks against a DOM stub. This is not a browser accessibility test.
- Verified duration, equal-split, and printing-quote arithmetic, plus the 120-minute and 90-minute plan totals.

Exact required self-check, run from `/home/abied/Desktop/Truffle` after the final shard edit:

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D14/shard.jsonl' --dry
```

Exit code: 0. Complete final report follows, including the dry-run split preview. No train or hold-out files were written.

```text
# Truffle data filter report

Sources: `fleet/outbox/D14/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| affectionate | 100 | 20 | 80 |

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
| D14 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 0 | 0 | 28 |
| medium | 0 | 0 | 27 |
| high | 0 | 0 | 25 |
```

## Remaining limits and cost

- No unresolved schema or filter failures. Cross-shard deduplication and global train/hold-out construction belong to the integrator.
- Runtime tokenizer counts were not measured. Replies are deliberately short relative to word limits, but exact deployed-token behavior still needs integration testing.
- Arabic naturalness and voice remain subject to human review; these are original synthetic conversations, not Ahmed-authored lines.
- External API/GPU cost: $0. No network calls or paid compute jobs were launched. Agent-session billing was not available.
