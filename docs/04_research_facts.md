# 04 - Research facts (hardened 2026-10-07)

Everything here was checked against a primary source today. Dates are 2026 unless stated. Re-check anything marked **verify** before relying on it in code.

## The challenge

- Hub: https://dev.to/challenges/hf26. Week 1 page: https://dev.to/challenges/hacktoberfest-week1-2026-10-05.
- Theme: **Touch Grass**. Prompt: build with open-source AI at the core; explain why open innovation matters for what you built.
- Deadline: **Oct 11, 2026, 11:59 PM PDT** = Oct 12, 06:59 UTC = **Oct 12, 10:59 Oman** (UTC+4).
- Rules: new project, repo started inside the window (Oct 5 - 11). Commits after the deadline must be noted in the README. Teams up to 4. English for prizes. AI use allowed.
- Judging order: Writing Quality (heaviest), Relevance to prompt and theme, Creativity, Technical Execution, Use of Partner Technology (optional).
- Prizes: $250 overall + DEV++ + badge. Featured partner categories $200 (Render, TabPFN, Tinker, Arduino, DigitalOcean, **Gemma**). Partner categories $100. One win per challenge per submission.
- Gemma category text: "run it locally, fine-tune it, or serve it through Google Cloud or another provider." Cloud serving is explicitly allowed.
- Tinker category requires Tinker. **Tinker does not list Gemma** (supported: Qwen, DeepSeek, Kimi, GLM, Nemotron, gpt-oss, Inkling). Dropped.
- Submission template fields: What I Built, Demo, Code, How I Built It, Why Does Open Innovation Matter, My Agent Session (optional), Prize Categories, team credits.
- Tie-break: positive reactions on the post.
- Agent sessions on DEV: upload at https://dev.to/agent_sessions/new (drag and drop). Parser supports **Claude Code** (`~/.claude/projects/**/*.jsonl`), Codex, Gemini CLI, Pi, Copilot CLI. You curate, slice, then Save & Upload, then embed. Uploads are unlisted by default. Built-in redaction exists but is not perfect: review before making public. API: `POST https://dev.to/api/agent_sessions` with `api-key`, body `{title, tool_name:"auto", body:<transcript>}`. DevRelay (devrelay.com) is an MCP/skill pack that wraps the same flow.

## Competition snapshot (Oct 7, afternoon)

14 entries. About 9 are "offline Gemma outdoor companion / scavenger hunt". Most are 2 - 3 minute reads, several never went outside, one has `[ADD YOUR OUTDOOR STORY HERE]` left in. Strongest: **Sobuj Ghonta** (Bangla/English, Gemma 4, OSM, live on Render, real field test in a Dhaka park, 5 reactions). Past DEV overall winners share: a personal hook, a character with a culturally rooted name, real data, one hard technical thing explained simply.

## Gemma 4

