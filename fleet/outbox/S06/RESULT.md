# S06: Modal plan and serving pattern

Research date: 2026-10-07. All source fetch dates below are 2026-10-07.

## Outcome

The $30 monthly Starter credit is still listed. GPU use requires a valid payment method. Warm idle containers are billed. L40S is supported, but an explicit Starter L40S no-waitlist guarantee is not stated on the fetched pages. Sources: https://modal.com/pricing ; https://modal.com/docs/guide/gpu ; https://modal.com/docs/guide/cold-start (fetched 2026-10-07).

There is important example drift. The current general vLLM example uses `@app.server`, not `@modal.web_server`. The documented snapshot example still uses `@app.cls`, a vLLM subprocess, and `@modal.web_server`. Both are official patterns, but they have different configuration and authentication defaults. Sources: https://modal.com/docs/examples/vllm_inference ; https://modal.com/docs/examples/vllm_snapshot ; https://modal.com/docs/guide/webhook-proxy-auth (fetched 2026-10-07).

Scope and work performed: documentation spike only. Read the required project documents, plus `STATE.md`, `HANDOFF.md`, and `docs/01_product_spec.md`. No login, secret creation, deployment, model download, or GPU job was performed. Provider charges initiated by this spike: $0. Only this outbox memo was written. Commands below are documentation examples unless explicitly identified as local verification.

## 1. Plans and credit

| Question | Confirmed answer | Source and fetch date |
|---|---|---|
| Is $30/month current? | Yes. Starter is `$0 + compute / month`, with `$30 / month free credits`. Included credit is for GPU, CPU, and memory compute. | https://modal.com/pricing (fetched 2026-10-07) |
| Is a card required? | The GPU guide says a valid payment method is required for GPU use. The billing guide says a payment method is required to use Modal. The pricing page does not state a credit-card requirement specifically. A card-free GPU trial is not documented. | https://modal.com/docs/guide/gpu ; https://modal.com/docs/guide/billing ; https://modal.com/pricing (fetched 2026-10-07) |
| GPU concurrency | Starter lists 10 GPU concurrency. | https://modal.com/pricing (fetched 2026-10-07) |
| Containers | Starter lists 100 containers. The scaling guide identifies plan-dependent workspace limits on concurrent containers and GPUs. | https://modal.com/pricing ; https://modal.com/docs/guide/scale (fetched 2026-10-07) |
| Deployed apps | Starter lists 200. | https://modal.com/pricing (fetched 2026-10-07) |
| Web endpoints | The wording is `Scheduled and Web Functions (limited)`. A numeric Starter web endpoint allowance is not stated on the page. Do not substitute an assumed limit of 8. | https://modal.com/pricing (fetched 2026-10-07) |
| Scheduled jobs | Starter lists 5 deployed crons. | https://modal.com/pricing (fetched 2026-10-07) |
| Other useful limit | Starter log retention is 1 day. | https://modal.com/pricing (fetched 2026-10-07) |

Shared Endpoints are a separate, per-token product. Starter has no free Shared Endpoint usage. Do not confuse that product with a self-hosted vLLM GPU container. Source: https://modal.com/pricing (fetched 2026-10-07).

## 2. GPU, CPU, memory, and idle billing

These are listed base prices. They are not a measured Truffle bill. Source: https://modal.com/pricing (fetched 2026-10-07).

| Resource | USD per second | Source and fetch date |
|---|---:|---|
| L40S | $0.000542 per GPU | https://modal.com/pricing (fetched 2026-10-07) |
| A100 40 GB | $0.000583 per GPU | https://modal.com/pricing (fetched 2026-10-07) |
| A100 80 GB | $0.000694 per GPU | https://modal.com/pricing (fetched 2026-10-07) |
| H100 SXM5 | $0.001097 per GPU | https://modal.com/pricing (fetched 2026-10-07) |
| CPU | $0.0000131 per physical core | https://modal.com/pricing (fetched 2026-10-07) |
| Memory | $0.00000222 per GiB | https://modal.com/pricing (fetched 2026-10-07) |

- CPU is measured in physical cores. One physical core corresponds to two vCPUs in the pricing explanation. Default container requests are 0.125 CPU cores and 128 MiB memory. CPU and memory charges use the higher of requested resources and actual usage. Sources: https://modal.com/pricing ; https://modal.com/docs/guide/resources (fetched 2026-10-07).
- **Yes, warm idle time is billed.** The cold-start guide explicitly includes GPU reservation and residual memory occupancy as idle resources. CPU and memory do not get a separate free idle rate. Apply the resource rates and requested-versus-actual rule above. Sources: https://modal.com/docs/guide/cold-start ; https://modal.com/docs/guide/resources ; https://modal.com/pricing (fetched 2026-10-07).
- The pricing FAQ includes application load time, processing time, and the default 60-second idle period before shutdown. Billing stops when the app scales to zero containers. The billing guide says there are no minimum usage-time increments. Sources: https://modal.com/pricing ; https://modal.com/docs/guide/billing (fetched 2026-10-07).
- The pricing headline says, `You never pay for idle resources.` Its detailed FAQ nevertheless says the post-input keepalive period is billed. Use the FAQ and cold-start guide for budget planning. Sources: https://modal.com/pricing ; https://modal.com/docs/guide/cold-start (fetched 2026-10-07).
- `scaledown_window` is the maximum idle period before scale-down. The documented default is 60 seconds. Its range is 2 seconds to 20 minutes, or 1,200 seconds. Containers can shut down earlier when the app is substantially overprovisioned. A nonzero warm pool can keep containers running beyond that window. Sources: https://modal.com/docs/guide/cold-start ; https://modal.com/docs/guide/scale (fetched 2026-10-07).
- Arithmetic illustration, not observed spend: one L40S held for 300 idle seconds costs $0.1626 for GPU alone. At 900 seconds it costs $0.4878 for GPU alone. CPU, memory, and applicable multipliers are extra. These figures are `seconds * $0.000542`. Sources for rate and billable idle time: https://modal.com/pricing ; https://modal.com/docs/guide/cold-start (fetched 2026-10-07).
- Explicit container region selection has a 1.15x multiplier for broad regions and 1.75x for narrow regions. The pricing page separately lists non-preemptible execution at 3x base prices. These are not included in the table above. Sources: https://modal.com/docs/guide/region-selection ; https://modal.com/pricing (fetched 2026-10-07).

