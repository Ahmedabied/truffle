"""Truffle fine-tune on Modal (packet B11). Runs finetune/train.py on one GPU.

Commands (repo root, Modal CLI logged in):

    modal run finetune/modal_train.py::estimate [--sec-per-step S]
    modal run finetune/modal_train.py::train --run <id> [--max-steps N] [--epochs E]
    modal run finetune/modal_train.py::promote --run <id>

`train` writes the adapter to /adapters/truffle-<id> on the `truffle-adapters`
Volume, plus TRAIN_META.json and MANIFEST.json. It never writes /adapters/truffle,
the path the serving app loads. `promote` is the only thing that does, and only
when the integrator runs it. After a promote, redeploy the serving app with a new
TRUFFLE_DEPLOY_REVISION (brain-modal/README.md, "New weights or adapter, old snapshot").

GPU: L40S by default. TRUFFLE_GPU takes one type or a comma list in priority
order, like the serving app. Example: TRUFFLE_GPU=L40S,A100-80GB

Base weights download on Modal into /weights/hf-cache (the `truffle-weights`
Volume), so the second run reuses them. Nothing is downloaded to the laptop.
"""

import json
import os
from pathlib import Path
import re
import time

import modal

HERE = Path(__file__).resolve().parent
_gpu_env = os.environ.get("TRUFFLE_GPU", "")
GPU_TYPES = [g.strip() for g in _gpu_env.split(",") if g.strip()] if _gpu_env else ["L40S"]

BASE_MODEL = "unsloth/gemma-4-31B-it"
CODE_DIR = "/root/finetune"
DATA_DIR = "/root/data"
ADAPTERS = Path("/adapters")
SERVED = ADAPTERS / "truffle"
DUMMY_MARKER = "truffle-dummy.json"
# Batch settings the script uses by default (finetune/train.py): 2 x 8 = 16 rows per step.
BATCH, GRAD_ACCUM = 2, 8
L40S_PER_SECOND = 0.000542
# Requested 4 CPU and 64 GiB RAM, at Modal's listed rates (checked 2026-10-07).
CPU_RAM_PER_SECOND = 4 * 0.0000131 + 64 * 0.00000222
# Stop the run if loading the base (download included) takes longer than this.
LOAD_TIMEOUT_S = 20 * 60

# The set B05 resolved with a plain `uv pip install unsloth` on the box
# (fleet/outbox/B05/RESULT.md). Pinned so the cloud run matches the dry run.
PINS = [
    "unsloth==2026.10.2",
    "unsloth_zoo==2026.10.2",
    "transformers==5.17.0",
    "trl==1.13.0",
    "peft==0.21.2",
    "torch==2.14.1",
    "datasets==4.8.5",
    "bitsandbytes==0.50.2",
    "accelerate==1.15.0",
    "xformers==0.0.35",
    "triton==3.8.0",
]
KEY_PACKAGES = [p.split("==")[0] for p in PINS] + ["huggingface_hub", "hf_xet", "safetensors", "tokenizers"]

app = modal.App("truffle-train")
weights = modal.Volume.from_name("truffle-weights", create_if_missing=True)
adapters = modal.Volume.from_name("truffle-adapters", create_if_missing=True)
hf_secret = modal.Secret.from_name("huggingface", required_keys=["HF_TOKEN"])

image = (
    modal.Image.from_registry("nvidia/cuda:13.0.3-devel-ubuntu24.04", add_python="3.12")
    .entrypoint([])
    .uv_pip_install(*PINS)
    .env({
        "HF_HOME": "/weights/hf-cache",
        "HF_XET_HIGH_PERFORMANCE": "1",
        "TOKENIZERS_PARALLELISM": "false",
        "PYTHONUNBUFFERED": "1",
    })
    .add_local_dir(
        HERE, CODE_DIR,
        ignore=["data/generated", "eval/out", "**/__pycache__", ".venv", "runs", "modal_train.py"],
    )
    .add_local_dir(HERE / "data" / "generated", DATA_DIR, ignore=["*.md"])
)

RUN_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,31}$")


def _check_run_id(run: str) -> str:
    if not RUN_ID.match(run or ""):
        raise ValueError("run id: 1 to 32 chars of a-z, 0-9 and '-', starting with a letter or digit")
    return run


