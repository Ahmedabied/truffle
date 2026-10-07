# S01 result: serving script ready for the owner's remote test

Date: **2026-10-07**, Oman session. Status: **implemented and syntax-checked, not runtime-proven**.

No Modal token is present on this machine. The Modal package is not installed. Nothing ran on Modal. No model weights were downloaded, no GPU packages were installed locally, and no paid job was started. Provider cost initiated by this agent: **$0**. There are no latency or load-success results yet.

## Delivered

- `brain-modal/modal_app.py`: class-based Modal app. Two persistent Volumes. Separate CPU download and dummy-adapter functions. One L40S. Base and static rank-16 LoRA model names. Text-only 16K context. Authenticated streaming proxy. Snapshot and no-snapshot modes. Benchmark entrypoint. A100-80GB runtime-quantization and merged-model variants.
- `brain-modal/README.md`: ordered setup commands, both secrets, remote helper calls, deploy and benchmark commands, step-by-step cost estimates, Plan B commands, exact package pins, troubleshooting and source links.
- `fleet/outbox/S01/RESULT.md`: this report and the measurement template.

No files outside the permitted paths were changed. No git commit, push, checkout, stash or reset was run. Other agents' worktree changes were left alone.

### Important corrections to the packet's assumptions

1. **The current generic Modal vLLM example is not an authenticated snapshot example.** It uses `@app.server`, `target_concurrency=100` and `unauthenticated=True`. The separate snapshot example still uses `@app.cls`, `@modal.concurrent`, subprocess startup, sleep/wake and `@modal.web_server`. This script follows the latter and adds its own small FastAPI proxy. Sources: [general example](https://modal.com/docs/examples/vllm_inference), [snapshot example](https://modal.com/docs/examples/vllm_snapshot), [documented custom bearer check](https://modal.com/docs/guide/webhooks). Verified 2026-10-07.
2. **Plan B needs a new flag on the pinned release.** In vLLM 0.31.0, `--quantization fp8` no longer performs online quantization of an unquantized BF16 source. `Fp8Config` explicitly raises an error and directs users to `--quantization fp8_per_tensor`. The Plan B toggle uses the replacement. This is a deliberate correction, not an unreported departure. Sources: [pinned FP8 implementation](https://github.com/vllm-project/vllm/blob/v0.31.0/vllm/model_executor/layers/quantization/fp8.py), [FP8 guide](https://docs.vllm.ai/en/stable/features/quantization/llm_compressor/fp8/). Verified 2026-10-07.
3. **Issue 38912 is not proof of a dense RedHat FP8 failure.** It covers Gemma 4 26B MoE NVFP4/modelopt expert scale-name mapping. The issue does not validate the packet's claimed RedHat failure or workaround. Capture any actual `weight_scale` traceback from this spike before attributing it. Source: [issue 38912](https://github.com/vllm-project/vllm/issues/38912). Verified 2026-10-07.
4. **S06's edge-auth option is available.** I read `fleet/outbox/S06/RESULT.md` and independently checked the auth guide. `TRUFFLE_AUTH_MODE=proxy` sets `requires_proxy_auth=True`. A single Worker secret can hold `TOKEN_ID.TOKEN_SECRET` for the documented bearer format. The default remains the packet's required custom `truffle-brain` Secret check. The README recommends the edge-auth switch for production. It rejects unauthorized requests before the GPU starts. Sources: [proxy auth](https://modal.com/docs/guide/webhook-proxy-auth), [proxy token CLI](https://modal.com/docs/cli/latest/workspace), [custom bearer check](https://modal.com/docs/guide/webhooks). Verified 2026-10-07.

## Measurement table for the main session

All cells below are **unmeasured**. Enter seconds, not estimates. Warm p50 uses five requests for each token limit and thinking mode. Keep a separate row or table for each snapshot deployment if warm timings differ.

| Variant / served name | Load ok? | Cold start, no snapshot (s) | Cold start, snapshot restored (s) | Warm p50 120, thinking off (s) | Warm p50 400, thinking off (s) | Warm p50 1200, thinking off (s) | Warm p50 120, thinking on (s) | Warm p50 400, thinking on (s) | Warm p50 1200, thinking on (s) |
|---|---|---|---|---|---|---|---|---|---|
| L40S FP8 / `truffle-base` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| L40S FP8 + dummy rank-16 / `truffle` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| A100-80GB BF16 + online FP8 / `truffle-base`, if needed | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| A100-80GB BF16 + online FP8 + LoRA / `truffle`, if needed | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| A100-80GB merged BF16 + online FP8 / `truffle`, if needed | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

The cold metric is the first end-to-end request with at most one output token. It includes network, queueing and generation. It is not isolated engine initialization or TTFT. By default that request selects `truffle`. To fill a separate cold cell for the base, repeat after scale-to-zero with `--models truffle-base,truffle`. One container hosts both names, so do not count a following base request as another cold start.

The script records its observed container ID and snapshot configuration header. That header alone does not establish a restore. Check Modal's logs and zero-container state. The official example says benefits can take several cold starts to appear. Source: [snapshot example](https://modal.com/docs/examples/vllm_snapshot). Verified 2026-10-07.

Also record:

| Evidence | Owner result |
|---|---|
| Resolved HF commit from download manifest | TBD |
| Modal app ID, deployment revision and run timestamps | TBD |
| Dummy or real adapter, checksum and rank | TBD |
| Image build and installed versions | TBD |
| L40S VRAM used, KV cache capacity, 16K accepted | TBD |
| Actual GPU snapshot restore log | TBD |
| Thinking-on wire field: `reasoning`, `reasoning_content`, or neither | TBD |
| Actual completion tokens and `length` finishes per benchmark row | TBD |
| Missing/wrong token rejected; valid token accepted | TBD |
| SSE streams through proxy; private vLLM management routes blocked | TBD |
| Gross resource cost, credits applied and ledger entry | TBD |

## Pins and package evidence

All release metadata was read from PyPI on **2026-10-07**. No package wheel or model weight was installed or downloaded locally. The following are direct pins, not a complete transitive lock. The remote image build is still a required test.

| Package | Image pin | Latest release observed | Verified metadata URLs |
|---|---|---|---|
| vllm | 0.31.0 | 0.31.0, 2026-10-05 | https://pypi.org/pypi/vllm/json ; https://pypi.org/pypi/vllm/0.31.0/json |
| transformers | 5.17.0 | 5.19.0, 2026-10-06 | https://pypi.org/pypi/transformers/json ; https://pypi.org/pypi/transformers/5.17.0/json |
| torch | 2.13.0 | 2.14.1, 2026-09-30 | https://pypi.org/pypi/torch/json ; https://pypi.org/pypi/torch/2.13.0/json |
| peft | 0.21.2 | 0.21.2, 2026-10-01 | https://pypi.org/pypi/peft/json ; https://pypi.org/pypi/peft/0.21.2/json |
| huggingface_hub | 1.33.0 | 2.1.1, 2026-10-01 | https://pypi.org/pypi/huggingface_hub/json ; https://pypi.org/pypi/huggingface_hub/1.33.0/json |
| safetensors | 0.8.0 | 0.8.0, 2026-06-09 | https://pypi.org/pypi/safetensors/json ; https://pypi.org/pypi/safetensors/0.8.0/json |
| modal | 1.6.1 | 1.6.1, 2026-10-03 | https://pypi.org/pypi/modal/json ; https://pypi.org/pypi/modal/1.6.1/json |
| fastapi | 0.136.3, standard extra | 0.142.3, 2026-10-07 | https://pypi.org/pypi/fastapi/json ; https://pypi.org/pypi/fastapi/0.136.3/json |
| httpx | 0.28.1 | 0.28.1 | https://pypi.org/pypi/httpx/json |

Relevant metadata constraints, observed 2026-10-07:

```text
vllm 0.31.0:
  torch==2.13.0
  transformers<5.18.0,>=5.10.4
  huggingface_hub>=1.31.0
  safetensors>=0.6.2
  fastapi[standard]<0.137.0,>=0.133.0
transformers 5.17.0:
  huggingface-hub<2.0,>=1.5.0
  safetensors>=0.8.0
```

Sources: https://pypi.org/pypi/vllm/json ; https://pypi.org/pypi/transformers/5.17.0/json . Verified 2026-10-07. This is why latest Torch, Transformers and Hub were not blindly selected. The [vLLM 0.31 release notes](https://github.com/vllm-project/vllm/releases/tag/v0.31.0) include Gemma 4 changes and the Transformers 5.17 update. Verified 2026-10-07.

## API verification ledger

Each entry is a source-backed API claim. Settings such as 0.88 GPU utilization, two sequences and 64 GiB host RAM are project choices. They are not provider performance guarantees. Every source in this table was fetched on **2026-10-07**.

| Claim used by the implementation | Verified URL | Checked |
|---|---|---|
| Generic vLLM example now uses `@app.server`, not the snapshot decorator stack; it does not implement custom bearer auth | https://modal.com/docs/examples/vllm_inference ; https://github.com/modal-labs/modal-examples/blob/main/06_gpu_and_ml/llm-serving/vllm_inference.py | 2026-10-07 |
| Official vLLM snapshot pattern uses class, subprocess, warmup, sleep, restore, wake and `@modal.web_server` | https://modal.com/docs/examples/vllm_snapshot | 2026-10-07 |
| GPU snapshots require `enable_memory_snapshot=True` and `experimental_options={"enable_gpu_snapshot": True}`; `enter(snap=True/False)` selects lifecycle phase | https://modal.com/docs/guide/memory-snapshot ; https://modal.com/docs/guide/memory-snapshots | 2026-10-07 |
| GPU snapshots are alpha; deployed apps only; practical multi-GPU restrictions; compile thread mitigation; Volume edits do not update snapshots | https://modal.com/docs/guide/memory-snapshot ; https://modal.com/docs/examples/vllm_snapshot | 2026-10-07 |
| Class decorator accepts `startup_timeout`, `timeout`, `min_containers`, `max_containers`, `buffer_containers`, `scaledown_window` and snapshot options | https://modal.com/docs/sdk/py/latest/App | 2026-10-07 |
| `@modal.concurrent(max_inputs=32, target_inputs=2)` belongs at class scope; max and target are different controls | https://modal.com/docs/reference/modal.concurrent | 2026-10-07 |
| `@modal.web_server` accepts `port`, `startup_timeout` and `requires_proxy_auth` | https://modal.com/docs/reference/modal.web_server | 2026-10-07 |
| ASGI lifespan and a FastAPI HTTPBearer check backed by a Secret are documented patterns | https://modal.com/docs/guide/webhooks | 2026-10-07 |
| Edge proxy auth accepts `Authorization: Bearer TOKEN_ID.TOKEN_SECRET`; Web Functions opt in with `requires_proxy_auth=True` | https://modal.com/docs/guide/webhook-proxy-auth | 2026-10-07 |
| Proxy Token creation command is `modal workspace proxy-tokens create --name NAME`; values print once | https://modal.com/docs/cli/latest/workspace | 2026-10-07 |
| `Secret.from_name(..., required_keys=[...])` and CLI `KEY=value` attach env values to functions/classes | https://modal.com/docs/reference/modal.Secret ; https://modal.com/docs/guide/secrets ; https://modal.com/docs/cli/latest/secret | 2026-10-07 |
| `Volume.from_name(create_if_missing=True)`, explicit commit and reload are supported; reload needs closed files | https://modal.com/docs/guide/volumes | 2026-10-07 |
| Downloading via `snapshot_download(local_dir=..., revision=...)` inside a remote function with a mounted Volume is recommended | https://modal.com/docs/guide/model-weights | 2026-10-07 |
| `scaledown_window=300` is within the documented range; warm idle resources are billed | https://modal.com/docs/guide/cold-start | 2026-10-07 |
| CPU requests use physical cores; memory request examples use MiB; billing uses higher of request and actual usage | https://modal.com/docs/guide/resources | 2026-10-07 |
| L40S $0.000542/s; A100-80GB $0.000694/s; CPU/RAM and Volume prices; Starter $30/month listed | https://modal.com/pricing | 2026-10-07 |
| Gemma4 causal and conditional-generation models list LoRA support; this is not a quantized-combination test | https://docs.vllm.ai/en/latest/models/supported_models.html | 2026-10-07 |
| Gemma 4 recipe specifies reasoning parser and template; raw JSON thinking toggle; `message.reasoning`; tool flags when tools are used | https://docs.vllm.ai/projects/recipes/en/stable/Google/Gemma4.html | 2026-10-07 |
| Versioned Gemma 4 template exists; thinking-off generation includes an empty thought block | https://github.com/vllm-project/vllm/blob/v0.31.0/examples/tool_chat_template_gemma4.jinja | 2026-10-07 |
| Current `--language-model-only` zeros all modality limits; memory, context, sleep and prefix-caching flags exist | https://docs.vllm.ai/en/stable/configuration/engine_args/ | 2026-10-07 |
| Static LoRA flags accept `--enable-lora --lora-modules name=path --max-lora-rank 16`; clients select the adapter's name | https://docs.vllm.ai/en/stable/features/lora/ | 2026-10-07 |
| vLLM's Gemma 4 mapping handles `model.language_model.*`; attention/MLP packed modules include these LoRA targets | https://raw.githubusercontent.com/vllm-project/vllm/refs/tags/v0.31.0/vllm/model_executor/models/gemma4_mm.py | 2026-10-07 |
| Sleep level 1 offloads weights to host RAM and discards KV; development endpoint flag and sleep/wake URLs | https://docs.vllm.ai/en/stable/features/sleep_mode/ | 2026-10-07 |
| FP8 W8A8 supports Ada; Ampere uses weight-only W8A16 Marlin; online method is `fp8_per_tensor` in current docs | https://docs.vllm.ai/en/stable/features/quantization/llm_compressor/fp8/ | 2026-10-07 |
| Legacy `fp8` method explicitly rejects online BF16 quantization on v0.31.0 | https://github.com/vllm-project/vllm/blob/v0.31.0/vllm/model_executor/layers/quantization/fp8.py | 2026-10-07 |
| vLLM 0.31 Dockerfile defaults to CUDA 13.0.3 and Python 3.12 | https://github.com/vllm-project/vllm/blob/v0.31.0/docker/Dockerfile | 2026-10-07 |
| Issue 38912 concerns MoE NVFP4/modelopt scale-name mapping, not a demonstrated dense RedHat failure | https://github.com/vllm-project/vllm/issues/38912 | 2026-10-07 |

The proxy's daemon listener thread, route allowlist, constant-time bearer comparison, SSE forwarding, container identity header and benchmark logic are original code. The upstream examples do not establish their correctness. They need the remote smoke checks listed above.

### Dummy adapter shape evidence

The RedHat config describes a 60-layer dense text backbone. Local and global attention have different head dimensions and KV-head counts. Global layers can share K/V and omit a separate `v_proj`. The helper derives names from a meta-device Transformers skeleton instead of guessing tensor dimensions. Sources: [cached model config source](https://huggingface.co/RedHatAI/gemma-4-31B-it-FP8-dynamic/blob/main/config.json), [Transformers 5.17 implementation](https://raw.githubusercontent.com/huggingface/transformers/refs/tags/v5.17.0/src/transformers/models/gemma4/modeling_gemma4.py). Verified 2026-10-07.

PEFT checkpoint keys omit the live adapter-name segment. `get_peft_model_state_dict` supplies the names. `LoraConfig.save_pretrained` supplies the config. Safetensors stores only the small random CPU tensors. Source for the checkpoint naming contract: https://huggingface.co/docs/peft/developer_guides/checkpoint . Verified 2026-10-07. The helper has not executed with these pins.

## Local verification and exact output

The required compile command was run. The cache location was moved under the permitted outbox so compilation did not create `brain-modal/__pycache__`.

```bash
export PYTHONPYCACHEPREFIX=/home/abied/Desktop/Truffle/fleet/outbox/S01/.compile-cache
python3 -m py_compile brain-modal/modal_app.py
```

`py_compile` itself produced no stdout or stderr. The shell status check printed:

```text
py_compile exit status: 0
```

The generated outbox cache was removed after the successful check. This checks syntax only. It does not import Modal, resolve the image or run the app.

A stdlib-only metadata query also printed:

```text
vllm latest=0.31.0 uploaded=2026-10-05
transformers latest=5.19.0 uploaded=2026-10-06
torch latest=2.14.1 uploaded=2026-09-30
peft latest=0.21.2 uploaded=2026-10-01
huggingface_hub latest=2.1.1 uploaded=2026-10-01
safetensors latest=0.8.0 uploaded=2026-06-09
modal latest=1.6.1 uploaded=2026-10-03
```

Source URLs for that query are the `/pypi/PACKAGE/json` URLs in the pin table. It read JSON only. No local GPU framework was imported.

Additional local checks used stdlib `ast.parse`, `bash -n` on each README shell block, and `git diff --check -- brain-modal/README.md`. No shell block was executed. The formatting check produced no output. The static checks printed:

```text
PASS: AST parse, 595 source lines
PASS: no top-level GPU or proxy framework imports
PASS: no en/em dash characters in brain-modal/modal_app.py
PASS: no en/em dash characters in brain-modal/README.md
PASS: no en/em dash characters in fleet/outbox/S01/RESULT.md
PASS: 7 README shell blocks parse with bash -n (not executed)
PASS: required README section order
```

## Open questions and next action

1. Does the image resolve and build with these direct pins and the CUDA base tag? No remote build has run. Transitive dependencies are not fully locked.
2. Does the meta-device helper run under PEFT 0.21.2 and Transformers 5.17.0, and do its serialized names load through the pinned vLLM mapper?
3. Does the dense compressed-tensors checkpoint plus rank-16 LoRA fit a real L40S at 16K with this memory budget? The supported-model table is not proof.
4. Does sleep/wake preserve the adapter and produce a usable GPU snapshot on this exact stack? Does the restored endpoint really lower cold latency?
5. Does thinking return `reasoning` on this pinned server, and what fraction of small-budget thinking replies have no final text?
6. Does the proxy authenticate missing and wrong tokens, stream SSE, and reject management endpoints after restore? Test both auth modes if the owner switches modes.
7. Can the owner's account allocate the GPU, and what credit and billing views are actually available? S06 records the documentation limits.
8. Does Plan B's current online quantizer work with LoRA on A100? If not, the owner must supply a training-GPU-merged BF16 repo. The script does not perform that merge.
9. Secret rotation across snapshots and credential-header behavior at the Modal edge were not specified by the fetched docs. Verify before relying on a rotation procedure.

**Next action:** the main session should follow `brain-modal/README.md`, starting with setup, secret creation and the CPU helper calls. Use a cheap one-sample smoke test before the full benchmark if desired. Then run the five-sample benchmark after confirming scale-to-zero. Record actual errors or numbers in this table and the owner's cost ledger. No performance or load-success claim should be published before that run.
