# HANDOFF -> Session 05 (Friday Oct 9)

Start in `~/Desktop/Truffle`. Read `CLAUDE.md`, `STATE.md`, then this. Rules from Ahmed: no co-author trailers on commits, only his identity; no Fable subagents (builders are Opus 5.5 with `model: "opus"`, research and spikes are GPT); the GPT plugin only runs when his message asks for GPT or astra; never play sound on the laptop; do not use the desktop control while he is away from it.

## Where things stand (23:00 Oman, Oct 8)

The core is complete: steps to energy to the fine-tuned Gemma 4 31B brain on Modal, ASCII world, feeder, judge mode, hardened Worker. See `sessions/2026-10-08_session-04_brain_and_finetune.md`. The base vs tuned eval was running at close; if `finetune/eval/RESULTS.md` exists, it is done. If not, rerun `finetune/eval/run_live.sh <run-id>` (brain must be warm: one health call first, about 10 min).

## Ahmed's list

1. Pair the feeder on the Samsung (it is installed): web app Settings, copy the phrase, paste in the feeder, grant Health Connect, Feed now. Report the status line. Unblocks real steps and the `day` envelope decision.
2. Rotate the Hugging Face token (it was pasted into a chat on Oct 8). Save the new one to `~/.config/truffle/hf_token`; the session updates the Modal secret from the file.
3. Optional: a Cloudflare API token with Workers AI read at `~/.config/truffle/cf_api_token` so the eval judge is Gemma 26B on Workers AI, not the base model.
4. 30 seed lines, then the seed-anchored pass D19 to D21 and a second adapter r16b trained with those rows repeated three times.
5. Two minutes on the phone with `?fps=1` (first numbers: 12 fps, compose 4.8 ms, paint 3.7 ms).
6. Four yes or no answers (recommend yes to all): Arabic stage names; protected day on a missing forecast; keep the 50,000 cap with an honest message; make `day` required. Plus one new: lower the low tier cap from 120 to 90 tokens (Wave C showed 100-word low-tier replies from the fallback).
7. Diary day 1 after an evening walk: steps screenshot, weather line, two Truffle replies, how it felt.

## Session 05 order of work

1. Read `finetune/eval/RESULTS.md`. If the judge was the base model, rerun with the Cloudflare token when it exists. Put the table in the README brain status row.
2. Warm the brain before any demo: `curl -L -m 900 -H "Authorization: Bearer $(cat ~/.config/truffle/brain_token)" https://ahmedabied--truffle-brain-nosnap-brain-serve.modal.run/health`. For the judging window consider `min_containers=1` for a few hours (about USD 2 an hour).
3. Drop the EXTRAS guidance lines in `worker/src/prompt.ts` when the brain is Modal (the tuned model was trained on the trio only). Small Opus packet with a test.
4. Decisions from Ahmed's answers: records plus one Opus packet (protected day latch, capped-feed message, `day` required, low tier cap).
5. Real walk: verify the feeder's count against Samsung Health within 2 percent, then publish the APK release.
6. Writeup: `docs/06_writeup_plan.md` with the judge reads (C06 to C08) folded in: the walk as the opening scene, a dated brain status table, a care and safety box, a simulated judge walkthrough labelled as such. Draft the post Friday night, publish Saturday night.
7. DEV agent session: slice and sanitise locally first (`fleet/outbox/S07/RESULT.md`). The HF token appears in this session's transcript; redact before any upload.

## Things that will bite

- `request.cf` is undefined in `wrangler dev`: defaults are Muscat, Asia/Muscat, OM, ar.
- Per-IP spawn limit (5 an hour) and the new failed-lookup limit (30 a minute per IP and phrase) hit repeated testing from one IP. The smoke script tolerates the first.
- Never let an agent download weights to the laptop (9 GB free). Box has 77 GB. GPU work is Modal.
- `finetune/data/generated/` is gitignored. Regenerate with the filter command in the session log.
- The Worker ignores `day_tz` today; the feeder sends it. Making `day` required is a one-line change in `worker/src/index.ts` plus a test, after Ahmed's yes.
- DEV agent-session upload sends the raw transcript before redaction; slice and sanitise locally first (`fleet/outbox/S07/RESULT.md`).

## Deliverable for end of Friday

Eval table in the README. Real steps from Ahmed's Samsung at `/feed` verified against Samsung Health. Diary day 1 and 2. Post draft in `docs/post_draft.md`. Seed-anchored adapter if the lines exist.
