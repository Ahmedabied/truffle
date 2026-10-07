# STATE

Updated: 2026-10-08, 01:10 Oman. Session 02 (overnight build kickoff), Fable 5.1 integrating, GPT astra spikes, Opus 5.5 builders.

## Phase

**Build, day 1 done overnight.** Truffle talks on the web through the Workers AI fallback brain with real Muscat weather and real energy rules. Fine-tune and the Modal brain are not started (need Ahmed's Modal account).

## Live

- Web (ASCII world, chat, judge mode at `/demo`): https://truffle-web.ahmed-abied.workers.dev
- API (Worker + Durable Objects): https://truffle.ahmed-abied.workers.dev (`/health` says `modal:false` until the Modal brain exists)
- Feeder APK (debug, sideload): draft GitHub release `v0.1.0-feeder` (not public until published)

## Done (all verified, all on main)

- `worker/`: engine (30 goldens + 12 edge tests), routes, TruffleDO with SQLite and the local-midnight alarm (fired live at 00:00 Oman on Oct 8), Open-Meteo weather with burrow decision, brain router with Workers AI fallback (`half_awake` flag), prompt builder matching `finetune/data/schema.md` byte for byte, judge mode, rate limits (60 feeds/h, 60 chats/h per Truffle, 5 spawns/h per IP), one chat in flight per Truffle, day-key check on feeds, timezone pinned at pairing. 128 tests. `worker/scripts/smoke.sh <url>` exercises every route.
- `web/`: 40x28 ASCII world at 12 fps, sprites per stage and mood, chat with tier-speed typing, half-awake marker, Arabic and English, settings, judge mode, offline demo that runs the real engine. 39 KB of JS. Verified in Chrome against production: pair, feed, Arabic chat at medium tier (screenshots in `docs/assets/`). Not yet verified on the phone.
- `feeder-android/`: Kotlin Health Connect feeder, builds on the box, 10 unit tests, emulator-tested on Android 16 (permissions, background read, revoke recovery). Not yet run on Ahmed's Samsung.
- `finetune/`: filter (51 selftests), Unsloth QLoRA train script (dry run on the box with a tiny Gemma, Gemma 4 template verified), eval harness (dry run), schema and 3 worked examples for Wave B.
- `brain-modal/modal_app.py`: written by S01, not run (no Modal token).
- Wave A spikes S01 to S10 all landed in `fleet/outbox/` with RESULT.md each. Highlights: Muscat hit 43.9C apparent on Oct 7 (would burrow); un-tuned Gemma quotes the state block back 18/20 and told a user to go walk at 44C (S09); Workers AI thinking is on by default and `chat_template_kwargs.enable_thinking=false` turns it off (S03); Modal needs a card on file for GPU even with the USD 30 credit (S06); DEV uploads the raw transcript before redaction (S07); S10 found 6 high-severity holes, 4 fixed tonight, rest listed in HANDOFF.
- Git history has no co-author trailers (Ahmed's rule). 23 commits, all pushed.

## Not done (blocking)

- Ahmed: Modal account (Continue with GitHub), card on file, `modal setup` on the laptop. Then S01 runs for real and Plan A/B gets decided.
- Ahmed: Hugging Face read token (none exists on the box). Gemma licence looks accepted (no gate banner while logged in).
- Ahmed: 30 seed lines (`finetune/seed/TRUFFLE_VOICE_SEED.md`) by Thursday noon, then Wave B.
- Ahmed: install the feeder APK on the Samsung, pair, feed. Or the Tasker bridge (see `feeder-android/README.md`; note the TaskerHealthConnect 1.0.4 aggregate bug).
- Phone verification of the web app (fonts, frame rate, Arabic keyboard, TalkBack).

## Open decisions (write a record in decisions/ before changing code)

- 0011 serving plan A or B (after S01 runs).
- Missing forecast on a caught-up midnight: spec says burrowed=false, docs/02 says keep yesterday, S10-06 proposes a protected day. Code does burrowed=false.
- Timezone migration after pairing (tz is pinned now; moving needs an owner action and a rule).
- Web: HUD line inside the grid stays English (Arabic cannot sit in the monospace grid); Arabic HUD is a line under the world. Arabic stage names chosen by B03: بذرة، برعم، فقعة، معمّرة. Ahmed to confirm.
- Health Connect stable 1.1.0 needs compileSdk 36; feeder uses 1.1.0-beta01 on 35 for now.

## Costs so far

USD 0.00 paid. Workers AI usage inside the free allowance (about 70 calls). Ledger: `fleet/costs.md`.

## Known environment facts

- `wrangler dev` on this laptop needs `--ip 127.0.0.1 --port 8787`.
- The per-IP spawn limit (5 per hour) bites repeated testing from one IP; the smoke script tolerates it.
- Box (`ssh workstation`): RTX 5060 Ti 16 GB, Unsloth venv at `~/truffle-ft/.venv` (Python 3.12), Android build at `~/truffle-build/feeder-android` with JDK 17 at `/home/tamlik/jdks/jdk-17.0.20.1+1`.
- GPT plugin reads its model from `~/.codex/config.toml` once per session; fast tier is on. Astra agents need Ahmed's message to mention GPT.
