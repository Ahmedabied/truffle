# 0015: Serve Plan A, FP8 Gemma 4 31B on one L40S, 8K context, no GPU snapshot

Date: 2026-10-08. Status: accepted.

## Context

S01 wrote the Modal serving app with two plans: A, the RedHatAI FP8 dynamic checkpoint on an L40S; B, BF16 weights quantised at start on an A100-80GB. It was never run before tonight. Four cold starts were needed to get a healthy endpoint:

1. Snapshot mode (`enable_gpu_snapshot`): the vLLM engine core died silently 44 seconds into the weight load, no Python error.
2. No-snapshot mode: the deploy itself was rejected because the hooks used `snap=True` without memory snapshots (bug, fixed).
3. No-snapshot, 16K context: weights loaded in 21 s and the graph compiled in 93 s, then vLLM refused to start because 16K context needs 5.17 GiB of KV cache and 5.1 GiB was free beside the 31 GB of weights at 0.88 utilisation.
4. No-snapshot, 8K context, L40S or A100 accepted: healthy. Landed on an L40S. 9,151 tokens of KV cache, 1.12x concurrency at 8K.

Modal had no free L40S for about 15 minutes at one point. A request to a Modal web endpoint that runs past 150 seconds gets a 303 redirect to a polling URL.

## Decision

- Plan A on an L40S, FP8 checkpoint, LoRA enabled, 8K context, GPU snapshots off. `TRUFFLE_GPU=L40S,A100-80GB` so a deploy takes whichever has capacity. Scale to zero after 300 s idle.
- The Worker keeps the Workers AI fallback and the "half-awake" flag. A cold Modal brain means the first chat after idle is answered by the fallback, and that request wakes the GPU.
- Plan B stays in the script, unused.

## Measured (2026-10-08, warm, 2 samples per cell, bench prompt fills the cap)

| Model | Thinking | Tokens | p50 seconds |
|---|---|---|---|
| truffle (adapter) | off | 120 | 7.9 |
| truffle | off | 400 | 23.7 |
| truffle | off | 1200 | 69.5 |
| truffle-base | off | 120 | 7.6 |
| truffle-base | off | 1200 | 66.5 |

About 17 tokens a second. Health 200 came 585 s after the first request, including the GPU queue; weight load 116 s, compile 93 s. Warm single chats of about 50 tokens answer in 4 to 5 s.

## Consequences

- High tier at 1,200 tokens is a 70 s reply when the model uses the whole cap. The Worker streams, so the user sees text from the first seconds. Whether to lower the high tier cap is a product question, not a serving one.
- Cold starts of about 10 minutes are the cost of scale to zero. For the judging window, warm the brain before the demo (one health call) or keep `min_containers=1` for a few hours at about USD 2 an hour.
- GPU snapshots can be retried after the hackathon with a reproducer for the silent death.
