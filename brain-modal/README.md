# Truffle brain on Modal

## What this is

A serving spike, not a proven deployment. It runs `RedHatAI/gemma-4-31B-it-FP8-dynamic` with vLLM on one L40S. It exposes an OpenAI-compatible API through a small authenticated FastAPI proxy. The model names are `truffle-base` and `truffle`. The latter loads a rank-16 LoRA from `/adapters/truffle`.

Weights live in the `truffle-weights` Modal Volume. Adapters live in `truffle-adapters`. Downloads and dummy adapter creation run on remote CPU containers. The dummy is tiny random noise. It tests adapter loading, not the Truffle voice. No model weights belong on the laptop.

**Status on 2026-10-07:** source research and local syntax checks only. No Modal token is present here. No image build, download, GPU run, load test or latency measurement has happened. See [S01 results](../fleet/outbox/S01/RESULT.md) for the empty measurement table and evidence.

## Exact commands

Run these from the repo root in a private terminal. Do not paste secret values into a transcript. These commands are instructions for the owner. They were not executed by the spike agent.

### 1. Set up the client and both secrets

Only the small Modal client is installed locally. The GPU stack is installed in the remote image.

```bash
cd /home/abied/Desktop/Truffle
uv tool install 'modal==1.6.1'
modal setup

# Check the chosen Hugging Face repository's current access requirements.
# These Gemma 4 checkpoints publish Apache 2.0; see NOTICE-GEMMA.md.
# Input is hidden. The shell history records variable references, not token values.
read -r -s -p 'Hugging Face read token: ' HF_TOKEN; printf '\n'
export HF_TOKEN
modal secret create huggingface HF_TOKEN="$HF_TOKEN"

# Capture a new random application token without displaying or saving it.
export TRUFFLE_BRAIN_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
modal secret create truffle-brain TRUFFLE_BRAIN_TOKEN="$TRUFFLE_BRAIN_TOKEN"
```

