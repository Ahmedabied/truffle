# D12 result

Completed: 100 rows written, 100 kept by the required filter, 0 drops across all reasons.

## Assignment and deliverables

- Assignment: `D12`, metadata mood `just_woke`, language `ar`.
- Shard: `fleet/outbox/D12/shard.jsonl`.
- Report: `fleet/outbox/D12/RESULT.md`.
- IDs: `D12-0001` through `D12-0100`, unique and consecutive.
- Launch mode: `SEED LINES PENDING`, decision 0014. The ten moments supplied situations, and the three worked examples supplied tone. No Ahmed seed lines were invented, completed, or attributed to him. No reference answer or held-out S09 training text was copied.
- Only the two assigned output files were written. No protected inputs were edited. No commit or push was made.

## Quotas

The schema-first `just_woke` exception applies: 100 low rows, 0 medium, 0 high, rather than the standard 35/40/25 mix. Intent totals are unchanged.

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

There are 140 assistant turns. Low-tier replies contain 8 to 25 whitespace-separated words, including drafts and code. Maximum assistant words per tier: low 25; medium and high not applicable because neither has rows.

## Independent checks

An inline `python3 -I -` audit, independent of the filter's layout validation, passed these checks:

- Exactly 100 nonempty UTF-8 JSONL lines, final newline, no CRLF, no BOM, and only the permitted object and message keys.
- Exact canonical persona header, field ordering, state grammar, language line, and system ending on all 100 rows. No extra system instructions.
- Assignment, IDs, all intent totals, role alternation, and the 70/20/10 turn distribution.
- All snapshots are low tier, with energy from 9% to 19%, early morning times from 06:30 to 07:10, and temperatures from 9C to 24C. All are non-burrowed.
- Block moods: 71 content with zero days 0, and 29 tired with zero days 1.
- Stages: 25 Spore, 25 Sprout, 23 Truffle, and 27 Elder. Early-stage ages and recent steps are plausible. Every tired snapshot has sufficient today's steps to fund its stated energy and conversational spending. All multi-turn rows remain safely within low tier after reply costs.
- Ten cities are represented: Muscat, Sohar, Nizwa, Salalah, Dubai, Riyadh, Berlin, London, Phoenix, and Kuala Lumpur.
- Memory sections appear on exactly the 10 personal-memory rows, and nowhere else. All have the required blank separator, opening marker, exact note, one JSON-list line, closing marker, and no trailing text. There are 12 facts total, 1 or 2 per row, with a maximum of 64 characters. Every fact is explicitly from earlier this morning.
- Lexical safety and leakage checks passed on both user and assistant turns, not just assistant turns. No forbidden dash characters appear in any role.
- Maximum within-shard assistant-conversation Jaccard is 0.075, between D12-0071 and D12-0096. Maximum Jaccard against the three worked examples is 0.0, using the filter's normalized word 3-shingles.

Manual review checked complete short answers, natural follow-ups, grounded memory use, optional outdoor suggestions, and the absence of fabricated state changes. Long walks are user-reported events from last night. Dangerous heat and wilting are hypothetical explanations, not invented current conditions. Requests beyond current effort get small, complete alternatives. Older memory is not fabricated. Bedtime rows discuss last night or tomorrow's bedtime while the current snapshot remains morning.

Practical checks were run with a second inline `python3 -I -` command:

- Executed the Python snippets for ordered deduplication, extension checks, missing dictionary keys, and explicit None handling. Verified the dictionary is not changed by those assignments.
- Executed the JavaScript nullish fallback through `node -e`, testing null, undefined, an empty string, and an ordinary title.
- Executed the SQL query against an in-memory SQLite database and checked ascending output.
- Checked the CSS grid-centering declarations and the explanation about available vertical space. Browser rendering was not run.
- Verified the 08:35 departure arithmetic for a 09:10 arrival.

Scoped `git status --short` showed only the new D12 directory and no modifications to the listed protected inputs.

## Required self-check

Run from `/home/abied/Desktop/Truffle`:

```bash
python3 -I finetune/filter.py --glob 'fleet/outbox/D12/shard.jsonl' --dry
```

Complete final report:

```text
# Truffle data filter report

Sources: `fleet/outbox/D12/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

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
| ar | 100 | 20 | 80 |

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
| D12 | 100 | 20 | 80 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 0 | 80 | 0 |
| medium | 0 | 0 | 0 |
| high | 0 | 0 | 0 |
```

## Handoff, limits, and cost

- No unresolved local filter, quota, or schema failures. The all-low schema exception is intentional and documented above.
- Cross-shard deduplication and the global train/holdout construction remain the integrator's responsibility. The 20/80 split above is the filter's local dry-run report only; no split files were written.
- Model-specific tokenization and runtime generation were not exercised. Replies are capped at 25 words here, comfortably below the 60-word limit, but this is not a measured 120-token guarantee.
- Arabic human voice review remains an integration step; no Ahmed rating is claimed.
- No separate paid API or GPU jobs were launched. External execution cost: $0. Agent-session usage cost was not available and was not estimated.