def _sha256(path: Path) -> str:
    import hashlib

    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _rows(path: Path) -> int:
    with open(path, encoding="utf-8") as f:
        return sum(1 for line in f if line.strip())


def _packages() -> dict:
    from importlib import metadata

    found = {}
    for name in KEY_PACKAGES:
        try:
            found[name] = metadata.version(name)
        except metadata.PackageNotFoundError:
            found[name] = None
    return found


def _dir_bytes(path: Path) -> int:
    total = 0
    if path.exists():
        for p in path.rglob("*"):
            try:
                if p.is_file() and not p.is_symlink():
                    total += p.stat().st_size
            except OSError:
                pass
    return total


def _safetensors_shapes(path: Path) -> dict:
    """Tensor name -> shape from the safetensors header only (no tensor data read)."""
    import struct

    with open(path, "rb") as f:
        (size,) = struct.unpack("<Q", f.read(8))
        header = json.loads(f.read(size))
    header.pop("__metadata__", None)
    return {name: (info["shape"], info["dtype"]) for name, info in header.items()}


def _compare_with_served(out: Path) -> dict:
    """Do the new adapter's names, shapes, rank and targets match what vLLM already loads?"""
    report = {"reference": str(SERVED)}
    ref_cfg_path, new_cfg_path = SERVED / "adapter_config.json", out / "adapter_config.json"
    ref_st, new_st = SERVED / "adapter_model.safetensors", out / "adapter_model.safetensors"
    if not (ref_cfg_path.is_file() and ref_st.is_file()):
        report["error"] = "no reference adapter at /adapters/truffle"
        return report
    if not (new_cfg_path.is_file() and new_st.is_file()):
        report["error"] = "new adapter files missing"
        return report
    ref_cfg, new_cfg = json.loads(ref_cfg_path.read_text()), json.loads(new_cfg_path.read_text())

    def targets(cfg):
        t = cfg.get("target_modules")
        return sorted(t) if isinstance(t, list) else t

    ref_t, new_t = targets(ref_cfg), targets(new_cfg)
    report["config"] = {
        key: {"reference": ref_cfg.get(key), "new": new_cfg.get(key)}
        for key in ("r", "lora_alpha", "use_rslora", "use_dora", "bias", "modules_to_save",
                    "base_model_name_or_path", "task_type")
    }
    report["target_modules"] = {
        "reference_type": type(ref_t).__name__, "new_type": type(new_t).__name__,
        "reference_count": len(ref_t) if isinstance(ref_t, list) else None,
        "new_count": len(new_t) if isinstance(new_t, list) else None,
        "identical": ref_t == new_t,
        "new_value_if_not_list": new_t if not isinstance(new_t, list) else None,
    }

    def norm(name):
        # PEFT saves without the adapter name; tolerate an explicit '.default' too.
        return name.replace(".default.weight", ".weight")

    ref_shapes = {norm(k): v for k, v in _safetensors_shapes(ref_st).items()}
    new_shapes = {norm(k): v for k, v in _safetensors_shapes(new_st).items()}
    only_ref = sorted(set(ref_shapes) - set(new_shapes))
    only_new = sorted(set(new_shapes) - set(ref_shapes))
    shape_diff = sorted(k for k in set(ref_shapes) & set(new_shapes) if ref_shapes[k][0] != new_shapes[k][0])
    report["tensors"] = {
        "reference": len(ref_shapes), "new": len(new_shapes),
        "only_in_reference": only_ref[:10], "only_in_reference_count": len(only_ref),
        "only_in_new": only_new[:10], "only_in_new_count": len(only_new),
        "shape_mismatches": shape_diff[:10], "shape_mismatch_count": len(shape_diff),
        "new_dtypes": sorted({v[1] for v in new_shapes.values()}),
        "reference_dtypes": sorted({v[1] for v in ref_shapes.values()}),
        "example_new": dict(list(sorted(new_shapes.items()))[:2]),
    }
    report["match"] = (
        not only_ref and not only_new and not shape_diff
        and ref_cfg.get("r") == new_cfg.get("r") and ref_cfg.get("lora_alpha") == new_cfg.get("lora_alpha")
    )
    return report