The last two commands pass values as process arguments. Use a private machine and keep shell tracing off. Store the application token in the owner's password manager and the Worker's secret store. Do not regenerate it before each benchmark. In a later shell, restore the same value into `TRUFFLE_BRAIN_TOKEN` privately. Use `--force` on `modal secret create` only for an intentional rotation. Secret attachment and CLI syntax are documented in the [Secrets guide](https://modal.com/docs/guide/secrets) and [CLI reference](https://modal.com/docs/cli/latest/secret).

### 2. Download once, make the dummy, deploy, benchmark

```bash
TRUFFLE_USE_HF_SECRET=1 modal run brain-modal/modal_app.py::download_weights
modal run brain-modal/modal_app.py::make_dummy_lora
modal deploy brain-modal/modal_app.py

# Copy the HTTPS URL printed for Brain.serve. Do not append /chat/completions.
export TRUFFLE_BRAIN_URL='https://YOUR-DEPLOYED-ENDPOINT.modal.run'
modal run brain-modal/modal_app.py::bench \
  --url "$TRUFFLE_BRAIN_URL" \
  --idle-seconds 360 \
  --cold-label snapshot-candidate
```

`TRUFFLE_USE_HF_SECRET=1` attaches the `huggingface` Secret only to the downloader. By default it is not attached. For an ungated RedHat download, omit that assignment and skip creation of the HF secret. The inference container never needs an HF token. The first download resolves the requested revision to an immutable commit and records it in the Volume. Repeat calls reuse that commit without downloading again. Set `TRUFFLE_MODEL_REVISION` before the first download to select a specific revision. A mismatched existing manifest is rejected.

The helper reads the cached base config. It constructs a Transformers model skeleton on the `meta` device, then uses PEFT to derive the real LoRA names and shapes. Only rank-16 matrices are allocated on CPU. Language `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj` and `down_proj` are targeted where those layers exist. Vision modules are excluded. Gemma 4 global attention can omit `v_proj`, so a fixed seven-matrices-per-layer generator would be wrong. Existing adapters are not overwritten. A matching existing dummy is reused.

The benchmark makes one 1-token request first. It makes no health probe before it. That timing includes startup, queueing, the network and generation. It is not pure engine initialization time or TTFT. It then runs five sequential requests for each combination of two model names, thinking off/on and token limits 120/400/1200. That is 60 warm requests. It prints p50 latency, actual completion-token counts and finish reasons. It also prints the thinking-on response field names and lengths, without generated text.

`max_tokens` is a ceiling, not a promise of that many generated tokens. Prefix caching is disabled for this spike. The benchmark aborts if the container changes during the warm samples. `--samples 1` is a cheaper smoke test, not the five-sample acceptance result. A merged Plan B endpoint needs `--models truffle`.

### 3. Compare cold starts without snapshots

```bash
TRUFFLE_GPU_SNAPSHOT=0 modal deploy brain-modal/modal_app.py
export TRUFFLE_NOSNAP_URL='https://YOUR-NOSNAPSHOT-ENDPOINT.modal.run'
TRUFFLE_GPU_SNAPSHOT=0 modal run brain-modal/modal_app.py::bench \
  --url "$TRUFFLE_NOSNAP_URL" \
  --idle-seconds 360 \
  --cold-label no-snapshot-after-zero
```

This deploys a separate app, `truffle-brain-nosnap`. The default app is `truffle-brain`. Both reuse the same Volumes. Each has `min_containers=0`, `max_containers=1`, `buffer_containers=0` and `scaledown_window=300`. Do not benchmark them simultaneously.

A new deployment alone does not prove the first request was cold. Confirm zero running containers in the Modal dashboard. Stop health polling and other callers during the idle interval. Check the logs for an actual snapshot restore before labelling the snapshot result. The [official snapshot example](https://modal.com/docs/examples/vllm_snapshot) says several cold starts may be needed before the speedup appears. Repeat the snapshot benchmark after another idle interval if necessary. Do not report the example's latency numbers as Truffle measurements.

### 4. Optional edge-auth switch from S06

The packet's default is the custom `truffle-brain` bearer check. For deployment beyond the spike, **prefer Modal's edge authentication**. It rejects unauthenticated traffic before GPU startup. The script supports it without changing the Worker's bearer-header format:

```bash
# Run privately. This command prints credentials once. Do not capture them in logs.
modal workspace proxy-tokens create --name truffle-brain

TRUFFLE_AUTH_MODE=proxy modal deploy brain-modal/modal_app.py
# Privately set TRUFFLE_BRAIN_TOKEN to the combined TOKEN_ID.TOKEN_SECRET value.
TRUFFLE_AUTH_MODE=proxy modal run brain-modal/modal_app.py::bench \
  --url "$TRUFFLE_BRAIN_URL" --idle-seconds 360 --cold-label edge-auth-snapshot
```

Use a Proxy Token, not a Modal deployment token. In this mode `requires_proxy_auth=True` authenticates the request. The proxy no longer checks the custom Secret. It still restricts routes and forwards to localhost. The default `TRUFFLE_AUTH_MODE=bearer` is the fallback that matches the packet and architecture. Do not send both auth formats at once. The [proxy-auth guide](https://modal.com/docs/guide/webhook-proxy-auth) documents `Authorization: Bearer TOKEN_ID.TOKEN_SECRET`. The [workspace CLI](https://modal.com/docs/cli/latest/workspace) documents token creation. Header stripping and secret rotation across restored snapshots still need runtime checks.

## Expected cost per step

These are planning estimates, not observed costs. [Modal pricing](https://modal.com/pricing), checked 2026-10-07, lists L40S at **$0.000542/s**, about **$1.95/hr**. A100-80GB is $0.000694/s, about $2.50/hr. CPU is $0.0000131 per physical core-second. RAM is $0.00000222 per GiB-second. Starter lists $30/month in compute credits. Available credit on this account is unverified.

| Step | Resource request | Planning allowance | Estimated base cost before credits |
|---|---|---|---|
| Client setup and secret creation | No GPU | A few minutes | No GPU charge |
| Image build | Remote build CPU | Unknown until built | No serving GPU; build charges not measured |
| First FP8 download | 2 CPU, 4 GiB RAM, no GPU | 5 to 20 minutes | About $0.01 to $0.04 for that CPU/RAM request |
| Repeat cached download | Same CPU function | Seconds | Small CPU/RAM charge; no weight transfer expected |
| Dummy adapter | 4 CPU, 8 GiB RAM, no GPU | 1 to 5 minutes | About $0.004 to $0.021 for that CPU/RAM request |
| Serving startup or snapshot creation | L40S, 4 CPU, 64 GiB RAM | Budget 5 to 15 minutes initially | About $0.22 to $0.66 total at requested resources |
| Full 60-request benchmark | Same serving container | Budget 10 to 40 minutes | About $0.44 to $1.77 total, plus startup and idle |
| 300-second idle tail | Same serving container | 5 minutes | $0.163 GPU alone; about $0.221 with requested CPU/RAM |
| Plan B serving | A100-80GB, 4 CPU, 96 GiB RAM | Per active or idle hour | About $3.45/hr total at requested resources |

The L40S container's requested-resource estimate is about $2.65/hr including CPU/RAM. Actual CPU/RAM usage above the request can cost more. Warm idle reservations are billed. See [resources](https://modal.com/docs/guide/resources) and [cold starts](https://modal.com/docs/guide/cold-start). A benchmark can take longer than the allowance. Stop and reassess if startup exceeds 15 minutes or the warm run exceeds 40 minutes. Review a dry-run estimate before any run expected to exceed $3.

Volume storage is listed at $0.09/GiB/month, with 1 TiB/month included. That allowance is workspace-wide. GPU snapshot storage pricing is not separately stated on the fetched pricing page. Retaining both FP8 and BF16 checkpoints increases stored bytes. Startup, failed runs, snapshot creation and the idle tail all belong in the owner's cost ledger. No charge was initiated by this agent.

## Plan B commands

Use this if the checkpoint loader or FP8 LoRA path fails. Save the exact error first. The fallback downloads `google/gemma-4-31B-it` in BF16 on Modal and quantizes at runtime on one A100-80GB. Allow roughly 62 GB of remote weight storage plus the FP8 cache. Do not download it locally.

**Current-version correction:** the historic command was `--quantization fp8`. In vLLM **0.31.0**, that method rejects online quantization of an unquantized checkpoint. Its error directs callers to `--quantization fp8_per_tensor`. The script uses that current spelling. See the [pinned FP8 implementation](https://github.com/vllm-project/vllm/blob/v0.31.0/vllm/model_executor/layers/quantization/fp8.py) and [current FP8 guide](https://docs.vllm.ai/en/stable/features/quantization/llm_compressor/fp8/). Copying the old flag here would create a known startup failure.

```bash
export TRUFFLE_PLAN_B=1
TRUFFLE_USE_HF_SECRET=1 modal run brain-modal/modal_app.py::download_weights

# Reuse /adapters/truffle from Plan A. If it does not exist, create it now:
modal run brain-modal/modal_app.py::make_dummy_lora

modal deploy brain-modal/modal_app.py
export TRUFFLE_PLAN_B_URL='https://YOUR-BF16-ENDPOINT.modal.run'
modal run brain-modal/modal_app.py::bench \
  --url "$TRUFFLE_PLAN_B_URL" --idle-seconds 360 --cold-label plan-b-snapshot
```

This creates `truffle-brain-bf16`. Add `TRUFFLE_GPU_SNAPSHOT=0` to both deploy and bench commands for the separate `truffle-brain-bf16-nosnap` app. Unset `TRUFFLE_PLAN_B` to return to Plan A.

L40S is Ada and supports W8A8 FP8. A100 is Ampere. The [FP8 guide](https://docs.vllm.ai/en/stable/features/quantization/llm_compressor/fp8/) describes its weight-only W8A16 Marlin path. Do not assume the A100 fallback has native FP8 tensor-core throughput. Runtime quantization and LoRA together still require a real load test.

### If quantized LoRA itself is rejected

Changing checkpoints may not fix that. Merge the real adapter into BF16 weights on the training GPU. A private HF repository for merged weights must preserve accurate provenance, the applicable Apache 2.0 license and required upstream notices; see [NOTICE-GEMMA.md](../NOTICE-GEMMA.md). This file does not implement the training-side merge. It can serve the merged result without applying LoRA a second time:

```bash
export TRUFFLE_PLAN_B=1
export TRUFFLE_MERGED_REPO='YOUR-HF-ACCOUNT/YOUR-MERGED-GEMMA4-REPO'
export TRUFFLE_DEPLOY_REVISION='merged-v1'
TRUFFLE_USE_HF_SECRET=1 modal run brain-modal/modal_app.py::download_weights
modal deploy brain-modal/modal_app.py
modal run brain-modal/modal_app.py::bench \
  --url "$TRUFFLE_PLAN_B_URL" --models truffle \
  --idle-seconds 360 --cold-label merged-plan-b-snapshot
```

The merged variant exposes only `truffle`. There is no untouched base at that endpoint. Use the separate unmerged endpoint for a fair base comparison. The runtime quantization flag remains `fp8_per_tensor`.

## Troubleshooting and verified implementation choices

All linked API and package checks below were made on **2026-10-07**. Documentation support is not a runtime result.

### Exact package pins

These pins are in the remote image definition. Only `modal==1.6.1` is needed locally for these commands.

| Package | Selected pin | Latest PyPI release observed | Why not blindly use latest? |
|---|---|---|---|
| [vllm](https://pypi.org/pypi/vllm/0.31.0/json) | 0.31.0 | 0.31.0, Oct 5 | Current stable release |
| [transformers](https://pypi.org/pypi/transformers/5.17.0/json) | 5.17.0 | 5.19.0, Oct 6 | vLLM requires `>=5.10.4,<5.18.0` |
| [torch](https://pypi.org/pypi/torch/2.13.0/json) | 2.13.0 | 2.14.1, Sep 30 | vLLM pins exactly 2.13.0 |
| [peft](https://pypi.org/pypi/peft/0.21.2/json) | 0.21.2 | 0.21.2, Oct 1 | Current stable release |
| [huggingface_hub](https://pypi.org/pypi/huggingface_hub/1.33.0/json) | 1.33.0 | 2.1.1, Oct 1 | Transformers 5.17 requires `<2.0`; vLLM requires `>=1.31.0` |
| [safetensors](https://pypi.org/pypi/safetensors/0.8.0/json) | 0.8.0 | 0.8.0, Jun 9 | Compatible with Transformers 5.17 |
| [modal](https://pypi.org/pypi/modal/1.6.1/json) | 1.6.1 | 1.6.1, Oct 3 | Current stable release |
| [fastapi](https://pypi.org/pypi/fastapi/0.136.3/json) | 0.136.3, standard extra | 0.142.3, Oct 7 | vLLM requires `>=0.133.0,<0.137.0` |
| [httpx](https://pypi.org/pypi/httpx/0.28.1/json) | 0.28.1 | 0.28.1 | Streaming proxy client |

This is a direct-dependency pin set, not a complete transitive lock. No remote resolver or image build has run yet. The image uses Python 3.12 and `nvidia/cuda:13.0.3-devel-ubuntu24.04`. The [vLLM 0.31 Dockerfile](https://github.com/vllm-project/vllm/blob/v0.31.0/docker/Dockerfile) selects CUDA 13.0.3 and Python 3.12. Modal's older examples use CUDA 12.9 and older vLLM wheels. Their exact package stack is not copied here.

The [vLLM 0.31 release notes](https://github.com/vllm-project/vllm/releases/tag/v0.31.0) include Gemma 4 changes and the Transformers 5.17 update. The [supported-models table](https://docs.vllm.ai/en/latest/models/supported_models/) lists `Gemma4ForConditionalGeneration` and `Gemma4ForCausalLM`, including LoRA support. That table does not prove this quantized checkpoint, adapter, GPU and snapshot combination works.

### Chat template and thinking

The template is baked into the image at `/opt/truffle/tool_chat_template_gemma4.jinja`. It comes from this release-tagged URL, not mutable `main`:

<https://raw.githubusercontent.com/vllm-project/vllm/refs/tags/v0.31.0/examples/tool_chat_template_gemma4.jinja>

The [Gemma 4 recipe](https://docs.vllm.ai/projects/recipes/en/stable/Google/Gemma4.html) prescribes the Gemma 4 template and `--reasoning-parser gemma4`. The [template source](https://github.com/vllm-project/vllm/blob/v0.31.0/examples/tool_chat_template_gemma4.jinja) inserts empty thought blocks when thinking is off. Empty reasoning in that mode is expected. Do not strip raw control tokens with ad hoc string replacements. The parser should separate `message.content` from `message.reasoning`. The benchmark also checks for `reasoning_content` so the actual wire format is recorded.

Send `chat_template_kwargs: {"enable_thinking": true}` or `false` at the top level of raw JSON. With the OpenAI Python client it goes in `extra_body`. Reasoning consumes the output budget. A 120-token thinking response may have no final content and finish with `length`. That is different from a load failure.

Tools are not exposed in this spike. The recipe's `--tool-call-parser gemma4` and `--enable-auto-tool-choice` apply when tool calling is needed. No special `--tokenizer-mode` or architecture `--hf-overrides` is prescribed for this text-only configuration. The local checkpoint supplies its own tokenizer and `Gemma4ForConditionalGeneration` architecture.

### Vision tower and memory

The script sets `--language-model-only`. The [current engine arguments](https://docs.vllm.ai/en/stable/configuration/engine_args/) define this as setting all modality limits to zero. It is the current shortcut for disabling multimodal inputs. The recipe also shows `--limit-mm-per-prompt image=0,audio=0` to skip multimodal profiling. Do not assume `--max-model-len` alone disables vision or its profiling allocations.

`--max-model-len 16384`, `--gpu-memory-utilization 0.88`, `--max-num-seqs 2` and `--max-num-batched-tokens 2048` are conservative spike choices. They are not measured capacity claims. FP8 weights are roughly 31 GB, but KV cache, LoRA buffers, kernels and graphs need more memory. Inspect the actual vLLM memory log. If 16K does not fit, record that acceptance failure. A shorter context is a diagnostic, not a passing 16K result.

The proxy exposes only `/health`, `/v1/models` and `/v1/chat/completions`. All three require auth. It forwards SSE without buffering the complete response. vLLM binds to localhost. The external listener is the proxy on port 8080. `/sleep`, `/wake_up`, `/collective_rpc` and dynamic LoRA-management routes are not reachable through it.

### Modal API drift and snapshots

The [current general vLLM example](https://modal.com/docs/examples/vllm_inference) and its [source](https://github.com/modal-labs/modal-examples/blob/main/06_gpu_and_ml/llm-serving/vllm_inference.py) now use `@app.server`, `target_concurrency=100` and `unauthenticated=True`. They do **not** contain a bearer-auth proxy. There is no current auth pattern there to copy verbatim.

This script follows the separate [official snapshot example](https://modal.com/docs/examples/vllm_snapshot): `@app.cls`, `@modal.concurrent(max_inputs=32)`, a `vllm serve` subprocess and `@modal.web_server`. It adds `target_inputs=2` and a FastAPI proxy using the [documented HTTPBearer check](https://modal.com/docs/guide/webhooks). The listener thread and forwarding code are this project's adaptation, not claimed upstream sample code. The class API accepts startup timeouts and snapshot options in the [current SDK reference](https://modal.com/docs/sdk/py/latest/App). The [concurrency reference](https://modal.com/docs/reference/modal.concurrent) requires the decorator at class scope.

GPU snapshot settings remain `enable_memory_snapshot=True` plus `experimental_options={"enable_gpu_snapshot": True}`. The lifecycle is:

1. Launch, health-check and warm up both model names in `@modal.enter(snap=True)`.
2. Call `/sleep?level=1`. This offloads weights to CPU and discards KV cache.
3. Restore, then call `/wake_up` in `@modal.enter(snap=False)`.
4. Start the authenticated proxy after restore. Its HTTP client connections are not captured.

The [memory snapshot guide](https://modal.com/docs/guide/memory-snapshot) labels GPU snapshots alpha. The [vLLM sleep guide](https://docs.vllm.ai/en/stable/features/sleep_mode/) documents `--enable-sleep-mode` and `VLLM_SERVER_DEV_MODE=1`. These development endpoints must stay private. CPU-only snapshots do not permit GPU initialization in `snap=True`. The no-snapshot toggle starts the GPU work in `snap=False` instead.

Snapshots require a deployed app. A `modal run` serving experiment does not test snapshot restore. Most practical multi-GPU workloads are not supported. `TORCHINDUCTOR_COMPILE_THREADS=1` addresses some compilation failures, not all. The exact L40S, LoRA, compressed-tensors and sleep/restore combination remains open until tested. Use `TRUFFLE_GPU_SNAPSHOT=0` to isolate snapshot failures from model-load failures.

### New weights or adapter, old snapshot

Volume updates do not refresh a captured engine. The [Volume guide](https://modal.com/docs/guide/volumes) distinguishes commit from reload. The [snapshot guide](https://modal.com/docs/guide/memory-snapshot) warns that changing or deleting referenced Volume files can break restores. Stop existing callers before changing the adapter. After a committed upload, set a new non-secret revision and deploy again:

```bash
TRUFFLE_DEPLOY_REVISION=real-adapter-v1 modal deploy brain-modal/modal_app.py
```

That value changes the image configuration so the old snapshot is not reused. Keep needed files until the old deployment has stopped. Do not call `make_dummy_lora` to replace a real adapter. The dummy marker makes its untrained status explicit.

### `weight_scale` and issue 38912

The supplied research note overgeneralized [vLLM issue 38912](https://github.com/vllm-project/vllm/issues/38912). The fetched issue is about **Gemma 4 26B MoE NVFP4/modelopt expert scale-name mapping**. It is not evidence that this dense RedHat compressed-tensors checkpoint fails, or that a specific workaround fixes it.

If this checkpoint raises a `weight_scale` KeyError, preserve the full traceback, pinned package versions, model revision and selected backend. Do not preemptively patch scale keys. Try the unquantized Plan B source through the current online quantizer. If LoRA remains rejected, use the merged fallback. None of those outcomes has been observed here.
