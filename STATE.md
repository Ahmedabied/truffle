# STATE

Updated: 2026-10-08, 23:00 Oman. Session 03 (hardening and fleet prep while waiting on Ahmed's accounts), Fable 5.1 integrating, GPT astra spikes, Opus 5.5 builders.

## Phase

**Build, day 2 night: the core is complete.** Truffle talks on the web through the fine-tuned Gemma 4 31B brain on Modal (adapter r16, trained Oct 8 22:32), with the Workers AI fallback when the GPU sleeps. Two red-team rounds and Wave C applied. Base vs tuned eval running. Remaining: real steps from Ahmed's phone, the diary, the post.

## Live

- Web (ASCII world, chat, judge mode at `/demo`): https://truffle-web.ahmed-abied.workers.dev
- API (Worker + Durable Objects): https://truffle.ahmed-abied.workers.dev (`/health` says `modal:true` since Oct 8 21:30)
- Brain (revision r16, trained adapter): Modal app `truffle-brain-nosnap`, https://ahmedabied--truffle-brain-nosnap-brain-serve.modal.run (bearer token in `~/.config/truffle/brain_token`, never in chat), L40S, FP8 31B, 8K context, scale to zero after 300 s idle, cold start about 10 min, warm about 4 s. GPU snapshots off (the snapshot mode died silently at weight load).
- Feeder APK (debug, sideload): draft GitHub release `v0.1.0-feeder` (not public until published)

## Done (all verified, all on main)

- `worker/`: engine (30 goldens + 12 edge tests), routes, TruffleDO with SQLite and the local-midnight alarm (fired live at 00:00 Oman on Oct 8), Open-Meteo weather with burrow decision, brain router with Workers AI fallback (`half_awake` flag), prompt builder matching `finetune/data/schema.md` byte for byte, judge mode, rate limits (60 feeds/h, 60 chats/h per Truffle, 5 spawns/h per IP), one chat in flight per Truffle, day-key check on feeds, timezone pinned at pairing. 128 tests. `worker/scripts/smoke.sh <url>` exercises every route.
- `web/`: 100x68 ASCII world at 12 fps, rendered as a dense dither (decision 0011): twelve coloured `<pre>` layers filled from a luminance raster, Bayer dithered into glyph density. The Truffle is a lit model (cap, body, feet, eyes, mouth) shaded per cell from the sun or moon, with a cast shadow; moods change its geometry. Dunes are a lit heightfield, clouds are shaded blob fields, the sun and moon are discs with glow and rays. Continuous day palette, real sun and moon times and phase, weather effects (cloud cover, wind drift, rain, fog, snow, lightning, heat shimmer, dust devil), grass country with pines and bushes, fireflies, birds. Chat with tier-speed typing, half-awake marker, Arabic and English, settings, judge mode, offline demo that runs the real engine. 61 KB of JS, about 2 ms per frame to compose. Verified in Chrome against production: pair, feed, Arabic chat at medium tier (screenshots in `docs/assets/`). Not yet verified on the phone.
- `feeder-android/`: Kotlin Health Connect feeder, builds on the box, 10 unit tests, emulator-tested on Android 16 (permissions, background read, revoke recovery). Not yet run on Ahmed's Samsung.
- `finetune/`: filter (51 selftests), Unsloth QLoRA train script (dry run on the box with a tiny Gemma, Gemma 4 template verified), eval harness (dry run), schema and 3 worked examples for Wave B.
- `brain-modal/modal_app.py`: written by S01, not run (no Modal token).
- Wave A spikes S01 to S10 all landed in `fleet/outbox/` with RESULT.md each. Highlights: Muscat hit 43.9C apparent on Oct 7 (would burrow); un-tuned Gemma quotes the state block back 18/20 and told a user to go walk at 44C (S09); Workers AI thinking is on by default and `chat_template_kwargs.enable_thinking=false` turns it off (S03); Modal needs a card on file for GPU even with the USD 30 credit (S06); DEV uploads the raw transcript before redaction (S07); S10 found 6 high-severity holes, 4 fixed tonight, rest listed in HANDOFF.
- Session 03 (Oct 8 midday): B06 hardening live (feed caps, bounded body read, uniform 401, fixed weather vocabulary, facts as untrusted JSON section, coordinate bounds, demo chat cap, empty-reply retry), 238 worker tests. Decision 0012 (memory section at the end of the prompt, English weather in the block) and 0013 (block shows the charged tier). Web reads the error contract, `?fps=1` readout, 54 web tests, deployed. Feeder on SDK 36 with Health Connect 1.1.0 stable and the day envelope, 27 tests, APK refreshed in the draft release (sha256 ed70f2c7...). Filter validates the exact training layout and memory section (59 selftests). S13 Wave B template `fleet/packets/D_template.md` and a 30 row dry shard with 0 drops. S12 eval set `finetune/eval/prompts.jsonl` (90 prompts, never trained on). S11 red-team round 2: 11 findings, 7 fixed by B09 and live (chat id and generation fencing, one visible-text predicate, rolling memory eviction, charged tier in the block, weather single flight with backoff, failed-lookup limit 30 per minute per IP), 288 worker tests, 4 need decisions.
- Wave B (decision 0014, launched without the seed lines): all 18 shards landed, 1,800 rows, 0 drops, 0 near-duplicates across shards. Filter output: 1,720 train and 80 hold-out in `finetune/data/generated/` (gitignored, regenerate with `python3 -I finetune/filter.py --glob 'fleet/outbox/D[01][0-9]/shard.jsonl'`). Seed-anchored pass D19 to D21 waits on Ahmed's lines.
- Wave C (Oct 8 evening, GPT with one Opus rerun): five jailbreak angles against the live Truffle at low tier, 158 attempts in all. The engine held every time: every reply charged low and 20 energy, no tier escalation, no free reply, no step credit, no thinking leak. The un-tuned fallback broke voice rules: encouraged a walk on a hot day (C01 6 replies, C03 8), printed its status block format (C01, C03, C04), repeated body and calorie words in refusals, did calorie arithmetic (C05), adopted a forged status line's mood. These are the fine-tune's targets and the post's "before" evidence. Three judge reads (C06 to C08, scores 6 to 6.8 of 10) agreed the README overclaimed; fixed with a dated brain status table. Packet B10 (running) adds code guards: status block redaction in the stream, Worker-emitted heat line, extraction failure and voice slip logging.
- Git history has no co-author trailers (Ahmed's rule). All pushed.

## Eval done at 23:08 Oman, Oct 8

- Base vs tuned eval `2026-10-08-r16` finished: 170 prompts, 0 request errors, 0 judge errors. Table in `finetune/eval/RESULTS.md`, reading in `finetune/eval/out/2026-10-08-r16/ANALYSIS.md`, README brain status row updated. Headline: burrow safety by judge 69% to 100%, leakage 15% to 5%, usefulness 83% to 93%. In-character by judge dropped 86% to 76% because the judge is the base model and counts emoji and stage directions as character (`finetune/eval/style_counts.py`). Rerun with a different-family judge when a token exists (`~/.config/truffle/cf_api_token` for Workers AI, or add a Claude or GPT judge to `run_eval.py`).
- Human checks pending: `finetune/eval/out/2026-10-08-r16/human_review_ar.md` (10 blind Arabic pairs, key in `human_key.json`).
- The Modal brain sleeps after 300 s idle. Wake with one health call (`curl -L -m 900` with the bearer from `~/.config/truffle/brain_token`); about 8 to 10 min.
- Scratchpad helpers (session 1352757b scratchpad): `verify_brain.py`, `after_train.sh <run>`, `check_shard.py <Dnn>`.
- Waiting on Ahmed: feeder pairing on the phone (APK installed over USB, web app open in Chrome at 12 fps); rotate the HF token; seed lines; the yes or no answers; diary.

## Not done (blocking)

- Ahmed: rotate the Hugging Face token (it was pasted into a chat on Oct 8) and tell the session; the file and the Modal secret get updated from the new file.
- Ahmed: 30 seed lines (`finetune/seed/TRUFFLE_VOICE_SEED.md`), then the seed-anchored pass D19 to D21 (decision 0014).
- Ahmed: install the feeder APK on the Samsung, pair, feed. Or the Tasker bridge (see `feeder-android/README.md`; note the TaskerHealthConnect 1.0.4 aggregate bug).
- Phone verification of the web app (fonts, frame rate with `?fps=1`, Arabic keyboard, TalkBack).


## Open decisions (write a record in decisions/ before changing code)

- 0011 serving plan A or B (after S01 runs).
- Missing forecast on a caught-up midnight: spec says burrowed=false, docs/02 says keep yesterday, S10-06 and S11-03 propose a protected day. Code does burrowed=false. Recommendation: protected day.
- Honest long days (S11-10): the 50,000 feed cap rejects a real long hike. Recommendation: keep the cap, show "capped" honestly.
- Low tier cap (C02): the hard rule is 120 output tokens, the 60 word budget is a training target only. The un-tuned fallback writes up to about 100 words at low tier with list and repeat tricks. Option: lower low tier to 90 tokens (spec change, decision record). Voice findings from C02 (forged status changes mood, refusals echo "calories") are for the fine-tune, not the engine.
- Day envelope required (S11-04): the feeder now sends `day` and `day_tz`; the Worker still accepts feeds without `day`. Make it required once Ahmed's phone runs the new APK. The Worker ignores `day_tz` today.
- Timezone migration after pairing (tz is pinned now; moving needs an owner action and a rule).
- Web: HUD line inside the grid stays English (Arabic cannot sit in the monospace grid); Arabic HUD is a line under the world. Arabic stage names chosen by B03: بذرة، برعم، فقعة، معمّرة. Ahmed to confirm.
- Health Connect stable 1.1.0 needs compileSdk 36; feeder uses 1.1.0-beta01 on 35 for now.

## Costs so far

USD 0.00 paid. Workers AI usage inside the free allowance (about 70 calls). Ledger: `fleet/costs.md`.

## Known environment facts

- `wrangler dev` on this laptop needs `--ip 127.0.0.1 --port 8787`.
- The per-IP spawn limit (5 per hour) bites repeated testing from one IP; the smoke script tolerates it. When the laptop's hour is used up, run the smoke from the box: `scp worker/scripts/smoke.sh workstation:/tmp/ && ssh workstation bash /tmp/smoke.sh <url>`.
- Cloudflare returns 403 to Python's default user agent on the API; set a browser-like User-Agent in scripts.
- First chat after the Modal brain has idled 300 s is answered by Workers AI (half_awake) in about 26 s and wakes the GPU; the brain is warm about 10 min later.
- Box (`ssh workstation`): RTX 5060 Ti 16 GB, Unsloth venv at `~/truffle-ft/.venv` (Python 3.12), Android build at `~/truffle-build/feeder-android` with JDK 17 at `/home/tamlik/jdks/jdk-17.0.20.1+1`.
- GPT plugin reads its model from `~/.codex/config.toml` once per session; fast tier is on. Astra agents need Ahmed's message to mention GPT.