## 3. Availability and quotas

- `gpu="L40S"` is supported. The GPU guide describes 48 GB of GPU RAM and recommends L40S for neural-network inference. Starter lists a GPU concurrency allowance of 10. Sources: https://modal.com/docs/guide/gpu ; https://modal.com/pricing (fetched 2026-10-07).
- **Explicit L40S general availability on Starter with no waitlist: not stated on the page.** Neither the GPU guide nor pricing page promises immediate allocation for a new Starter account. Do not report a successful allocation without the S01 runtime test. Sources: https://modal.com/docs/guide/gpu ; https://modal.com/pricing (fetched 2026-10-07).
- A valid payment method is required for GPUs. The guide supports up to eight L40S GPUs per container, but says requesting more than two GPUs per container usually increases wait times. This is not a promise about single-GPU wait time. Source: https://modal.com/docs/guide/gpu (fetched 2026-10-07).
- The guide supports `A100`, `A100-40GB`, and `A100-80GB`. A request for `A100` can be upgraded to an 80 GB device without a cost increase. Source: https://modal.com/docs/guide/gpu (fetched 2026-10-07).
- Region selection includes broad `us`, `eu`, and `ap` choices and narrower choices. The region guide says broader selections improve cold-start time and availability. A per-region L40S inventory or Starter-specific L40S region matrix is not stated on the page. Source: https://modal.com/docs/guide/region-selection (fetched 2026-10-07).
- Container placement and input routing are different controls. Inputs route through `us-east` by default. `routing_region` can change that. The pricing multiplier is described for a defined container region. Whether `routing_region` alone triggers a multiplier is not stated on the page. Source: https://modal.com/docs/guide/region-selection (fetched 2026-10-07).

## 4. Memory snapshots

### Current API and CPU-only boundary

CPU snapshots use `enable_memory_snapshot=True` on `@app.function` or `@app.cls`. Global-scope initialization is captured. `@modal.enter(snap=True)` runs before the snapshot. `@modal.enter(snap=False)` runs after restore. Snapshot creation is for deployed apps, not ephemeral `modal run` apps. Sources: https://modal.com/docs/guide/memory-snapshots ; https://modal.com/docs/examples/vllm_snapshot (fetched 2026-10-07).

CPU-only example shape, abridged from the guide. Definitions and imports are omitted. This is not a standalone program:

```python
@app.cls(gpu="a10", volumes={"/models": model_vol}, enable_memory_snapshot=True)
class Embedder:
    @modal.enter(snap=True)
    def load(self):
        self.model = SentenceTransformer("/models/BAAI/bge-small-en-v1.5", device="cpu")

    @modal.enter(snap=False)
    def setup(self):
        self.model.to("cuda")
```

Source for this shape: https://modal.com/docs/guide/memory-snapshots (fetched 2026-10-07).

- Without GPU snapshots, GPUs are unavailable in `snap=True`. Do not move the model to CUDA there. The guide warns that `torch.cuda.is_available()` and `torch.cuda.get_device_capability()` can initialize CUDA with zero devices during snapshotting and cause later failures. It documents an xformers-related `XFORMERS_ENABLE_TRITON=1` workaround. Source: https://modal.com/docs/guide/memory-snapshots (fetched 2026-10-07).
- The guide does not phrase this as a universal prohibition on every possible CUDA context. Its concrete CPU-only boundary is GPU unavailability and accidental CUDA initialization. Source: https://modal.com/docs/guide/memory-snapshots (fetched 2026-10-07).

### GPU snapshots and restrictions

- GPU snapshots add `experimental_options={"enable_gpu_snapshot": True}` alongside `enable_memory_snapshot=True`. GPUs are then available in `snap=True`. The guide labels GPU snapshots **alpha**. Source: https://modal.com/docs/guide/memory-snapshots (fetched 2026-10-07).
- Most single-GPU CUDA functions can use them. Multi-GPU code is generally incompatible. Non-CUDA GPU activity, such as graphics, generally causes failures. `torch.compile` can prevent snapshot creation. `TORCHINDUCTOR_COMPILE_THREADS=1` fixes some cases, not all cases. Source: https://modal.com/docs/guide/memory-snapshots (fetched 2026-10-07).
- GPU snapshots do not speed up weight loading from storage and can add overhead there. The guide recommends discarding the unfilled KV cache before snapshotting and recreating it after restore. Source: https://modal.com/docs/guide/memory-snapshots (fetched 2026-10-07).
- Random values captured in a snapshot repeat after restore. Volume changes do not update existing snapshots. Removing files needed by a restore can break it. Code or configuration changes make previous snapshots obsolete. Source: https://modal.com/docs/guide/memory-snapshots (fetched 2026-10-07).
- **Open network connections:** a blanket Function-snapshot rule about open TCP connections is not stated on the page. The vLLM example uses a running subprocess and an HTTP listener. Its readiness probe closes its temporary socket. That does not establish that arbitrary established outbound connections can be safely snapshotted. Do not transplant Sandbox-specific rules into Function documentation. Sources: https://modal.com/docs/guide/memory-snapshots ; https://modal.com/docs/examples/vllm_snapshot (fetched 2026-10-07).
- Snapshot-specific rules for secrets, database sessions, and arbitrary external clients are not stated on the Function snapshot page. Source: https://modal.com/docs/guide/memory-snapshots (fetched 2026-10-07).