def _loss_summary(log_history: list) -> dict:
    losses = [(e["step"], e["loss"]) for e in log_history if "loss" in e and "step" in e]
    evals = [(e["step"], e["eval_loss"]) for e in log_history if "eval_loss" in e]
    vals = [v for _, v in losses]
    return {
        "points": len(losses),
        "first": losses[0] if losses else None,
        "last": losses[-1] if losses else None,
        "min": min(vals) if vals else None,
        "curve": losses,
        "eval": evals,
    }


@app.function(
    image=image,
    gpu=GPU_TYPES,
    cpu=4,
    memory=65536,
    timeout=4 * 60 * 60,
    volumes={"/weights": weights, str(ADAPTERS): adapters},
    secrets=[hf_secret],
)
def train_adapter(run: str, max_steps: int = -1, epochs: float = 2.0, eval_holdout: bool = True) -> dict:
    """Train into /adapters/truffle-<run>. Never touches /adapters/truffle."""
    import shutil
    import subprocess
    import sys
    import threading

    _check_run_id(run)
    adapters.reload()
    weights.reload()
    out = ADAPTERS / f"truffle-{run}"
    if out.resolve() == SERVED.resolve():
        raise RuntimeError("refusing to train into the served adapter path")
    if (out / "MANIFEST.json").is_file():
        raise RuntimeError(f"{out} already has a finished run. Pick a new --run id.")
    if out.exists():
        print(f"[modal_train] removing unfinished output at {out}", flush=True)
        shutil.rmtree(out)

    train_file, eval_file = Path(DATA_DIR) / "train.jsonl", Path(DATA_DIR) / "eval_holdout.jsonl"
    data = {
        "train": {"rows": _rows(train_file), "sha256": _sha256(train_file)},
        "eval_holdout": {"rows": _rows(eval_file), "sha256": _sha256(eval_file)},
    }
    print("[modal_train] data " + json.dumps(data), flush=True)
    cache_before = _dir_bytes(Path("/weights/hf-cache/hub"))

    cmd = [
        sys.executable, f"{CODE_DIR}/train.py", "--model", BASE_MODEL,
        "--train", str(train_file), "--eval", str(eval_file) if eval_holdout else "",
        "--out", str(out), "--epochs", str(epochs), "--max-steps", str(max_steps),
    ]
    if 0 < max_steps <= 20:
        cmd += ["--logging-steps", "1"]  # loss at every step for smoke runs
    print("[modal_train] " + " ".join(cmd), flush=True)

    # Commit the adapters Volume every 10 minutes so checkpoints survive a lost container.
    stop = threading.Event()

    def committer():
        while not stop.wait(600):
            try:
                adapters.commit()
                print("[modal_train] adapters Volume committed (periodic)", flush=True)
            except Exception as e:  # noqa: BLE001
                print(f"[modal_train] periodic commit failed: {e!r}", flush=True)

    threading.Thread(target=committer, daemon=True).start()

    t0 = time.time()
    marks, step_times = {}, []
    proc = subprocess.Popen(cmd, cwd="/root", stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, bufsize=1)
    last_bar = 0.0

    def watchdog():
        while proc.poll() is None:
            if "model_loaded" not in marks and time.time() - t0 > LOAD_TIMEOUT_S:
                print(f"[modal_train] base load (download included) passed {LOAD_TIMEOUT_S}s; stopping",
                      flush=True)
                proc.kill()
                return
            time.sleep(5)

    threading.Thread(target=watchdog, daemon=True).start()
    for line in proc.stdout:
        now = time.time() - t0
        line = line.rstrip("\n")
        if "%|" in line:  # tqdm bars: print at most one every 30 s
            if now - last_bar < 30:
                continue
            last_bar = now
        print(f"[{now:7.1f}s] {line}", flush=True)
        if "train examples" in line and "load_start" not in marks:
            marks["load_start"] = now
        elif "rendered example 0" in line and "model_loaded" not in marks:
            marks["model_loaded"] = now
        elif line.lstrip().startswith("{'loss'") or line.lstrip().startswith('{"loss"'):
            marks.setdefault("first_loss", now)
            step_times.append(now)
        elif "'train_runtime'" in line:
            marks["train_done"] = now
        elif "saved LoRA adapter" in line:
            marks["saved"] = now
    code = proc.wait()
    wall = time.time() - t0
    stop.set()
    if code != 0:
        adapters.commit()
        raise RuntimeError(f"train.py exited with {code} after {wall:.0f}s (marks {marks})")

    meta = json.loads((out / "train_meta.json").read_text())
    shutil.copyfile(out / "train_meta.json", out / "TRAIN_META.json")
    cache_after = _dir_bytes(Path("/weights/hf-cache/hub"))
    weights.commit()  # keep the base download for the next run

    deltas = [b - a for a, b in zip(step_times, step_times[1:])]
    logging_every = 1 if 0 < max_steps <= 20 else 5
    steady = deltas[1:] if len(deltas) > 1 else deltas
    sec_per_step = (sum(steady) / len(steady) / logging_every) if steady else None
    import torch

    gpu = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
    manifest = {
        "run": run,
        "out": str(out),
        "status": meta.get("status"),
        "base_model": BASE_MODEL,
        "gpu": gpu,
        "gpu_request": GPU_TYPES,
        "data": data,
        "pins_requested": PINS,
        "packages_resolved": _packages(),
        "hyperparameters": meta.get("hyperparameters"),
        "wall_time_s": round(wall, 1),
        "phases_s": {k: round(v, 1) for k, v in marks.items()},
        "base_load_s_including_download": round(marks["model_loaded"] - marks.get("load_start", 0), 1)
        if "model_loaded" in marks else None,
        "hf_cache_bytes_added": cache_after - cache_before,
        "sec_per_step_measured": round(sec_per_step, 2) if sec_per_step else None,
        "sec_per_step_note": "mean gap between logged losses after the first, divided by logging interval",
        "global_steps": meta.get("global_steps"),
        "train_loss": meta.get("train_loss"),
        "eval_metrics": meta.get("eval_metrics"),
        "peak_gpu_mem_gb": meta.get("peak_gpu_mem_gb"),
        "loss": _loss_summary(meta.get("log_history", [])),
        "compat_with_served": _compare_with_served(out),
        "finished": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    (out / "MANIFEST.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    adapters.commit()
    listing = sorted(
        (p.relative_to(out).as_posix(), p.stat().st_size) for p in out.rglob("*") if p.is_file()
    )
    print("[modal_train] adapter directory:", flush=True)
    for name, size in listing:
        print(f"  {size:>12}  {name}", flush=True)
    print("[modal_train] MANIFEST.json:\n" + json.dumps(manifest, indent=2, ensure_ascii=False), flush=True)
    return manifest


@app.function(image=image, cpu=2, memory=8192, timeout=900, volumes={str(ADAPTERS): adapters})
def promote_adapter(run: str, target: str = "truffle") -> dict:
    """Copy truffle-<run> to /adapters/<target>. Default target is the served path.

    The old adapter is kept as /adapters/.retired-<target>-<time>, so a running
    deployment that still references it is not broken. The dummy marker is not
    carried over. Redeploy the serving app with a new TRUFFLE_DEPLOY_REVISION after.
    """
    import shutil

    _check_run_id(run)
    if not re.match(r"^truffle[a-z0-9-]{0,32}$", target):
        raise ValueError("target must be 'truffle' or start with 'truffle'")
    adapters.reload()
    src, dest = ADAPTERS / f"truffle-{run}", ADAPTERS / target
    if src.resolve() == dest.resolve():
        raise ValueError("source and target are the same directory")
    manifest_path = src / "MANIFEST.json"
    if not manifest_path.is_file():
        raise RuntimeError(f"{src} has no MANIFEST.json: the run did not finish")
    manifest = json.loads(manifest_path.read_text())
    if manifest.get("status") != "done":
        raise RuntimeError(f"run status is {manifest.get('status')!r}, not 'done'")
    for name in ("adapter_config.json", "adapter_model.safetensors"):
        if not (src / name).is_file():
            raise RuntimeError(f"missing {src / name}")

    stamp = time.strftime("%Y%m%d-%H%M%S")
    staging = ADAPTERS / f".promote-{target}-{stamp}"
    staging.mkdir()
    for name in ("TRAIN_META.json", "MANIFEST.json"):
        if (src / name).is_file():
            shutil.copyfile(src / name, staging / name)
    # Unsloth saves float32 tensors and a regex target_modules string. The served
    # dummy (which vLLM already loads) has bfloat16 tensors and an explicit module
    # list. Write the promoted copy in that same form. Names and shapes are unchanged.
    import torch
    from safetensors.torch import load_file, save_file

    tensors = load_file(str(src / "adapter_model.safetensors"))
    save_file({k: v.to(torch.bfloat16).contiguous() for k, v in tensors.items()},
              str(staging / "adapter_model.safetensors"), metadata={"format": "pt"})
    modules = sorted({
        k.removeprefix("base_model.model.").rsplit(".lora_", 1)[0]
        for k in tensors if ".lora_A." in k or ".lora_B." in k
    })
    cfg = json.loads((src / "adapter_config.json").read_text())
    trained_base = cfg.get("base_model_name_or_path")
    trained_targets = cfg.get("target_modules")
    cfg["target_modules"] = modules
    # Same value the dummy used. vLLM serves the adapter on the RedHat FP8 base.
    cfg["base_model_name_or_path"] = "google/gemma-4-31B-it"
    cfg["inference_mode"] = True
    (staging / "adapter_config.json").write_text(json.dumps(cfg, indent=2) + "\n")
    (staging / "PROMOTED.json").write_text(json.dumps({
        "run": run, "source": str(src), "promoted": stamp, "trained_base": trained_base,
        "trained_target_modules": trained_targets, "target_module_count": len(modules),
        "tensors": len(tensors), "dtype": "bfloat16 (cast from the trained float32)",
    }, indent=2) + "\n")
    if (staging / DUMMY_MARKER).exists():
        (staging / DUMMY_MARKER).unlink()

    retired = None
    if dest.exists():
        marker = dest / DUMMY_MARKER
        if marker.is_file():
            marker.unlink()  # the served path no longer claims to be the dummy
        retired = ADAPTERS / f".retired-{target}-{stamp}"
        dest.rename(retired)
    staging.rename(dest)
    adapters.commit()
    files = sorted(p.name for p in dest.iterdir())
    check = _compare_with_served(dest) if dest != SERVED else None
    result = {"promoted": run, "to": str(dest), "files": files, "target_modules": len(modules),
              "compat_with_served": None if check is None else {
                  "match": check.get("match"), "target_modules": check.get("target_modules"),
                  "tensors": check.get("tensors")},
              "previous_kept_at": str(retired) if retired else None}
    print(json.dumps(result, indent=2), flush=True)
    return result


@app.function(image=image, cpu=4, memory=8192, timeout=1800,
              volumes={"/weights": weights}, secrets=[hf_secret])
def render_stats(max_seq_length: int = 4096) -> dict:
    """Tokenizer only, no weights, no GPU. Runs train.py --render-only over every row."""
    import statistics
    import subprocess
    import sys

    weights.reload()
    result = {}
    for split in ("train", "eval_holdout"):
        path = Path(DATA_DIR) / f"{split}.jsonl"
        rows = _rows(path)
        base = [sys.executable, f"{CODE_DIR}/train.py", "--render-only", str(rows), "--model", BASE_MODEL,
                "--train", str(path), "--out", "/tmp/render"]
        path_used = "unsloth gemma-4-thinking template"
        proc = subprocess.run(base, cwd="/root", capture_output=True, text=True)
        if proc.returncode != 0:
            # Unsloth may refuse to import without a GPU. The model's own Gemma 4
            # template gives the same tokens for these chats, near enough to count them.
            print(f"[estimate] unsloth render failed on CPU ({proc.stderr.strip().splitlines()[-1:]}); "
                  "using --no-unsloth (model's own template)", flush=True)
            path_used = "model's own chat template (--no-unsloth)"
            proc = subprocess.run(base + ["--no-unsloth"], cwd="/root", capture_output=True, text=True)
            if proc.returncode != 0:
                raise RuntimeError(proc.stderr[-3000:])
        pairs = [(int(a), int(b)) for a, b in re.findall(r"TRAINED ON \((\d+) of (\d+) tokens\)", proc.stdout)]
        if len(pairs) != rows:
            raise RuntimeError(f"parsed {len(pairs)} token counts for {rows} rows")
        totals = sorted(b for _, b in pairs)
        trained = [a for a, _ in pairs]
        result[split] = {
            "rows": rows, "render_path": path_used,
            "tokens_per_row_mean": round(statistics.mean(totals), 1),
            "tokens_per_row_median": statistics.median(totals),
            "tokens_per_row_p95": totals[int(0.95 * (len(totals) - 1))],
            "tokens_per_row_max": totals[-1],
            "trained_tokens_per_row_mean": round(statistics.mean(trained), 1),
            "rows_over_max_seq_length": sum(t > max_seq_length for t in totals),
            "tokens_total": sum(totals),
        }
        print(f"[estimate] {split}: " + json.dumps(result[split]), flush=True)
    return result


# ------------------------------------------------------------- local entrypoints

@app.local_entrypoint()
def estimate(sec_per_step: float = 20.0, epochs: float = 2.0, overhead_min: float = 15.0,
             eval_min_per_pass: float = 3.0):
    """Rows, tokens per row, steps, and a cost estimate. CPU only."""
    import math

    stats = render_stats.remote()
    tr, ev = stats["train"], stats["eval_holdout"]
    rows_per_step = BATCH * GRAD_ACCUM
    steps_per_epoch = math.ceil(tr["rows"] / rows_per_step)
    total_steps = math.ceil(steps_per_epoch * epochs)
    # train.py evaluates at each epoch end and once more at the end.
    eval_passes = math.floor(epochs) + 1
    train_s = total_steps * sec_per_step
    total_s = train_s + eval_passes * eval_min_per_pass * 60 + overhead_min * 60
    gpu_usd = total_s * L40S_PER_SECOND
    all_usd = total_s * (L40S_PER_SECOND + CPU_RAM_PER_SECOND)
    print()
    print("| Item | Value |")
    print("|---|---|")
    print(f"| Train rows | {tr['rows']} |")
    print(f"| Eval hold-out rows | {ev['rows']} |")
    print(f"| Render path | {tr['render_path']} |")
    print(f"| Tokens per train row (mean / median / p95 / max) | {tr['tokens_per_row_mean']} / "
          f"{tr['tokens_per_row_median']} / {tr['tokens_per_row_p95']} / {tr['tokens_per_row_max']} |")
    print(f"| Trained (reply) tokens per train row, mean | {tr['trained_tokens_per_row_mean']} |")
    print(f"| Train rows over max_seq_length 4096 | {tr['rows_over_max_seq_length']} |")
    print(f"| Train tokens per epoch | {tr['tokens_total']} |")
    print(f"| Batch | {BATCH} x grad accum {GRAD_ACCUM} = {rows_per_step} rows per step |")
    print(f"| Steps per epoch | {steps_per_epoch} |")
    print(f"| Epochs | {epochs} |")
    print(f"| Total optimizer steps | {total_steps} |")
    print(f"| Seconds per step (assumption) | {sec_per_step} |")
    print(f"| Training time | {train_s / 60:.1f} min |")
    print(f"| Eval passes x minutes (assumption) | {eval_passes} x {eval_min_per_pass} |")
    print(f"| Load and save overhead (assumption) | {overhead_min} min |")
    print(f"| Total wall time | {total_s / 60:.1f} min |")
    print(f"| Cost, L40S GPU only at ${L40S_PER_SECOND}/s | ${gpu_usd:.2f} |")
    print(f"| Cost, plus requested 4 CPU and 64 GiB RAM | ${all_usd:.2f} |")


@app.local_entrypoint()
def train(run: str, max_steps: int = -1, epochs: float = 2.0, no_eval: bool = False):
    """Train on the GPU. Output: /adapters/truffle-<run> on the truffle-adapters Volume."""
    _check_run_id(run)
    manifest = train_adapter.remote(run, max_steps=max_steps, epochs=epochs, eval_holdout=not no_eval)
    print(f"\nDone: /adapters/truffle-{run}  steps={manifest['global_steps']}  "
          f"sec/step={manifest['sec_per_step_measured']}  peak_gpu={manifest['peak_gpu_mem_gb']} GB  "
          f"wall={manifest['wall_time_s']}s  compat_match={manifest['compat_with_served'].get('match')}")


@app.local_entrypoint()
def promote(run: str, target: str = "truffle"):
    """Make truffle-<run> the served adapter. Then redeploy the serving app with a new revision."""
    _check_run_id(run)
    promote_adapter.remote(run, target=target)
    if target == "truffle":
        print("Next: TRUFFLE_DEPLOY_REVISION=<new> TRUFFLE_GPU_SNAPSHOT=0 modal deploy brain-modal/modal_app.py")