- Sizes: E2B, E4B, 12B, **31B dense**, 26B-A4B (MoE, 4B active). 31B is the most accurate (MMLU-Pro 85.2 vs 82.6 for 26B-A4B). Context 256K. Thinking mode built in.
- HF: `google/gemma-4-31B-it` (gated, accept licence). Mirrors: `unsloth/gemma-4-31B-it`.
- Quantized checkpoints for vLLM: `RedHatAI/gemma-4-31B-it-FP8-dynamic` (99.9% MMLU-Pro recovery, ~31GB), `QuantTrio/gemma-4-31B-it-AWQ` (needs vllm >= 0.19, transformers >= 5.5), `nvidia/Gemma-4-31B-IT-NVFP4`.
- **verify**: at least one report that some pre-quantized FP8 checkpoints failed to load in a vLLM build (issue #38912, "weight_scale" KeyError). Workaround that worked: BF16 base + `--quantization fp8` at runtime (needs ~62GB to load, so A100-80GB/H100). Spike S01 tests the RedHat checkpoint on current vLLM first.
- vLLM recipe: `vllm serve google/gemma-4-31B-it --reasoning-parser gemma4 --tool-call-parser gemma4 --chat-template examples/tool_chat_template_gemma4.jinja`. Thinking per request: `chat_template_kwargs: {"enable_thinking": true}`; reasoning comes back in `message.reasoning`. The 31B template inserts empty reasoning blocks when thinking is off.
- Recommended sampling: temperature 1.0, top_p 0.95, top_k 64.
- Licence: Gemma Terms of Use. Fine-tunes and data generated with Gemma are Model Derivatives; redistribution must carry the use restrictions and a copy of the terms (section 3.1). Prohibited Use Policy applies.

## Fine-tuning

- Unsloth supports Gemma 4 (text, vision, audio, RL). **31B QLoRA fits in 22GB.** 26B-A4B LoRA needs > 40GB and Unsloth does not recommend QLoRA for the MoE. Chat template name: `gemma-4-thinking`. Turn format: `<|turn>user ... <turn|>` / `<|turn>model ... <turn|>`.
- Full fine-tune of 31B: ~250GB, 4x A100. Not for us.
- vLLM serves LoRA adapters on quantized bases (bitsandbytes, GPTQ, AWQ confirmed in vLLM discussions; FP8 **verify** in S01). Flags: `--enable-lora --lora-modules name=path --max-lora-rank N`.

## Serverless GPU

- **Modal**: per-second billing, no minimum. L40S $0.000542/s (~$1.95/hr), A100-80GB $0.000694/s (~$2.50/hr), H100 $0.001097/s (~$3.95/hr). Starter plan: **$30/month free credits**, 10 GPU concurrency. GPU memory snapshots cut vLLM cold start to ~5s (from ~45s) in Modal's own numbers. `min_containers`, `scaledown_window`, `buffer_containers` available.
- **RunPod Serverless**: per-second rounded up. FlashBoot cold starts can be ~2s when workers were recently active; a 32B FP8 cold start measured 91s after tuning (324s before). Pods: A100 PCIe $1.59/hr, H100 PCIe $2.89/hr. Good for the **training** job (cheap 48GB cards).
- Decision: Modal for serving (snapshots + free credit), RunPod or Modal for the one training run.

## Cloudflare

- `request.cf` fields on every request: `country, city, continent, latitude, longitude, postalCode, metroCode, region, regionCode, timezone`. No permission prompt.
- Durable Objects: SQLite storage GA (10GB per object). Alarms: one alarm per object, `storage.setAlarm(ts)`, `alarm()` handler, fault tolerant, reschedule from inside the handler. Alarms work on SQLite-backed classes.
- Workers AI has **`@cf/google/gemma-4-26b-a4b-it`** (added 2026-04-04): 256K context, vision, built-in thinking, function calling, streaming. This is the fallback brain. Older `gemma-7b-it-lora` / `gemma-2b-it-lora` exist for LoRA but are Gemma 1; not useful.
- Workers AI LoRA on Gemma 3 12B has community reports of 500 errors. We do not depend on it.

## Steps on Android

- Google Fit APIs: deprecated, no new sign-ups since May 2024, shutdown in 2026. Do not use.
- Health Connect: on-device, part of Android 14+. Kotlin: `HealthConnectClient.getOrCreate`, permissions `HealthPermission.getReadPermission(StepsRecord::class)`, `aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(start, end)))`. Background reads need `android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND` (Android 15 feature flag check) and a WorkManager periodic job (1h min). Reading older than 30 days needs `PERMISSION_READ_HEALTH_DATA_HISTORY`. Health Connect can **auto-revoke** permissions from unused apps (community reports); feeder must detect and prompt.
- Samsung Health writes steps to Health Connect once the user allows it in Samsung Health settings. Read and write permissions are granted separately.
- Tasker plugin: `RafhaanShah/TaskerHealthConnect` (APK on GitHub releases / Obtainium). Reads records and **aggregated** data as JSON; Health Connect does not push change notifications, so polling only. Day-1 bridge.
- Published Play apps need a Health Connect declaration form; sideloaded apps do not.

## Weather

- Open-Meteo: no API key for non-commercial use, under 10k calls/day. `/v1/forecast` with `hourly=apparent_temperature,temperature_2m,precipitation,weather_code,is_day` and `current=...`. `timezone=auto` supported.

## Local machine (laptop, Oct 7)

- Pop!_OS, Java 21, Node 22, Python 3, `uv`, `gh` logged in as Ahmedabied. **No Android SDK** (no sdkmanager/gradle/adb). GPU: RTX 3050 4GB. **Disk: 9.4GB free of 226GB.** No local model work. Android SDK should be installed on the box (`ssh workstation`) or after freeing space.
- GPT subagents: plugin `gpt@gpt-subagents-local`, model `gpt-6-astra`, reasoning `xhigh`. Weekly usage was at 80% on Oct 7; **plan may end ~Oct 9**. After that `gpt:*` agents return 401/429.

## Open items to verify in the build session (spikes)

- S01: `RedHatAI/gemma-4-31B-it-FP8-dynamic` + `--enable-lora` loads on current vLLM on a Modal L40S; measure cold start with snapshots on/off; measure warm p50 for 120/400/1200 tokens with thinking off/on.
- S02: Health Connect aggregate on Ahmed's Samsung returns today's total matching Samsung Health within 2%.
- S03: Workers AI `gemma-4-26b-a4b-it` honours a `enable_thinking`-style toggle (or is non-thinking by default) and streams.
- S04: Open-Meteo apparent temperature for Muscat today vs a reference; pick the burrow threshold sanity.
- S05: DO alarm next-local-midnight math for `Asia/Muscat` and a DST zone.
- S06: Modal Starter free credit is really $30 this month and GPU concurrency allows 1 L40S.
- S07: DEV agent session upload of a Claude Code `.jsonl` from this project parses cleanly and the redaction hides nothing we need.