### Official vLLM snapshot example

The snapshot guide links `https://modal.com/docs/examples/vllm_snapshot`. That fetched example runs `mistralai/Ministral-3-8B-Instruct-2512` on `H100:1`. It pins `vllm==0.13.0`, `huggingface-hub==0.36.0`, and `flashinfer-python==0.5.3`. Its base image is CUDA 12.9.0 on Ubuntu 22.04 with Python 3.12. This is not a Gemma 4 31B validation. Sources: https://modal.com/docs/guide/memory-snapshots ; https://modal.com/docs/examples/vllm_snapshot (fetched 2026-10-07).

The official repository also has the Ministral snapshot implementation at `06_gpu_and_ml/llm-serving/ministral3_inference.py`. A file named `06_gpu_and_ml/llm-serving/vllm_snapshot.py` returned HTTP 404 during this spike. Use the documented example URL and the existing Ministral file, not that guessed filename. Sources: https://github.com/modal-labs/modal-examples/blob/main/06_gpu_and_ml/llm-serving/ministral3_inference.py ; https://github.com/modal-labs/modal-examples/blob/main/06_gpu_and_ml/llm-serving/vllm_snapshot.py (fetched 2026-10-07).

Minimal official code shape below. Comments and command construction are omitted. `...` marks omitted source, so this is not a runnable deployment. The helper functions are defined in the full official example:

```python
vllm_image = vllm_image.env(
    {
        "VLLM_SERVER_DEV_MODE": "1",
        "TORCHINDUCTOR_COMPILE_THREADS": "1",
    }
)

@app.cls(
    image=vllm_image,
    gpu=f"H100:{N_GPU}",
    scaledown_window=15 * MINUTES,
    timeout=10 * MINUTES,
    volumes={
        "/root/.cache/huggingface": hf_cache_vol,
        "/root/.cache/vllm": vllm_cache_vol,
    },
    enable_memory_snapshot=True,
    experimental_options={"enable_gpu_snapshot": True},
)
@modal.concurrent(max_inputs=32)
class VllmServer:
    @modal.enter(snap=True)
    def start(self):
        ...
        self.vllm_proc = subprocess.Popen(cmd)
        wait_ready(self.vllm_proc)
        warmup()
        sleep()

    @modal.enter(snap=False)
    def wake_up(self):
        wake_up()
        wait_ready(self.vllm_proc)

    @modal.web_server(port=VLLM_PORT, startup_timeout=10 * MINUTES)
    def serve(self):
        pass

    @modal.exit()
    def stop(self):
        self.vllm_proc.terminate()
```

Sources for the code shape: https://modal.com/docs/examples/vllm_snapshot ; https://github.com/modal-labs/modal-examples/blob/main/06_gpu_and_ml/llm-serving/ministral3_inference.py (fetched 2026-10-07).

The omitted command invokes `vllm serve` with `--enable-sleep-mode`, `--gpu_memory_utilization 0.95`, `--max-num-seqs 2`, `--max-model-len 12288`, and `--max-num-batched-tokens 12288`. Those values make the example's KV cache small and predictable. They are example-specific values, not a documented Gemma recommendation. Source: https://modal.com/docs/examples/vllm_snapshot (fetched 2026-10-07).

`warmup()` sends three chat requests. `sleep()` POSTs to `/sleep?level=1` before capture. The example says this offloads weights to CPU and empties the KV cache. `wake_up()` POSTs to `/wake_up` after restore. `VLLM_SERVER_DEV_MODE=1` enables those endpoints. These details must travel with the snapshot pattern. Source: https://modal.com/docs/examples/vllm_snapshot (fetched 2026-10-07).

The example says snapshot speedups may take several cold starts, usually fewer than five, to appear. Separately, Modal's 45-second to 5-second vLLM result used Qwen2.5-0.5B-Instruct. Hardware and context length for that measurement are not stated on the blog page. Do not promise those numbers for Truffle. Sources: https://modal.com/docs/examples/vllm_snapshot ; https://modal.com/blog/gpu-mem-snapshots (fetched 2026-10-07).

## 5. vLLM serving pattern and request body

### Current official general example

