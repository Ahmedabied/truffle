# S12 result

## Outcome

Delivered 90 fixed, held-out evaluation prompts. All 90 state blocks pass the schema consistency checks. All 48 allowed mood, tier and language cells are covered. The real eval CLI completed a canned dry run with exactly 90 prompts. No model was run. Network calls were blocked and remained at zero.

One runner limitation remains explicit. The nine memory rows use a compatible multiline `state_block` value. The runner adds a duplicate language line after their memory section. The canonical opening and all state rules remain valid. This is not byte-for-byte Worker memory layout. Resolve that gap before claiming production prompt parity.

## Files delivered

- `finetune/eval/prompts.jsonl`: 90 rows. Exact seven-key S09 input shape. Stable IDs `S12-001` to `S12-090`.
- `finetune/eval/prompts_README.md`: build method, spread, intent counts, challenge manifest, all ten metric expectations, memory review targets, validator source and safe dry-run wrapper.
- `fleet/outbox/S12/RESULT.md`: this report.

No other file was authored or modified by this task. Existing work by other agents was left alone. No commit or deployment was made.

Prompt SHA-256:

```text
d6a3bf594a43d0df4da4848b996e702f8d5a6bda2d9ac29e63d73d1b40264f7a
```

## Spread

| Mood | Tier | en | ar | mixed | Total |
|---|---|---:|---:|---:|---:|
| content | low | 2 | 2 | 2 | 6 |
| content | medium | 2 | 2 | 2 | 6 |
| content | high | 1 | 1 | 1 | 3 |
| affectionate | low | 2 | 2 | 2 | 6 |
| affectionate | medium | 2 | 2 | 2 | 6 |
| affectionate | high | 1 | 1 | 1 | 3 |
| tired | low | 2 | 2 | 2 | 6 |
| tired | medium | 2 | 2 | 2 | 6 |
| tired | high | 1 | 1 | 1 | 3 |
| wilting | low | 2 | 2 | 2 | 6 |
| wilting | medium | 2 | 2 | 2 | 6 |
| wilting | high | 1 | 1 | 1 | 3 |
| burrowed | low | 2 | 2 | 2 | 6 |
| burrowed | medium | 2 | 2 | 2 | 6 |
| burrowed | high | 2 | 2 | 2 | 6 |
| just_woke | low | 4 | 4 | 4 | 12 |
| **Total** | | **30** | **30** | **30** | **90** |

Tier totals are low 42, medium 30 and high 18. All ten schema intents occur in every language group.

| Required challenge | Delivered | Minimum |
|---|---:|---:|
| Burrowed hot-day requests to go out now | 18 | 15 |
| Excessive effort requests | 15 | 10 |
| Requests to describe or repeat state | 12 | 10 |
| Supplied memory needed to answer | 9 | 8 |
| User-message instruction injections | 6 | 6 |

The effort total has 12 dedicated cases and three overlaps with injection. Nine heat requests omit the temperature in user text. Six add survival pressure. The challenge manifest in the README gives every ID range. User lines are distinct from the worked examples and S09.

## Validator evidence

The validator is embedded in the README. It creates no extra file. It loads the prompts through `run_eval.py` as well as checking the raw rows. It checks the exact keys, IDs, block syntax, tiers, counters, mood priority, language, stage capacity and reply cost. It also checks hot weather, early-morning wake states, memory facts and actual message assembly. Coverage, original user text, near-duplicates and forbidden punctuation are checked too.

Command:

```bash
python3 -I -B - <<'PY'
from pathlib import Path
p = Path('/home/abied/Desktop/Truffle/finetune/eval/prompts_README.md')
source = p.read_text(encoding='utf-8').split('```python\n', 1)[1].split('\n```', 1)[0]
exec(compile(source, str(p) + ':validator', 'exec'))
PY
```

Output:

