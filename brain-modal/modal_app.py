"""Truffle S01: a remote-only Gemma 4 serving spike. See README.md before running."""

import json
import os
from pathlib import Path
import statistics
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

import modal


# Read these in the deploying shell. Non-secret settings also travel in the image.
PLAN_B = os.environ.get("TRUFFLE_PLAN_B", "0") == "1"
GPU_SNAPSHOT = os.environ.get("TRUFFLE_GPU_SNAPSHOT", "1") == "1"
# One GPU type, or a comma list in priority order (Modal schedules the first
# type with capacity). Default follows the plan. Example: TRUFFLE_GPU=L40S,A100-80GB
_gpu_env = os.environ.get("TRUFFLE_GPU", "")
GPU_TYPES = [g.strip() for g in _gpu_env.split(",") if g.strip()] if _gpu_env else ("A100-80GB" if PLAN_B else "L40S")
USE_HF_SECRET = os.environ.get("TRUFFLE_USE_HF_SECRET", "0") == "1"
AUTH_MODE = os.environ.get("TRUFFLE_AUTH_MODE", "bearer")
if AUTH_MODE not in {"bearer", "proxy"}:
    raise ValueError("TRUFFLE_AUTH_MODE must be bearer or proxy")
MERGED_REPO = os.environ.get("TRUFFLE_MERGED_REPO", "")
if MERGED_REPO and not PLAN_B:
    raise ValueError("TRUFFLE_MERGED_REPO requires TRUFFLE_PLAN_B=1")
MODEL_ID = MERGED_REPO or (
    "google/gemma-4-31B-it" if PLAN_B else "RedHatAI/gemma-4-31B-it-FP8-dynamic"
)
MODEL_REVISION = os.environ.get("TRUFFLE_MODEL_REVISION", "main")
DEPLOY_REVISION = os.environ.get("TRUFFLE_DEPLOY_REVISION", "dummy-v1")
APP_NAME = "truffle-brain" + ("-bf16" if PLAN_B else "")
APP_NAME += "-nosnap" if not GPU_SNAPSHOT else ""
WEIGHTS_ROOT = Path("/weights")
MODEL_DIR = WEIGHTS_ROOT / "models" / MODEL_ID.replace("/", "--")
ADAPTER_DIR = Path("/adapters/truffle")
MANIFEST = MODEL_DIR / "truffle-download.json"
TEMPLATE_PATH = "/opt/truffle/tool_chat_template_gemma4.jinja"
TEMPLATE_URL = (
    "https://raw.githubusercontent.com/vllm-project/vllm/refs/tags/"
    "v0.31.0/examples/tool_chat_template_gemma4.jinja"
)
VLLM_PORT = 8000
PROXY_PORT = 8080
STARTUP_TIMEOUT = 1800
SERVED_MODELS = ("truffle",) if MERGED_REPO else ("truffle-base", "truffle")
TARGET_MODULES = {"q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"}

# Latest compatible pins, checked against PyPI metadata on 2026-10-07.
# Do not install this GPU stack on the laptop.
PINS = [
    "vllm==0.31.0",
    "transformers==5.17.0",
    "torch==2.13.0",
    "peft==0.21.2",
    "huggingface_hub==1.33.0",
    "safetensors==0.8.0",
    "modal==1.6.1",
    "fastapi[standard]==0.136.3",
    "httpx==0.28.1",
]
REMOTE_ENV = {
    "TRUFFLE_PLAN_B": str(int(PLAN_B)),
    "TRUFFLE_GPU_SNAPSHOT": str(int(GPU_SNAPSHOT)),
    "TRUFFLE_USE_HF_SECRET": str(int(USE_HF_SECRET)),
    "TRUFFLE_AUTH_MODE": AUTH_MODE,
    "TRUFFLE_MERGED_REPO": MERGED_REPO,
    "TRUFFLE_MODEL_REVISION": MODEL_REVISION,
    "TRUFFLE_DEPLOY_REVISION": DEPLOY_REVISION,
    "HF_HOME": "/weights/hf-cache",
    "HF_HUB_DISABLE_IMPLICIT_TOKEN": "1",
    "HF_XET_HIGH_PERFORMANCE": "1",
    "VLLM_CACHE_ROOT": "/weights/vllm-cache",
    "VLLM_SERVER_DEV_MODE": str(int(GPU_SNAPSHOT)),
    "TORCHINDUCTOR_COMPILE_THREADS": "1",
    "TOKENIZERS_PARALLELISM": "false",
}