- Repository path: `06_gpu_and_ml/llm-serving/vllm_inference.py`. The fetched history identifies commit `f3c14b7f6e583045699e6aedffb687488eb08919`, dated July 9, 2026, with title `migrate from web_server to app.server in vllm inference (#1602)`. The commit-pinned file was fetched too. Sources: https://github.com/modal-labs/modal-examples/commits/main/06_gpu_and_ml/llm-serving/vllm_inference.py ; https://github.com/modal-labs/modal-examples/blob/f3c14b7f6e583045699e6aedffb687488eb08919/06_gpu_and_ml/llm-serving/vllm_inference.py (fetched 2026-10-07).
- The current example uses `@app.server(...)`, `@modal.enter()` to launch `subprocess.Popen(cmd)`, and `@modal.exit()` to terminate the process. It runs the `vllm serve` CLI. It does not instantiate an in-process `vllm.LLM` engine. Source: https://modal.com/docs/examples/vllm_inference (fetched 2026-10-07).
- Its example configuration is `vllm==0.21.0`, `H200:1`, Gemma 4 26B-A4B, a pinned model revision, and a speculative assistant model. It sets `target_concurrency=100`, a 15-minute `scaledown_window`, a 10-minute `startup_timeout`, port 8000, and `unauthenticated=True`. Those are the example's choices, not Truffle defaults. Source: https://modal.com/docs/examples/vllm_inference (fetched 2026-10-07).
- **Recommended `--max-model-len` in the current general example: not stated on the page. Recommended `gpu_memory_utilization`: not stated on the page.** Neither flag appears in the fetched commit-pinned file. The snapshot example separately uses 12288 and 0.95. Neither source validates 16384 for Gemma 4 31B on L40S. Sources: https://github.com/modal-labs/modal-examples/blob/f3c14b7f6e583045699e6aedffb687488eb08919/06_gpu_and_ml/llm-serving/vllm_inference.py ; https://modal.com/docs/examples/vllm_snapshot (fetched 2026-10-07).

The official client puts `chat_template_kwargs` at the top level of the JSON request payload. Exact relevant line:

```python
payload["chat_template_kwargs"] = {"enable_thinking": True}
```

Source: https://github.com/modal-labs/modal-examples/blob/f3c14b7f6e583045699e6aedffb687488eb08919/06_gpu_and_ml/llm-serving/vllm_inference.py (fetched 2026-10-07).

For a Worker sending raw JSON, the documented shape is a top-level `chat_template_kwargs` object in the chat-completions body. An OpenAI Python SDK `extra_body` recipe is not stated in this example. The fetched example also does not establish the behavior of Truffle's 31B checkpoint with both thinking values and LoRA. Source: https://modal.com/docs/examples/vllm_inference (fetched 2026-10-07).

### Do not silently mix the APIs

`@app.server` is documented as the closest analogue to `@modal.web_server` Functions, but migration requires accounting for scaling, authentication, and configuration differences. Servers require auth by default. They do not provide Function-style built-in serialization, retries, or timeouts. Source: https://modal.com/docs/guide/servers (fetched 2026-10-07).

The Servers guide says requests receive HTTP 503 when no active containers exist. It also says autoscaling engages only when `target_concurrency` is set. Do not assume the newer general example has the same scale-from-zero request behavior as the Function-based snapshot example. The end-to-end consequence for Truffle was not runtime-tested here. Source: https://modal.com/docs/guide/servers (fetched 2026-10-07).

## 6. Authentication

### Modal proxy authentication

For Web Functions, use `requires_proxy_auth=True` on `@modal.fastapi_endpoint`, `@modal.asgi_app`, `@modal.wsgi_app`, or `@modal.web_server`. They are public by default without this setting. `@app.server` instead requires proxy auth by default unless `unauthenticated=True` is set. Source: https://modal.com/docs/guide/webhook-proxy-auth (fetched 2026-10-07).

Documented header choices:

```text
Modal-Key: <TOKEN_ID>
Modal-Secret: <TOKEN_SECRET>
```

Or the documented combined form:

```text
Authorization: Bearer <TOKEN_ID>.<TOKEN_SECRET>
```

Source for both header forms: https://modal.com/docs/guide/webhook-proxy-auth (fetched 2026-10-07).

Tokens are created in Settings > Proxy Auth Tokens or with `modal workspace proxy-tokens create --name <label>`. The CLI prints the ID and secret only at creation. The secret cannot be retrieved later. Environment scoping applies to RBAC-enabled workspaces. Sources: https://modal.com/docs/guide/webhook-proxy-auth ; https://modal.com/docs/cli/latest/workspace (fetched 2026-10-07).

These credentials give the Worker a provisioned token pair it can send on requests. A single Worker secret can hold the documented `ID.SECRET` combined value. This does not establish a guaranteed perpetual lifetime: expiration and lifetime are not stated on these pages. Sources: https://modal.com/docs/guide/webhook-proxy-auth ; https://modal.com/docs/cli/latest/workspace (fetched 2026-10-07).

Proxy Tokens are not the Modal API tokens used for SDK calls. Do not send deployment credentials as endpoint credentials. Source: https://modal.com/docs/guide/trigger-deployed-functions (fetched 2026-10-07).

### Custom FastAPI bearer check

The Web Functions guide documents `HTTPBearer` and comparing `token.credentials` with `os.environ["AUTH_TOKEN"]`. Attach that environment variable using `modal.Secret.from_name`. That gives the application an operator-chosen static bearer value. Source: https://modal.com/docs/guide/webhooks (fetched 2026-10-07).

Minimal adaptation of the documented check. The page's secret-printing line is intentionally omitted. This only demonstrates authentication, not forwarding or SSE handling:

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import modal

image = modal.Image.debian_slim().pip_install("fastapi[standard]")
app = modal.App("auth-example", image=image)
auth_scheme = HTTPBearer()