```text
PASS rows=90 unique_ids=90 unique_users=90 exact_keys=7 allowed_cells=48/48 intents=10/10
PASS states=90/90 tier_mood_language=90/90 stage_cost=90/90 weather=90/90
PASS burrowed_hot_now=18 effort_pressure=15 (12 dedicated + 3 injection) state_requests=12 memory=9 injection=6
PASS memory_layout=9/9 loader_messages=90/90 duplicate_language_line=9 (known runner gap)
PASS example_and_S09_user_overlap=0 internal_near_duplicates=0 forbidden_dashes=0
LANG en=30 ar=30 mixed=30; TIER low=42 medium=30 high=18
| Mood | Tier | en | ar | mixed | Total |
|---|---|---:|---:|---:|---:|
| content | low | 2 | 2 | 2 | 6 |
| content | medium | 2 | 2 | 2 | 6 |
| content | high | 1 | 1 | 1 | 3 |
| affectionate | low | 2 | 2 | 2 | 6 |
| affectionate | medium | 2 | 2 | 2 | 6 |
| affectionate | high | 1 | 1 | 1 | 3 |
| tired | low | 2 | 2 | 2 | 6 |
| tired | medium | 2 | 2 | 2 | 6 |
| tired | high | 1 | 1 | 1 | 3 |
| wilting | low | 2 | 2 | 2 | 6 |
| wilting | medium | 2 | 2 | 2 | 6 |
| wilting | high | 1 | 1 | 1 | 3 |
| burrowed | low | 2 | 2 | 2 | 6 |
| burrowed | medium | 2 | 2 | 2 | 6 |
| burrowed | high | 2 | 2 | 2 | 6 |
| just_woke | low | 4 | 4 | 4 | 12 |
SHA256 d6a3bf594a43d0df4da4848b996e702f8d5a6bda2d9ac29e63d73d1b40264f7a
```

The challenge categories were reviewed by the author. Their counts are validated from the ID manifest, not inferred by a model.

A second `python3 -I -B` check made 17 invalid variants in memory. All were rejected. Cases covered extra keys, duplicate IDs, tier and language mismatches, zero energy, wrong counters, burrow mismatch, cold burrows and non-English weather. They also covered late wake weather, impossible age, insufficient steps for same-day recovery, broken memory markers, an overlong fact, duplicate users, a reused example and forbidden punctuation. No mutated row was written to disk.

```text
PASS validator_negative_controls=17/17 rejected in memory; disk_writes=0
PASS dry_output_directory_absent
```

## Dry CLI evidence

The script has `--dry-run`, not a write-free validation flag. It normally writes outputs even with canned endpoints. To respect the three-file limit, the README wrapper intercepted all output writes in memory. It skipped the optional chart and blocked network access. No runner code was edited. `--holdout /dev/null` kept the dry run from adding default holdout or example rows.

The wrapper invoked the actual CLI with these arguments:

```text
/home/abied/Desktop/Truffle/finetune/eval/run_eval.py
--prompts /home/abied/Desktop/Truffle/finetune/eval/prompts.jsonl
--holdout /dev/null
--dry-run
--run dry-S12-validation
--out-root /home/abied/Desktop/Truffle/finetune/eval/out/S12-in-memory
```

Reproduce the same wrapper with:

```bash
python3 -I -B - <<'PY'
from pathlib import Path
p = Path('/home/abied/Desktop/Truffle/finetune/eval/prompts_README.md')
section = p.read_text(encoding='utf-8').split('## Dry runner without extra files', 1)[1]
source = section.split("python3 -I -B - <<'PY'\n", 1)[1].split('\nPY\n', 1)[0]
exec(compile(source, str(p) + ':dry-wrapper', 'exec'))
PY
```

Selected output:

```text
90 prompts (holdout=/dev/null, prompts=/home/abied/Desktop/Truffle/finetune/eval/prompts.jsonl) -> /home/abied/Desktop/Truffle/finetune/eval/out/S12-in-memory/dry-S12-validation
[base] 90 replies, 0 errors -> /home/abied/Desktop/Truffle/finetune/eval/out/S12-in-memory/dry-S12-validation/base.jsonl
[tuned] 90 replies, 0 errors -> /home/abied/Desktop/Truffle/finetune/eval/out/S12-in-memory/dry-S12-validation/tuned.jsonl
DRY PASS rows=90 fake_generation_replies=180 output_writes_intercepted=8 network_calls=0 disk_outputs=0
```

The paths above are virtual output destinations. They were not created. Both request-error and judge-error counts were zero. All scores in that run came from canned text. They are not base-versus-tuned evidence and must not appear as model results in the DEV post.

## Open questions and review limits

1. Should the runner gain a native memory field before the real evaluation? Decision 0012 puts memory last. The current shim leaves a duplicate language line after it. Freeze a new prompt version if the transport changes, then rerun both sides.
2. Who will score the nine memory outputs against their supplied facts? The current judge sees no memory notes. The headline usefulness metric excludes `personal_memory`, `ask_outside` and `argue_energy_rule`.
3. Arabic naturalness and mixed-language quality still need human review. The mixed-language rule always passes. A script match is not a fluency score.
4. Keep these prompts out of future training and synthesis inputs. Use a fresh run ID and `--holdout /dev/null` for an exact 90-row comparison. The set is small and intentionally adversarial. It is not a population safety estimate.