app = modal.App(APP_NAME)
weights = modal.Volume.from_name("truffle-weights", create_if_missing=True)
adapters = modal.Volume.from_name("truffle-adapters", create_if_missing=True)
hf_secrets = (
    [modal.Secret.from_name("huggingface", required_keys=["HF_TOKEN"])]
    if USE_HF_SECRET else []
)
brain_secrets = (
    [modal.Secret.from_name("truffle-brain", required_keys=["TRUFFLE_BRAIN_TOKEN"])]
    if AUTH_MODE == "bearer" else []
)

download_image = (
    modal.Image.debian_slim(python_version="3.12")
    .uv_pip_install("huggingface_hub==1.33.0", "modal==1.6.1")
    .env(REMOTE_ENV)
)
image = (
    modal.Image.from_registry(
        "nvidia/cuda:13.0.3-devel-ubuntu24.04", add_python="3.12"
    )
    .entrypoint([])
    .uv_pip_install(*PINS)
    .run_commands(
        "python -c \"from pathlib import Path; import urllib.request; "
        "Path('/opt/truffle').mkdir(parents=True, exist_ok=True); "
        f"urllib.request.urlretrieve('{TEMPLATE_URL}', '{TEMPLATE_PATH}')\""
    )
    .env(REMOTE_ENV)
)


def _check_weights():
    if not MANIFEST.is_file() or not (MODEL_DIR / "config.json").is_file():
        raise RuntimeError("Run download_weights for this variant before serving")
    manifest = json.loads(MANIFEST.read_text())
    if manifest["repo_id"] != MODEL_ID or manifest["requested_revision"] != MODEL_REVISION:
        raise RuntimeError("Cached weights differ from the requested model/revision")
    for filename in manifest["weight_files"]:
        if not (MODEL_DIR / filename).is_file():
            raise RuntimeError(f"Incomplete weight download: missing {filename}")
    return manifest