@app.function(secrets=[modal.Secret.from_name("my-web-auth-token")])
@modal.fastapi_endpoint()
async def f(token: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    import os

    if token.credentials != os.environ["AUTH_TOKEN"]:
        raise HTTPException(
            status_code=401,
            detail="Incorrect bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return "success!"
```

Source for the adapted check and the omitted logging line: https://modal.com/docs/guide/webhooks (fetched 2026-10-07).

The custom header is:

```text
Authorization: Bearer <APP_AUTH_TOKEN>
```

Source: https://modal.com/docs/guide/webhooks (fetched 2026-10-07).

**Answer for Truffle:** both patterns supply credentials the Worker can store and send. Custom auth matches an arbitrary single `MODAL_TOKEN`. Proxy auth can also fit a single stored value using `ID.SECRET`, without implementing the token check in FastAPI. Proxy auth rejects unauthorized traffic before the endpoint executes. Any choice to replace the architecture's custom proxy remains an integration decision, not an edit made by this spike. Sources: https://modal.com/docs/guide/webhook-proxy-auth ; https://modal.com/docs/guide/webhooks (fetched 2026-10-07).

## 7. Scaling knobs

SDK signature defaults and service behavior are not the same thing. The current `App.function` and `App.cls` signatures use `None` for all four knobs below. Source: https://modal.com/docs/sdk/py/latest/App (fetched 2026-10-07).

| Knob | Meaning and documented default | Maximum or bound | Source and fetch date |
|---|---|---|---|
| `min_containers` | Warm minimum while inactive. Signature default `None`. Functions scale to zero by default. | A separate numeric parameter maximum is not stated on the page. Workspace quotas still apply. | https://modal.com/docs/sdk/py/latest/App ; https://modal.com/docs/guide/scale (fetched 2026-10-07) |
| `max_containers` | Cap on concurrently running containers. Signature default `None`. A numeric effective default cap is not stated on the page. | General single-Function cap is 4,000 concurrent containers. Starter has the lower workspace allowances of 100 containers and 10 GPU concurrency. | https://modal.com/docs/sdk/py/latest/App ; https://modal.com/docs/guide/scale ; https://modal.com/pricing (fetched 2026-10-07) |
| `buffer_containers` | Extra warm buffer while active. Signature default `None`. A numeric service default is not stated on the page. | A separate numeric parameter maximum is not stated on the page. Workspace quotas still apply. | https://modal.com/docs/sdk/py/latest/App ; https://modal.com/docs/guide/scale (fetched 2026-10-07) |
| `scaledown_window` | Maximum idle interval. Signature default `None`. The cold-start guide gives a 60-second service default. | 2 to 1,200 seconds. Overprovisioned containers can terminate sooner. | https://modal.com/docs/sdk/py/latest/App ; https://modal.com/docs/guide/cold-start ; https://modal.com/docs/guide/scale (fetched 2026-10-07) |

For Functions and classes, `@modal.concurrent(max_inputs=...)` controls simultaneous inputs per container. Apply it to the class, not individual class methods. `target_inputs` optionally sets the autoscaler's lower operating target. The guide says to configure `max_inputs`; although the SDK signature defaults to `None`, the guide does not establish omission as a useful configuration. A numeric upper bound is not stated on either fetched page. Sources: https://modal.com/docs/guide/concurrent-inputs ; https://modal.com/docs/sdk/py/latest/concurrent (fetched 2026-10-07).

Synchronous input concurrency uses threads and requires thread safety. Async concurrency uses tasks and must not block the event loop. GPU engines such as vLLM can continuously batch concurrent requests. The official snapshot example uses `max_inputs=32`; that is not a validated Truffle setting. Sources: https://modal.com/docs/guide/concurrent-inputs ; https://modal.com/docs/examples/vllm_snapshot (fetched 2026-10-07).

Servers use `target_concurrency` and `max_concurrency`, not the same `@modal.concurrent` configuration shown above. The Server API defaults these to `None`; unset or zero `max_concurrency` means unbounded. Requests over a configured cap get HTTP 503. The Server guide does not state a separate default or maximum for its `scaledown_window`. Do not automatically treat every Function bound as a Server guarantee. Sources: https://modal.com/docs/sdk/py/latest/App ; https://modal.com/docs/guide/servers (fetched 2026-10-07).

Budget-oriented integration proposal: explicitly set the Function/class configuration to `min_containers=0`, `max_containers=1`, and `buffer_containers=0` for the single-GPU spike. Choose the paid idle window deliberately. These are project choices, not Modal recommendations or verified runtime settings. Sources for their meanings and cost tradeoff: https://modal.com/docs/guide/scale ; https://modal.com/docs/guide/cold-start (fetched 2026-10-07).

## 8. Reading costs for the ledger

### What the primary docs confirm

| Location or command | What is documented | What is not confirmed | Source and fetch date |
|---|---|---|---|
| Settings > Usage & Billing, path `/settings/usage` | Workspace billing, payment management, invoices, receipts, and spend-budget controls. | Exact Starter per-run GPU-seconds and dollars columns are not stated on the page. | https://modal.com/docs/guide/billing ; https://modal.com/docs/guide/budgets (fetched 2026-10-07) |
| Dashboard App page, linked when the app starts | Application and system logs, CPU/RAM/GPU metrics, Function call history, historical success/failure counts. | A per-input billed GPU-seconds or dollars field is not stated on the page. | https://modal.com/docs/guide/developing-debugging (fetched 2026-10-07) |
| `modal app history APP_IDENTIFIER` | App deployment history. | Billing fields and per-run GPU seconds are not stated on the page. | https://modal.com/docs/cli/latest/app (fetched 2026-10-07) |
| `modal container list --app-id APP_ID` | Currently running containers for an app. | Cost fields, billed duration fields, and documented JSON keys are not stated on the page. | https://modal.com/docs/cli/latest/container (fetched 2026-10-07) |
| `modal billing report` or `Workspace.billing.report()` | Tabular spend reporting. Hourly or daily intervals. Resource-type breakdowns and tag attribution. The billing guide limits report export to Team and Enterprise. | Starter report availability and a per-run billed GPU-seconds column are not documented. | https://modal.com/docs/guide/billing ; https://modal.com/docs/cli/latest/billing ; https://modal.com/docs/sdk/py/latest/Workspace (fetched 2026-10-07) |

Documented report command shape, for an eligible workspace. Not executed:

```bash
modal billing report --for today --resolution h --show-resources --csv
```

Source for these flags: https://modal.com/docs/cli/latest/billing (fetched 2026-10-07).

Reports cover complete time intervals. Their costs are before credits, reservations, and the network egress allowance. Billing data can lag collection. Do not equate a report subtotal with final cash charged. Sources: https://modal.com/docs/cli/latest/billing ; https://modal.com/docs/guide/billing (fetched 2026-10-07).

GPU utilization is the percentage of time at least one CUDA kernel is executing. It is not a documented billable-seconds counter. Idle GPU reservations are still billed. Sources: https://modal.com/docs/guide/gpu-metrics ; https://modal.com/docs/guide/cold-start (fetched 2026-10-07).

### Ledger handoff

The docs-only result does **not** establish a Starter primary-source per-run GPU-seconds-and-dollars view. The signed-in owner must inspect Usage & Billing and the App view during S01. Preserve the actual record before treating a duration as billed GPU time. The CLI commands above are useful for identity and history, but their pages do not promise billing output. Sources: https://modal.com/docs/guide/billing ; https://modal.com/docs/guide/developing-debugging ; https://modal.com/docs/cli/latest/app ; https://modal.com/docs/cli/latest/container (fetched 2026-10-07).

Suggested ledger procedure, not a claim about available UI columns: record the app ID, container ID, GPU type, run timestamps, and any displayed resource duration and cost. Label an arithmetic estimate as an estimate. Include startup and paid keepalive. Keep gross compute consumption separate from out-of-pocket spend. Sources for the billing distinctions: https://modal.com/pricing ; https://modal.com/docs/guide/cold-start ; https://modal.com/docs/guide/billing ; https://modal.com/docs/guide/budgets (fetched 2026-10-07).

Workspace usage budgets are measured before credits. Spend limits cap net out-of-pocket charges after credits. An owner can therefore distinguish the total resource budget from the cash budget. This spike did not set either control. Source: https://modal.com/docs/guide/budgets (fetched 2026-10-07).

## 9. Volumes and weight downloads

### Creation and persistence

- `modal.Volume.from_name("model-weights-vol", create_if_missing=True)` retrieves or creates a named Volume. `version=2` explicitly selects v2. Sources: https://modal.com/docs/guide/volumes ; https://modal.com/docs/guide/model-weights (fetched 2026-10-07).
- Changes become visible outside the writer after a commit. Call `volume.commit()` for an explicit persistence point. Attached Volumes also receive background commits every few seconds and a final snapshot/commit on container shutdown. Source: https://modal.com/docs/guide/volumes (fetched 2026-10-07).
- Other existing containers must call `volume.reload()` to see committed changes. Files must be closed for reload. During reload the calling container sees the Volume as empty and cannot read or write it. Concurrent writes to the same file use last-write-wins semantics. Source: https://modal.com/docs/guide/volumes (fetched 2026-10-07).
- A memory snapshot does not automatically refresh when the Volume changes. Do not treat a new adapter file as an update to an already captured process. Source: https://modal.com/docs/guide/memory-snapshots (fetched 2026-10-07).

### Size and concurrency limits

| Version or scope | Documented limit | Source and fetch date |
|---|---|---|
| Volume total bytes | Volumes are not block devices and do not have a fixed capacity. A fixed total byte cap is not stated on the page. | https://modal.com/docs/guide/volumes (fetched 2026-10-07) |
| v1 | Hard limit of 500,000 inodes. Recommended maximum is 50,000 files and directories. Avoid more than five concurrent commits for small changes. | https://modal.com/docs/guide/volumes (fetched 2026-10-07) |
| v2 | Beta. No total file-count limit. At most 262,144 files in one directory. Each file must be less than 1 TiB. | https://modal.com/docs/guide/volumes (fetched 2026-10-07) |
| v2 writers | The page describes hundreds of containers writing distinct files without performance degradation. It does not make same-file writes safe. | https://modal.com/docs/guide/volumes (fetched 2026-10-07) |
| Web download | The web frontend downloads files up to 16 MB. Use `modal volume get` for larger files. This is not a Volume capacity limit. | https://modal.com/docs/guide/volumes (fetched 2026-10-07) |

There is a documentation inconsistency worth preserving. The general download section says there is no individual file-size limit. The v2 section explicitly says files must be below 1 TiB. Apply the v2-specific restriction when choosing v2. A clearly versioned v1 maximum file size is not stated on the page. Source: https://modal.com/docs/guide/volumes (fetched 2026-10-07).

The pricing page lists Volume storage at $0.09/GiB/month, including 1 TiB/month free. The Volume guide says storage is sampled daily and deleted data may remain billable for up to four days. Do not describe all storage as permanently free. Sources: https://modal.com/pricing ; https://modal.com/docs/guide/volumes (fetched 2026-10-07).

### Recommended current download pattern

The model-weights guide downloads inside a remote Modal Function with a mounted Volume. It uses `huggingface_hub.snapshot_download`, `local_dir=MODEL_DIR / repo_id`, a pinned revision, and `HF_XET_HIGH_PERFORMANCE=1`. It says to attach Modal Secrets for authenticated weights. This avoids making the laptop the download destination. Source: https://modal.com/docs/guide/model-weights (fetched 2026-10-07).

Compact adaptation of that guide, with an explicit commit from the Volume guide. It is a pattern only. It was not run:

```python
from pathlib import Path
import modal

app = modal.App("truffle-weight-download")
volume = modal.Volume.from_name("model-weights-vol", create_if_missing=True)
MODEL_DIR = Path("/models")

download_image = (
    modal.Image.debian_slim()
    .pip_install("huggingface_hub")
    .env({"HF_XET_HIGH_PERFORMANCE": "1"})
)

@app.function(
    image=download_image,
    volumes={MODEL_DIR.as_posix(): volume},
    secrets=[modal.Secret.from_name("truffle-hf")],
)
def download_model(repo_id: str, revision: str):
    from huggingface_hub import snapshot_download

    snapshot_download(
        repo_id=repo_id,
        local_dir=MODEL_DIR / repo_id,
        revision=revision,
    )
    volume.commit()
```

Sources for the adapted download, Secret attachment, and explicit commit: https://modal.com/docs/guide/model-weights ; https://modal.com/docs/guide/secrets ; https://modal.com/docs/guide/volumes (fetched 2026-10-07).

The exact `download_llama` example name could not be confirmed. `https://modal.com/docs/examples/download_llama` returned HTTP 404. A Modal article instead describes a `download.py` remote step that puts Llama weights into a Volume, but it does not include that script inline. The current model-weights guide above is the confirmed replacement pattern. Sources: https://modal.com/docs/examples/download_llama ; https://modal.com/blog/how_to_run_llama_405b_article ; https://modal.com/docs/guide/model-weights (fetched 2026-10-07).

## 10. Secrets and HF_TOKEN

The Secrets guide documents `modal secret create <name>` with `KEY=VALUE` pairs. Attach the Secret using `modal.Secret.from_name(...)` in a Function or class's `secrets` list. Values become container environment variables. Later Secrets in the list override earlier values with the same key. Source: https://modal.com/docs/guide/secrets (fetched 2026-10-07).

Documented command pattern and its HF-token application. These are placeholders and were not executed:

```bash
modal secret create name KEY=value
modal secret create truffle-hf HF_TOKEN="$HF_TOKEN"
```

Source for CLI key/value and environment-variable usage: https://modal.com/docs/guide/secrets (fetched 2026-10-07).

```python
hf_secret = modal.Secret.from_name("truffle-hf")

@app.function(secrets=[hf_secret])
def needs_hf_access():
    import os

    token = os.environ["HF_TOKEN"]
    # Pass to the authenticated client if needed. Do not print it.
```

Source for Secret lookup and environment injection: https://modal.com/docs/guide/secrets (fetched 2026-10-07).

The `HF_TOKEN` convention is explicitly present in an official historical example commit. Its comment says that for a gated model such as Mixtral 8x7B, `the HF_TOKEN environment variable must be set`. It tells the reader to share a token through a Secret named `huggingface-secret`. Its decorator attaches `modal.Secret.from_name("huggingface-secret")`. This confirms the convention, not a recommendation to copy that old vLLM implementation. The fetched commit page does not show its date. Source: https://github.com/modal-labs/modal-examples/commit/5df6466459eadd169f9c20cafb428edfc2d3449e (fetched 2026-10-07).

The CLI has `--force` to overwrite an existing Secret and accepts `--from-dotenv` and `--from-json`. This spike used none of them. No actual secret value appears in this memo. Source for the CLI options: https://modal.com/docs/cli/latest/secret (fetched 2026-10-07).

## Evidence and verification

Research used WebFetch against Modal documentation, pricing, and the official `modal-labs/modal-examples` repository. WebSearch was used for discovery with those source targets. Off-domain search hits were not fetched or used as evidence.

Representative fetched evidence:

```text
WebFetch https://modal.com/pricing
  Starter: $30 / month free credits
  GPU concurrency: 10
  Containers: 100
  L40S: $0.000542/sec

WebFetch https://modal.com/docs/guide/gpu
  "Using a GPU requires having a valid payment method on file."

WebFetch https://modal.com/docs/guide/cold-start
  "By default, the maximum idle time is 60 seconds."
  "it can be set anywhere between two seconds and twenty minutes."
  "you will be billed for any resources used while the container is idle"

WebFetch https://modal.com/docs/cli/latest/app
  modal app history: "Show an App's deployment history."

WebFetch https://github.com/modal-labs/modal-examples/commits/main/06_gpu_and_ml/llm-serving/vllm_inference.py
  f3c14b7f6e583045699e6aedffb687488eb08919
  Jul 9, 2026
  migrate from web_server to app.server in vllm inference (#1602)
```

Sources for the preceding evidence, all fetched 2026-10-07: https://modal.com/pricing ; https://modal.com/docs/guide/gpu ; https://modal.com/docs/guide/cold-start ; https://modal.com/docs/cli/latest/app ; https://github.com/modal-labs/modal-examples/commits/main/06_gpu_and_ml/llm-serving/vllm_inference.py .

Local verification is a document check only. It does not test Modal APIs, authentication, vLLM, snapshots, quotas, or billing. The abbreviated code blocks are not deployments. The URL check validates source scope, not HTTP availability or source entailment.

Executed local command:

```bash
python3 /home/abied/Desktop/Truffle/fleet/outbox/S06/verify_result.py
```

Observed output:

```text
PASS: 10 numbered sections; 10 dated summary lines
PASS: 6 Python excerpts parse as syntax only
PASS: 37 distinct source URLs stay in allowed domains/repository
PASS: no en/em dash characters; no token-shaped credential matches
```

## What this means for Truffle

1. Keep the $30 monthly compute-credit assumption, but arrange a valid payment method before a GPU run. Sources: https://modal.com/pricing ; https://modal.com/docs/guide/gpu (fetched 2026-10-07).
2. L40S is supported and Starter lists 10 GPU concurrency; no-waitlist allocation remains unconfirmed. Sources: https://modal.com/docs/guide/gpu ; https://modal.com/pricing (fetched 2026-10-07).
3. Treat 300-second and 900-second keepalive windows as paid capacity, not free warmth. Source: https://modal.com/docs/guide/cold-start (fetched 2026-10-07).
4. Start the Function-based spike with explicit zero minimum, one-container cap, and zero buffer as budget choices. Source for the knobs: https://modal.com/docs/guide/scale (fetched 2026-10-07).
5. Follow the snapshot example's subprocess, warmup, sleep, snapshot, and wake lifecycle; test with a deployment. Source: https://modal.com/docs/examples/vllm_snapshot (fetched 2026-10-07).
6. Do not copy the newer `@app.server` example without reviewing its auth and no-active-container 503 behavior. Sources: https://modal.com/docs/examples/vllm_inference ; https://modal.com/docs/guide/servers (fetched 2026-10-07).
7. Proxy auth supports one stored `ID.SECRET` bearer value; a custom bearer check is also documented. Sources: https://modal.com/docs/guide/webhook-proxy-auth ; https://modal.com/docs/guide/webhooks (fetched 2026-10-07).
8. Send `chat_template_kwargs` in the request body; neither fetched example validates Truffle's 31B context or LoRA settings. Sources: https://modal.com/docs/examples/vllm_inference ; https://modal.com/docs/examples/vllm_snapshot (fetched 2026-10-07).
9. Download pinned weights remotely into a Volume and inject access credentials with Modal Secrets. Sources: https://modal.com/docs/guide/model-weights ; https://modal.com/docs/guide/secrets (fetched 2026-10-07).
10. Confirm the Starter billing view before filling measured ledger values; app history and container list are not documented cost reports. Sources: https://modal.com/docs/guide/billing ; https://modal.com/docs/cli/latest/app ; https://modal.com/docs/cli/latest/container (fetched 2026-10-07).

## Could not confirm

- Explicit L40S GA/no-waitlist availability on a new Starter account, instantaneous capacity, or a per-region L40S inventory. Not stated on the fetched pages. Sources: https://modal.com/docs/guide/gpu ; https://modal.com/docs/guide/region-selection ; https://modal.com/pricing (fetched 2026-10-07).
- A numeric Starter web endpoint cap. Not stated on the page. Source: https://modal.com/pricing (fetched 2026-10-07).
- Credit-card-specific requirements distinct from a valid payment method, or this workspace's remaining credit. Not stated on the public pages. Sources: https://modal.com/docs/guide/gpu ; https://modal.com/docs/guide/billing (fetched 2026-10-07).
- Function-snapshot guarantees for established network connections, secret state, and arbitrary external clients. Not stated on the page. Source: https://modal.com/docs/guide/memory-snapshots (fetched 2026-10-07).
- Snapshot compatibility or cold-start performance for Gemma 4 31B FP8 plus LoRA on L40S. The fetched examples use different models and hardware. Sources: https://modal.com/docs/examples/vllm_snapshot ; https://modal.com/docs/examples/vllm_inference (fetched 2026-10-07).
- A general-example recommendation for 16384 context length or a GPU memory fraction. Not stated on the page. Source: https://modal.com/docs/examples/vllm_inference (fetched 2026-10-07).
- Proxy-token expiration or lifetime, and header precedence if both auth styles are sent. Not stated on the fetched pages. Sources: https://modal.com/docs/guide/webhook-proxy-auth ; https://modal.com/docs/cli/latest/workspace (fetched 2026-10-07).
- Separate numeric maxima for `min_containers`, `buffer_containers`, or `concurrent.max_inputs`, and a numeric default for `buffer_containers`. Not stated on the fetched pages. Sources: https://modal.com/docs/sdk/py/latest/App ; https://modal.com/docs/sdk/py/latest/concurrent ; https://modal.com/docs/guide/scale (fetched 2026-10-07).
- A Starter per-run primary-source GPU-seconds-and-dollars display or export. The fetched CLI pages do not promise it. Billing report exports are documented for Team and Enterprise. Sources: https://modal.com/docs/guide/billing ; https://modal.com/docs/cli/latest/app ; https://modal.com/docs/cli/latest/container (fetched 2026-10-07).
- The exact `download_llama` example and a clearly versioned v1 file-size ceiling. The attempted example URL returned 404, and the Volume page has conflicting general versus v2-specific wording. Sources: https://modal.com/docs/examples/download_llama ; https://modal.com/docs/guide/volumes (fetched 2026-10-07).
