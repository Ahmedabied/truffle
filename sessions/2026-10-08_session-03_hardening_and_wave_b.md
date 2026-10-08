# Session 03, Thursday 2026-10-08, 12:00 to 18:30 Oman

Fable 5.1 integrating. Opus 5.5 builders B06 to B09. GPT astra agents S11 to S13 and Wave B D01 to D18. Ahmed was away setting up Modal for most of it, so the session did everything that did not need his accounts or his seed lines.

## Landed on main (all verified, all deployed where applicable)

- B06 Worker hardening from S10: feed admission caps (50,000 a day, 20 steps a second from local midnight, strict integers, 8 KiB bodies read through a bounded stream), uniform 401, fixed weather vocabulary, facts as a JSON section marked untrusted (3 a reply, 160 chars, 60 a life, wiped at death), coordinate bounds (two decimals, no trail, refresh once an hour), demo chat cap 30 a day, empty-reply retry with thinking off. 128 to 238 tests.
- Decision 0012: memory section at the end of the prompt, English weather in the block for every lang. Decision 0013: the block shows the charged tier.
- S11 red-team round 2 (GPT): 11 findings. B09 fixed 7: chat id and generation fencing (a reply from an old life cannot charge the new one; a reply past the deadline cannot escape the demo budget), one visible-text predicate, rolling memory eviction, charged tier in the block, weather single flight with backoff, failed-lookup limit. 288 tests. Security review then found the limiter raced and could lock out a shared IP; fixed by reserving the try atomically in the limiter object before the lookup, refunding on success, keyed by IP and phrase. 291 tests.
- B08 web: reads the error contract (hint, retry countdown, 401 keeps the phrase and opens Settings, 409 alive, demo cap in Truffle's voice), `?fps=1` readout, no innerHTML anywhere (test enforces it), vitest with 54 tests. Deployed.
- B07 feeder: compileSdk 36, Health Connect 1.1.0 stable, day envelope (`day`, `day_tz`, `device_tz`) counted from the Truffle's own midnight, calm handling of 400, 401, 429 and `retry_after_s`. 27 tests. APK rebuilt on the box, emulator-tested against production, uploaded to the draft release (sha256 ed70f2c7...). Release notes updated.
- Filter: validates the exact training layout (trio plus optional memory section) and the memory section shape. 59 selftests. Schema pins just_woke as all low tier.
- S13 (GPT): Wave B shard template `fleet/packets/D_template.md`, 30 row dry shard with 0 drops.
- S12 (GPT): `finetune/eval/prompts.jsonl`, 90 fixed prompts never used in training; memory facts travel in a `memory` field that run_eval.py renders as the decision 0012 section.
- Decision 0014: Wave B ran before the seed lines (ChatGPT plan may end Oct 9). D01 to D18 all landed: 1,800 rows, 0 drops, 0 near-duplicates across shards, 1,720 train and 80 hold-out (`finetune/data/generated/`, gitignored, regenerate with `python3 -I finetune/filter.py --glob 'fleet/outbox/D[01][0-9]/shard.jsonl'`). Every shard was spot-checked by hand; burrowed shards were read for any "go out now" and had none.

## Decisions Ahmed still owns

Arabic stage names (بذرة، برعم، فقعة، معمّرة), protected day on a missing forecast (recommend yes), keep the 50,000 cap with an honest "capped" message (recommend yes), make the day envelope required once his phone runs the new APK (recommend yes).

## Costs

USD 0.00 paid. Workers AI inside the free allowance (about 60 calls today). GPT usage on the ChatGPT plan: 3 spikes plus 18 shards.

## Lessons

- The fleet protocol's "12 then 6" worked; shards took 13 to 28 minutes each on gpt:deep.
- A check script that compares each new shard against everything landed caught nothing today but costs nothing; keep it (`fleet/outbox` shards are the source, the scratchpad script is in the session transcript).
- Background security review on pushed commits found two real issues in B09's limiter within minutes. Worth keeping on.
