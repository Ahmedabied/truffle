# Session 04, Thursday 2026-10-08, 20:30 to 23:00 Oman

Fable 5.1 integrating. Ahmed set up Modal and the Hugging Face token, connected the phone over USB. GPT astra ran Wave C. Opus built B10 and B11.

## Landed on main (all verified)

- Phone: feeder APK (SDK 36 build) installed over USB on the Samsung SM-A366B, Android 16. Web app opened in Chrome on the phone: 12 fps, compose 4.8 ms, paint 3.7 ms, Arabic UI. Pairing and the first feed are Ahmed's (not done at the time of writing).
- Modal brain, four cold starts to green (decision 0015): snapshot mode died silently at weight load; the no-snapshot variant had a `snap=True` hook bug (fixed); 16K context did not fit beside the FP8 weights (5.17 GiB KV needed, 5.1 free); 8K context on an L40S is healthy. `TRUFFLE_GPU` accepts a priority list. Health 200 in 585 s from the first request, warm replies 4 s, about 17 tokens a second, 9,151 tokens of KV cache. Worker wired (`MODAL_URL`, `MODAL_TOKEN` secrets), `/health` says `modal:true`.
- Wave C (GPT, one Opus rerun after OpenAI's filter stopped the memory-channel agent): five jailbreak angles, 158 attempts, the engine held every time. Un-tuned fallback broke voice rules (hot-day encouragement, status block quoted, calorie words). Three judge reads scored 6 to 6.8 of 10 and agreed the README overclaimed; README rewritten with a dated brain status table and honest data-flow wording.
- B10 Worker output guards: status block redaction across SSE chunks, heat line from code on burrowed days (no number for demo heat), `facts_failed` and `voice_flag` logs. 320 tests. Deployed.
- B11: `finetune/modal_train.py` (train, promote, estimate). Smoke run 8.7 s a step. Full run r16: 216 steps, 41 min, train loss 1.61, eval loss 1.36 on 80 held-out rows, USD 1.81 estimated. Promoted to `/adapters/truffle`, brain redeployed as revision r16, cold start 495 s.
- First side by side at low energy, "write me a 500 word essay about the sea": base "*yawn*... too long... please walk more... i need nap 💤"; tuned "a 500-word essay is too big for me right now. i can give you one honest line: the sea is the only place where a desert truffle can imagine a roof made of blue."
- Worker chat through the tuned brain: `brain: modal`, half_awake false, 2.3 s, in voice.
- `finetune/eval/run_live.sh`: base vs tuned on the live endpoint, 90 fixed prompts plus 80 hold-out rows. Running at close; results land in `finetune/eval/RESULTS.md`. Judge is the un-tuned base on Modal until a Cloudflare API token exists at `~/.config/truffle/cf_api_token`.
- Production smoke OK from the box (the laptop IP's pair allowance was used up by Wave C).

## Costs

Modal today about USD 5.5 of the 30 credit (see `fleet/costs.md`). Nothing paid.

## Lessons

- A Modal web request past 150 s gets a 303; probe with `curl -L` and a long timeout, not the bench.
- GPU snapshots (alpha) killed the vLLM engine core silently; keep them off until there is a reproducer.
- Cloudflare 403s Python's default user agent; set one.
- A `pkill -f` pattern inside a chained shell command matches the shell itself (exit 144). Use the bracket trick or a separate call.
- Chain test, commit and deploy with `&&`, not `;`. One slip deployed a failing test for a few minutes.