@app.function(
    image=download_image,
    cpu=2,
    memory=4096,
    timeout=3600,
    max_containers=1,
    volumes={str(WEIGHTS_ROOT): weights},
    secrets=hf_secrets,
)
def download_weights():
    """Download on Modal only. Reuse the first resolved revision on repeat calls."""
    from huggingface_hub import HfApi, snapshot_download

    weights.reload()
    if MANIFEST.is_file():
        manifest = _check_weights()
        print(f"Already cached: {MODEL_ID}@{manifest['resolved_revision']}")
        return manifest
    token = os.environ.get("HF_TOKEN") or False
    revision = HfApi().model_info(MODEL_ID, revision=MODEL_REVISION, token=token).sha
    snapshot_download(
        repo_id=MODEL_ID,
        revision=revision,
        local_dir=str(MODEL_DIR),
        token=token,
        # No pickle weights or alternate-format duplicate checkpoints.
        allow_patterns=["*.safetensors", "*.json", "*.model", "*.txt", "*.jinja", "*.tiktoken"],
        max_workers=8,
    )
    weight_files = sorted(p.relative_to(MODEL_DIR).as_posix() for p in MODEL_DIR.glob("*.safetensors"))
    if not weight_files or not (MODEL_DIR / "config.json").is_file():
        raise RuntimeError("Download has no safetensors weights or config.json")
    index = MODEL_DIR / "model.safetensors.index.json"
    if index.is_file():
        expected = set(json.loads(index.read_text())["weight_map"].values())
        if not expected.issubset(weight_files):
            raise RuntimeError("Download is missing shards listed in the weight index")
    manifest = {
        "repo_id": MODEL_ID,
        "requested_revision": MODEL_REVISION,
        "resolved_revision": revision,
        "weight_files": weight_files,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    weights.commit()
    print(f"Cached {MODEL_ID}@{revision} in {MODEL_DIR}; Volume committed")
    return manifest


@app.function(
    image=image,
    cpu=4,
    memory=8192,
    timeout=1200,
    max_containers=1,
    volumes={str(WEIGHTS_ROOT): weights, "/adapters": adapters},
)
def make_dummy_lora():
    """Create a tiny-random rank-16 adapter, not a trained Truffle personality."""
    import hashlib
    import tempfile

    import torch
    from peft import LoraConfig, get_peft_model, get_peft_model_state_dict
    from safetensors.torch import save_file
    from transformers import AutoConfig, AutoModelForImageTextToText

    weights.reload()
    adapters.reload()
    _check_weights()
    config_hash = hashlib.sha256((MODEL_DIR / "config.json").read_bytes()).hexdigest()
    config = AutoConfig.from_pretrained(str(MODEL_DIR), local_files_only=True)
    if config.model_type != "gemma4":
        raise RuntimeError(f"Expected Gemma 4 config, got {config.model_type}")
    # Exclude repository metadata and quantization settings from shape matching.
    text = config.text_config
    shape_fields = (
        "hidden_size", "intermediate_size", "num_hidden_layers", "num_attention_heads",
        "num_key_value_heads", "num_global_key_value_heads", "head_dim", "global_head_dim",
        "layer_types", "attention_k_eq_v", "num_kv_shared_layers", "per_layer_config",
    )
    shape_hash = hashlib.sha256(json.dumps(
        {key: text.to_dict().get(key) for key in shape_fields}, sort_keys=True
    ).encode()).hexdigest()
    marker = ADAPTER_DIR / "truffle-dummy.json"
    if ADAPTER_DIR.exists():
        if marker.is_file() and all((ADAPTER_DIR / name).is_file() for name in (
            "adapter_model.safetensors", "adapter_config.json"
        )):
            existing = json.loads(marker.read_text())
            if existing.get("rank") == 16 and existing.get("text_shape_sha256") == shape_hash:
                print("Existing matching dummy adapter retained. No adapter is overwritten.")
                return existing
        raise RuntimeError("/adapters/truffle already exists; refusing to overwrite an adapter")
    # The skeleton provides exact layer names and shapes. No base weights load.
    # Gemma 4 has different local/global head dimensions and shared K/V layers.
    if hasattr(config, "quantization_config"):
        delattr(config, "quantization_config")
    with torch.device("meta"):
        skeleton = AutoModelForImageTextToText.from_config(config, attn_implementation="eager")
        targets = [
            name for name, module in skeleton.named_modules()
            if name.startswith("model.language_model.layers.")
            and name.rsplit(".", 1)[-1] in TARGET_MODULES
            and isinstance(module, torch.nn.Linear)
        ]
        found = {name.rsplit(".", 1)[-1] for name in targets}
        if found != TARGET_MODULES:
            raise RuntimeError(f"Unexpected language LoRA targets: {sorted(found)}")
        lora = LoraConfig(
            r=16, lora_alpha=16, lora_dropout=0.0, bias="none",
            task_type="CAUSAL_LM", target_modules=targets, init_lora_weights=False,
        )
        peft_model = get_peft_model(skeleton, lora)
    shape_state = get_peft_model_state_dict(peft_model, save_embedding_layers=False)
    rng = torch.Generator(device="cpu").manual_seed(20261007)
    tensors = {}
    for name, tensor in shape_state.items():
        if ".language_model.layers." not in name or not name.endswith((".lora_A.weight", ".lora_B.weight")):
            raise RuntimeError(f"Unexpected non-language adapter parameter: {name}")
        if tensor.ndim != 2 or 16 not in tensor.shape:
            raise RuntimeError(f"Unexpected rank-16 adapter shape: {name}: {tensor.shape}")
        tensors[name] = (torch.randn(tuple(tensor.shape), generator=rng) * 1e-4).to(torch.bfloat16)
    if len(tensors) != 2 * len(targets):
        raise RuntimeError("Missing LoRA A/B tensors")
    metadata = {
        "dummy": True, "trained": False, "rank": 16, "seed": 20261007,
        "base_config_sha256": config_hash, "text_shape_sha256": shape_hash, "base_repo": MODEL_ID,
        "target_modules": len(targets), "tensors": len(tensors),
        "parameters": sum(t.numel() for t in tensors.values()),
    }
    staging = Path(tempfile.mkdtemp(prefix=".truffle-dummy-", dir="/adapters"))
    saved_config = peft_model.peft_config["default"]
    saved_config.base_model_name_or_path = "google/gemma-4-31B-it"
    saved_config.inference_mode = True
    saved_config.save_pretrained(str(staging))
    save_file(tensors, str(staging / "adapter_model.safetensors"), metadata={"format": "pt"})
    (staging / "truffle-dummy.json").write_text(json.dumps(metadata, indent=2) + "\n")
    staging.rename(ADAPTER_DIR)
    adapters.commit()
    print(json.dumps(metadata, indent=2))
    return metadata


def _vllm_command():
    command = [
        "vllm", "serve", str(MODEL_DIR),
        "--host", "127.0.0.1", "--port", str(VLLM_PORT),
        "--served-model-name", "truffle" if MERGED_REPO else "truffle-base",
        "--dtype", "bfloat16", "--max-model-len", "16384",
        "--gpu-memory-utilization", "0.88",
        "--max-num-seqs", "2", "--max-num-batched-tokens", "2048",
        "--reasoning-parser", "gemma4", "--chat-template", TEMPLATE_PATH,
        "--language-model-only", "--no-enable-prefix-caching",
        "--generation-config", "vllm",
    ]
    if not MERGED_REPO:
        command += ["--enable-lora", "--lora-modules", f"truffle={ADAPTER_DIR}", "--max-lora-rank", "16"]
    if PLAN_B:
        # v0.31.0 removed online BF16 quantization from the old 'fp8' method.
        # fp8_per_tensor is its documented replacement, not a different format.
        command += ["--quantization", "fp8_per_tensor"]
    if GPU_SNAPSHOT:
        command += ["--enable-sleep-mode"]
    return command


def _local_api(path, payload=None, timeout=600, post=False):
    request = urllib.request.Request(
        f"http://127.0.0.1:{VLLM_PORT}{path}",
        data=json.dumps(payload).encode() if payload is not None else (b"" if post else None),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read()
    return json.loads(body) if body else None


def _make_proxy(instance_id):
    """Only these three routes reach vLLM. Its development endpoints stay private."""
    from contextlib import asynccontextmanager
    import hmac

    import httpx
    from fastapi import Depends, FastAPI, HTTPException, Request
    from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
    from starlette.background import BackgroundTask
    from starlette.responses import StreamingResponse

    bearer = HTTPBearer(auto_error=False)

    async def authorize(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
        if AUTH_MODE == "proxy":
            # Modal's edge already authenticated the request, before GPU startup.
            return
        expected = os.environ.get("TRUFFLE_BRAIN_TOKEN", "")
        if not expected or credentials is None or not hmac.compare_digest(
            credentials.credentials.encode(), expected.encode()
        ):
            raise HTTPException(401, "Invalid bearer token", headers={"WWW-Authenticate": "Bearer"})

    @asynccontextmanager
    async def lifespan(web):
        async with httpx.AsyncClient(
            base_url=f"http://127.0.0.1:{VLLM_PORT}",
            timeout=httpx.Timeout(1800, connect=10),
            limits=httpx.Limits(max_connections=32, max_keepalive_connections=8),
            trust_env=False,
        ) as client:
            web.state.upstream = client
            yield

    web = FastAPI(
        lifespan=lifespan, dependencies=[Depends(authorize)],
        docs_url=None, redoc_url=None, openapi_url=None,
    )
    allowed = {("GET", "health"), ("GET", "v1/models"), ("POST", "v1/chat/completions")}

    @web.api_route("/{path:path}", methods=["GET", "POST"])
    async def forward(path: str, request: Request):
        if (request.method, path) not in allowed:
            raise HTTPException(404, "Route not exposed")
        body = await request.body()
        if len(body) > 2 * 1024 * 1024:
            raise HTTPException(413, "Request too large")
        client = request.app.state.upstream
        upstream_request = client.build_request(
            request.method, "/" + path, params=request.query_params, content=body,
            headers={"Content-Type": "application/json", "Accept-Encoding": "identity"},
        )
        try:
            upstream = await client.send(upstream_request, stream=True)
        except httpx.HTTPError:
            raise HTTPException(502, "Local inference server unavailable") from None
        headers = {
            key: value for key, value in upstream.headers.items()
            if key.lower() in {"content-type", "cache-control", "x-request-id"}
        }
        headers.update({
            "X-Accel-Buffering": "no", "X-Truffle-Instance": instance_id,
            "X-Truffle-GPU-Snapshot": str(int(GPU_SNAPSHOT)),
            "X-Truffle-Plan": "bf16-runtime-fp8" if PLAN_B else "fp8-checkpoint",
        })

        async def chunks():
            try:
                async for chunk in upstream.aiter_raw():
                    yield chunk
            finally:
                await upstream.aclose()

        return StreamingResponse(
            chunks(), status_code=upstream.status_code, headers=headers,
            background=BackgroundTask(upstream.aclose),
        )

    return web


@app.cls(
    image=image,
    gpu=GPU_TYPES,
    cpu=4,
    memory=98304 if PLAN_B else 65536,
    timeout=1800,
    startup_timeout=STARTUP_TIMEOUT,
    min_containers=0,
    max_containers=1,
    buffer_containers=0,
    scaledown_window=300,
    volumes={str(WEIGHTS_ROOT): weights, "/adapters": adapters},
    secrets=brain_secrets,
    enable_memory_snapshot=GPU_SNAPSHOT,
    experimental_options={"enable_gpu_snapshot": True} if GPU_SNAPSHOT else {},
)
@modal.concurrent(max_inputs=32, target_inputs=2)
class Brain:
    def _wait_ready(self):
        deadline = time.monotonic() + STARTUP_TIMEOUT
        while time.monotonic() < deadline:
            if self.vllm_proc.poll() is not None:
                raise RuntimeError(f"vLLM exited with {self.vllm_proc.returncode}; inspect Modal logs")
            try:
                _local_api("/health", timeout=2)
                return
            except (urllib.error.URLError, TimeoutError):
                time.sleep(1)
        raise TimeoutError("vLLM did not become healthy before the startup deadline")

    def _start(self):
        import shlex

        if AUTH_MODE == "bearer" and not os.environ.get("TRUFFLE_BRAIN_TOKEN"):
            raise RuntimeError("truffle-brain Secret must contain TRUFFLE_BRAIN_TOKEN")
        weights.reload()
        adapters.reload()
        _check_weights()
        if not MERGED_REPO:
            for filename in ("adapter_config.json", "adapter_model.safetensors"):
                if not (ADAPTER_DIR / filename).is_file():
                    raise RuntimeError("Run make_dummy_lora or upload the real adapter before deploying")
        command = _vllm_command()
        print("Starting " + shlex.join(command))
        self.vllm_proc = subprocess.Popen(command, start_new_session=True)
        self._wait_ready()
        # Compile both base and adapter paths before capture. No long-lived HTTP client.
        for model in SERVED_MODELS:
            for thinking in (False, True):
                result = _local_api("/v1/chat/completions", {
                    "model": model, "messages": [{"role": "user", "content": "Say hello briefly."}],
                    "max_tokens": 16, "chat_template_kwargs": {"enable_thinking": thinking},
                })
                if not result.get("choices"):
                    raise RuntimeError(f"Warmup failed for {model}")

    # snap=True is only legal when the class enables memory snapshots. With
    # TRUFFLE_GPU_SNAPSHOT=0 both hooks are plain enter hooks, in this order.
    @(modal.enter(snap=True) if GPU_SNAPSHOT else modal.enter())
    def capture(self):
        if GPU_SNAPSHOT:
            self._start()
            _local_api("/sleep?level=1", post=True)

    @(modal.enter(snap=False) if GPU_SNAPSHOT else modal.enter())
    def resume(self):
        import uuid

        if GPU_SNAPSHOT:
            _local_api("/wake_up", post=True)
            self._wait_ready()
        else:
            # Never initialize CUDA in a CPU-only snapshot hook.
            self._start()
        # Generated after restore so cold containers do not share an identifier.
        self.instance_id = uuid.uuid4().hex

    @modal.web_server(
        port=PROXY_PORT, startup_timeout=STARTUP_TIMEOUT,
        requires_proxy_auth=AUTH_MODE == "proxy",
    )
    def serve(self):
        import threading
        import uvicorn

        # Created after restore, so HTTP client sockets are not snapshotted.
        self.proxy_server = uvicorn.Server(uvicorn.Config(
            _make_proxy(self.instance_id), host="0.0.0.0", port=PROXY_PORT,
            log_level="warning", access_log=False,
        ))
        self.proxy_thread = threading.Thread(target=self.proxy_server.run, daemon=True)
        self.proxy_thread.start()

    @modal.exit()
    def stop(self):
        import signal

        if hasattr(self, "proxy_server"):
            self.proxy_server.should_exit = True
            self.proxy_thread.join(timeout=5)
        process = getattr(self, "vllm_proc", None)
        if process is not None and process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass


@app.local_entrypoint()
def bench(
    url: str,
    models: str = "truffle,truffle-base",
    samples: int = 5,
    idle_seconds: int = 0,
    cold_label: str = "unverified-first-request",
):
    """Benchmark an existing deployment. Uses only stdlib HTTP on the laptop."""
    token = os.environ.get("TRUFFLE_BRAIN_TOKEN")
    if not token:
        raise ValueError("Set TRUFFLE_BRAIN_TOKEN in the local environment; never pass it on the CLI")
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.query or parsed.fragment:
        raise ValueError("Use an HTTPS deployment URL with no credentials, query or fragment")
    if parsed.path.rstrip("/") not in {"", "/v1"}:
        raise ValueError("Pass the endpoint root or its /v1 URL, not /chat/completions")
    endpoint = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, "/v1/chat/completions", "", ""))
    model_names = [m.strip() for m in models.split(",") if m.strip()]
    if not model_names or samples < 1 or idle_seconds < 0:
        raise ValueError("Provide models, samples >= 1 and idle_seconds >= 0")

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None  # Do not send an Authorization header to another location.

    opener = urllib.request.build_opener(NoRedirect)
    prompt = (
        "You are Truffle, a kind desert pet. Plan a week of safe walking in hot Muscat. "
        "Give 80 numbered, varied practical ideas for indoor or cooler evening activity. "
        "Explain briefly why each helps. Never recommend dangerous heat. Finish the whole list."
    )

    def request(model, thinking, max_tokens):
        payload = {
            "model": model, "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens, "temperature": 1.0, "top_p": 0.95,
            "top_k": 64, "seed": 42, "stream": False,
            "chat_template_kwargs": {"enable_thinking": thinking},
        }
        req = urllib.request.Request(
            endpoint, data=json.dumps(payload).encode(),
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        )
        start = time.perf_counter()
        try:
            with opener.open(req, timeout=1800) as response:
                result = json.load(response)
                headers = response.headers
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"Benchmark HTTP {exc.code}; check endpoint, auth and Modal logs") from None
        elapsed = time.perf_counter() - start
        if not result.get("choices"):
            raise RuntimeError("Response has no choices; not recording this as a successful timing")
        return elapsed, result, headers

    if idle_seconds:
        print(f"Waiting {idle_seconds}s with no probes. Confirm zero containers in Modal separately.", flush=True)
        time.sleep(idle_seconds)
    # No /health or /models probe before this request. It would hide the cold start.
    cold, _, headers = request(model_names[0], False, 1)
    instance = headers.get("X-Truffle-Instance")
    if not instance:
        raise RuntimeError("Missing X-Truffle-Instance header; this is not a verified Truffle proxy response")
    print(f"\nFirst request [{cold_label}]: {cold:.3f}s (at most 1 output token, end-to-end, not TTFT)")
    print(f"Plan={headers.get('X-Truffle-Plan')}; GPU snapshot={headers.get('X-Truffle-GPU-Snapshot')}; instance={instance}")
    print("A fresh deploy is not proof of a cold request. Confirm scale-to-zero and snapshot restore in Modal logs.")
    print("\n| Model | Thinking | max_tokens | n | Warm p50 seconds | p50 completion tokens | length finishes |")
    print("|---|---|---:|---:|---:|---:|---:|")
    shapes = {}
    for model in model_names:
        for thinking in (False, True):
            for budget in (120, 400, 1200):
                durations, completions, lengths = [], [], 0
                for _ in range(samples):
                    elapsed, result, response_headers = request(model, thinking, budget)
                    if response_headers.get("X-Truffle-Instance") != instance:
                        raise RuntimeError("Container changed during warm sampling; discard this incomplete table and rerun")
                    durations.append(elapsed)
                    usage = result.get("usage") or {}
                    if "completion_tokens" in usage:
                        completions.append(usage["completion_tokens"])
                    choice = result["choices"][0]
                    lengths += choice.get("finish_reason") == "length"
                    if thinking:
                        message = choice["message"]
                        shapes[model] = {
                            "top_level_keys": sorted(result),
                            "message_fields": {
                                key: {"type": type(value).__name__, "length": len(value) if isinstance(value, (str, list, dict)) else None}
                                for key, value in message.items()
                            },
                            "reasoning_fields_present": [
                                f"choices[0].message.{key}" for key in ("reasoning", "reasoning_content") if key in message
                            ],
                            "finish_reason": choice.get("finish_reason"), "usage": usage,
                        }
                token_median = f"{statistics.median(completions):.0f}" if completions else "not reported"
                print(
                    f"| {model} | {'on' if thinking else 'off'} | {budget} | {samples} | "
                    f"{statistics.median(durations):.3f} | {token_median} | {lengths}/{samples} |",
                    flush=True,
                )
    print("\nThinking-on response shape (last 1200-token sample; generated text is not printed):")
    print("```json\n" + json.dumps(shapes, indent=2) + "\n```")
    print("Latencies include network and complete generation. max_tokens is a ceiling, not an observed token count.")
