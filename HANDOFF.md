# HANDOFF -> Session 03 (Thursday Oct 8, late morning)

Start in `~/Desktop/Truffle`. Read `CLAUDE.md`, `STATE.md`, then this. Rules from Ahmed tonight: no co-author trailers on commits, only his identity; no Fable subagents (builders are Opus 5.5 with `model: "opus"`, research and spikes are GPT); the GPT plugin only runs when his message asks for GPT or astra.

## Where the art stands (done 10:45 Oman, deployed)

The web world was rebuilt this morning: nine coloured layers, continuous palette, real sun and moon, weather effects, shaded Truffle sprites (A01, mirrored by light side), moon phases and sun from A02. Code: `web/src/scene/{world,palette,astro,shade}.ts`, `web/src/sprites.ts`, assets in `web/src/art.json` and `web/src/sky.json`, candidates and generators in `fleet/outbox/A01` and `A02`. Screenshot any scene with `?mock=1&scene=<content|affectionate|asleep|tired|wilting|burrowed|dead|spore|sprout|elder>&hour=<0..24>&moon=<0..1>&wx=<code>&rain=1&mm=<mm>&wind=<kmh>&temp=<C>&country=<CC>` through `npx vite preview` and headless Chrome (see the session log). Still open: phone check of fonts and frame rate (Ahmed), A02's cloud shapes and dune bands were not adopted (the runtime ones read cleaner at phone size), the sunrise half disk can sit partly off the left edge.

## Ahmed's first message should say

"Continue the Truffle build. Use the astra fleet (GPT) for Wave B and red-team, Opus builders for code." Plus which of the morning items below are done.

## Ahmed's 15 minutes (nothing else can start the fine-tune without these)

1. Modal: https://modal.com/login, Continue with GitHub, add a card (GPU runs need one even with the free credit), then on the laptop: `uv tool install modal && modal setup`. Tell the session when done; do not paste tokens in chat.
2. Hugging Face: create a read token at https://huggingface.co/settings/tokens and put it in `~/.config/truffle/hf_token` (mode 600). The session reads the file, never the chat.
3. Seed lines: 30 lines in `finetune/seed/TRUFFLE_VOICE_SEED.md` by noon. Wave B waits on this.
4. Phone: download the APK from the draft release `v0.1.0-feeder` (GitHub, Releases, drafts are visible to you), sideload, open https://truffle-web.ahmed-abied.workers.dev, copy the phrase from Settings, paste it in the feeder, grant Health Connect steps, tap Feed now. If Health Connect shows no steps, Samsung Health > Settings > Health Connect > allow. Fallback: Tasker recipe in `feeder-android/README.md`.
5. Look at the web app on the phone for 2 minutes and tell the session what is ugly (fonts, speed, Arabic).

## Session's first hour

1. Run S01 for real (packet result in `fleet/outbox/S01/RESULT.md`, commands in `brain-modal/README.md`): download weights to the Volume, make the dummy LoRA, deploy, bench. Estimate before running: weights download is CPU time, bench about 20 GPU minutes on L40S, about USD 1 to 2. Log in `fleet/costs.md`. Decide Plan A or B, write `decisions/0011_serving_plan.md`.
2. `cd worker && wrangler secret put MODAL_URL` and `MODAL_TOKEN`, `wrangler deploy`, `scripts/smoke.sh https://truffle.ahmed-abied.workers.dev`, confirm `/health` says `modal:true` and a chat says `brain: modal`.
3. When the seed lines land: launch Wave B (18 shards, GPT agents, one per mood x lang) with `finetune/data/schema.md`, `finetune/data/examples.jsonl` and the seed as inputs. The generator prompt must forbid em and en dashes (the filter drops them) and must use the exact system message format. Then one Opus reviewer runs `python3 -I finetune/filter.py` and reports.
4. Launch B04 (Opus) to finish the feeder: decide compileSdk 36 plus Health Connect 1.1.0 stable, verify real Samsung counts against Samsung Health within 2 percent, keep location off.

## Follow-ups from tonight (cut packets as needed)

- S10 items not yet applied: feed admission caps (50,000 per day, 20 steps per second), coordinate move bounds and latching a protected day, sanitise weather text to a fixed vocabulary, facts as untrusted data with a 60 cap and wipe at death, uniform 401 for unknown phrase and wrong secret, demo chats bounded. Proposed goldens in `fleet/outbox/S10/proposed_goldens.json` (64 of 70 already pass; adopt after decisions).
- S03: a high-tier Arabic reply once spent all its tokens thinking and produced nothing. Add a retry with thinking off when the visible reply is empty, and count it in the log.
- B02 open point: the state block always shows the tier energy allows, even when the user asked for a lower one. Decide whether the block should show the charged tier.
- Web: phone verification; HUD language decision; Arabic stage names; the demo page clears the heat toggle after time travel (by design, confirm).
- Eval fairness: `finetune/eval/run_eval.py` builds its own system prompt from the schema; the Worker's `buildSystemPrompt` adds guidance lines after the canonical trio. For the base vs tuned table use the same builder, or evaluate through the Worker.
- README still says pre-build; update after the Modal brain is live.

## Things that will bite

- `request.cf` is undefined in `wrangler dev`: defaults are Muscat, Asia/Muscat, OM, ar.
- Workers AI thinking counts against `max_tokens`; the router adds 1,024 tokens at high tier. Reasoning arrives in `reasoning_content` (and sometimes `reasoning`) and never reaches the client.
- The per-IP spawn limit (5 per hour) hits repeated testing from one IP.
- Never let an agent download weights to the laptop (9 GB free). Box has 77 GB.
- DEV agent-session upload sends the raw transcript before redaction; slice and sanitise locally first (`fleet/outbox/S07/RESULT.md`).

## Deliverable for end of Thursday

Real steps from Ahmed's Samsung arrive at `/feed`. The Modal brain answers at least one chat (`brain: modal`). Wave B shards filtered into `train.jsonl` and `eval_holdout.jsonl`. Diary day 1 written by Ahmed after an evening walk.
