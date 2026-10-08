# HANDOFF -> Session 04 (Thursday Oct 8 evening or Friday Oct 9)

Start in `~/Desktop/Truffle`. Read `CLAUDE.md`, `STATE.md`, then this. Rules from Ahmed: no co-author trailers on commits, only his identity; no Fable subagents (builders are Opus 5.5 with `model: "opus"`, research and spikes are GPT); the GPT plugin only runs when his message asks for GPT or astra; never play sound on the laptop; do not use the desktop control while he is away from it.

## Where things stand (18:30 Oman, Oct 8)

Everything that could be built without Ahmed is built, tested, deployed and pushed. See `sessions/2026-10-08_session-03_hardening_and_wave_b.md`. The dataset exists: 1,800 rows, 1,720 train and 80 hold-out. The fine-tune, the Modal brain and real steps are the only open lines, and all three wait on Ahmed.

## Ahmed's list (what unblocks what)

1. Modal: https://modal.com/login (Continue with GitHub), add a card under Settings, then `uv tool install modal && modal setup` on the laptop. Unblocks S01 (serve the brain) and the fine-tune.
2. Hugging Face read token at `~/.config/truffle/hf_token`, mode 600. Unblocks the weight download.
3. "Go" for the S01 bench, about USD 1 to 2 on an L40S.
4. 30 seed lines in `finetune/seed/TRUFFLE_VOICE_SEED.md`. Unblocks the seed-anchored pass D19 to D21 (decision 0014). The main dataset no longer waits on this.
5. Feeder APK from the draft release `v0.1.0-feeder` on the Samsung, pair, feed. Unblocks real steps and the day-envelope decision.
6. Two minutes with https://truffle-web.ahmed-abied.workers.dev/?fps=1 on the phone; report the fps numbers and anything ugly.
7. Four yes or no answers: Arabic stage names; protected day on a missing forecast; keep the 50,000 cap with an honest message; make `day` required. Recommendation on all four: yes. Each yes gets a decision record and a small packet.

## Session 04 order of work

1. If Modal is set up: run S01 for real (`brain-modal/README.md`, packet result in `fleet/outbox/S01/RESULT.md`). Download weights to the Volume, dummy LoRA, deploy, bench. Log in `fleet/costs.md`. Decide Plan A or B, write `decisions/0015_serving_plan.md`. Then `cd worker && wrangler secret put MODAL_URL` and `MODAL_TOKEN`, deploy, smoke, confirm `/health` says `modal:true` and a chat says `brain: modal`.
2. If the HF token exists: the fine-tune. `finetune/train.py` dry-ran on the box with a tiny Gemma; the real run is Unsloth QLoRA on a 48 GB GPU on Modal, data from `finetune/data/generated/train.jsonl`. Add the repeat factor for D19 to D21 before the run if the seed-anchored shards exist. Estimate before running; expect under USD 5.
3. Eval: `finetune/eval/run_eval.py --prompts finetune/eval/prompts.jsonl --holdout finetune/data/generated/eval_holdout.jsonl` base vs tuned. The harness builds the trio from the filter's constants, so it matches the Worker's trio; the Worker adds guidance lines for the un-tuned brain only. For the tuned brain, drop the EXTRAS in `worker/src/prompt.ts` when `brain: modal` (small packet, not done yet).
4. If the seed lines landed: render D19 to D21 from `fleet/packets/D_template.md` (mode with seed lines, 60 rows each, every row grows from one seed line, en, ar, mixed). GPT if the plan is alive, else Opus.
5. Decisions from Ahmed's answers: write the records, cut one Opus packet for the code (protected day latch in the DO, capped-feed message in the Worker and web, `day` required in the route).
6. README still says pre-build. Update after the Modal brain is live. Draft the DEV post from `docs/06_writeup_plan.md`; the before and after numbers come from step 3.

## Things that will bite

- `request.cf` is undefined in `wrangler dev`: defaults are Muscat, Asia/Muscat, OM, ar.
- Per-IP spawn limit (5 an hour) and the new failed-lookup limit (30 a minute per IP and phrase) hit repeated testing from one IP. The smoke script tolerates the first.
- Never let an agent download weights to the laptop (9 GB free). Box has 77 GB. GPU work is Modal.
- `finetune/data/generated/` is gitignored. Regenerate with the filter command in the session log.
- The Worker ignores `day_tz` today; the feeder sends it. Making `day` required is a one-line change in `worker/src/index.ts` plus a test, after Ahmed's yes.
- DEV agent-session upload sends the raw transcript before redaction; slice and sanitise locally first (`fleet/outbox/S07/RESULT.md`).

## Deliverable for end of Friday

Modal brain answers a chat (`brain: modal`). LoRA trained on the 1,800 rows (plus the seed-anchored shards if they exist). Eval table base vs tuned in `finetune/eval/RESULTS.md`. Real steps from Ahmed's Samsung at `/feed`.
