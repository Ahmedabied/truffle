# B11 modal_train: RESULT

Owner: opus. Done Thu 2026-10-08 22:00 Oman. Cost: about **$0.25** of Modal credit (ledger updated).

## What was built

`finetune/modal_train.py`, a Modal app `truffle-train`.

| Piece | What it does |
|---|---|
| `train_adapter` (GPU function) | `L40S` by default. `TRUFFLE_GPU` takes one type or a comma list, like the serving app. 4 CPU, 64 GiB RAM, 4 h timeout. Runs `finetune/train.py --out /adapters/truffle-<run>`. Then it writes `TRAIN_META.json` (a copy of train_meta.json) and `MANIFEST.json`. It refuses a run id that already has a MANIFEST. It never writes `/adapters/truffle`. |
| `promote_adapter` (CPU function) | Copies `truffle-<run>` to `/adapters/truffle`. The old served dir is kept as `/adapters/.retired-truffle-<time>`, and its dummy marker is removed first. The promoted copy carries no marker. It writes `PROMOTED.json`. |
| `render_stats` (CPU function) | Runs `train.py --render-only <all rows>` on the tokenizer only and counts tokens. |
| Local entrypoints | `::train --run <id> [--max-steps N] [--epochs E] [--no-eval]`, `::promote --run <id> [--target truffle]`, `::estimate [--sec-per-step S]`. |

Image: `nvidia/cuda:13.0.3-devel-ubuntu24.04`, Python 3.12, `uv_pip_install` of the B05 pins. `finetune/` is added at `/root/finetune` (without `data/generated`). `finetune/data/generated/` is added at `/root/data`. Secret `huggingface` is attached. `truffle-weights` is at `/weights` with `HF_HOME=/weights/hf-cache`. `truffle-adapters` is at `/adapters`.

Some details beyond the packet:

- **Naming.** The packet asks for a GPU function `train` and a local entrypoint `train`. One module cannot have both names. So the local entrypoints carry the packet's names (`train`, `promote`, `estimate`) and the remote functions are `train_adapter`, `promote_adapter` and `render_stats`. The commands match the packet exactly.
- **Download guard.** A watchdog kills the run if loading the base takes more than 20 minutes, download included.
- **Periodic commits.** The adapters Volume is committed every 10 minutes during training, so the checkpoints (every 50 steps) survive a lost container. The weights Volume is committed after the run, which keeps the base cached.
- **Smoke logging.** For runs of 20 steps or fewer, the wrapper passes `--logging-steps 1` so every step's loss is logged. `train.py` was not edited.
- **Compat check.** After training, the function reads the safetensors headers of the new adapter and of the served dummy. It compares tensor names, shapes, rank, alpha and target_modules, and writes the result into `MANIFEST.json` as `compat_with_served`.
- **Promote normalises the adapter to the dummy's form.** Unsloth saves float32 tensors (490 MB) and `target_modules` as a regex string. The dummy, which vLLM already loads, has bfloat16 tensors and an explicit list of 410 module names. Promote casts to bfloat16 and writes the explicit list built from the tensor names. It also sets `base_model_name_or_path` to `google/gemma-4-31B-it`, the dummy's value. I tested this on a scratch target (see Evidence 4). The packet does not ask for this step, but it removes the one difference that could stop vLLM from loading the adapter.

## Evidence

### 1. `::estimate` (CPU only)

The first run used the default assumption of 20 s per step:

```
$ modal run finetune/modal_train.py::estimate
...
Building image im-xgyJA5JZ7KmMAAa81qcSub ... Resolved 101 packages in 545ms ... Built image in 25.14s
[estimate] unsloth render failed on CPU (['NotImplementedError: Unsloth cannot find any torch accelerator? You need a GPU.']); using --no-unsloth (model's own template)
[estimate] train: {"rows": 1720, "render_path": "model's own chat template (--no-unsloth)", "tokens_per_row_mean": 241.6, "tokens_per_row_median": 217.0, "tokens_per_row_p95": 386, "tokens_per_row_max": 820, "trained_tokens_per_row_mean": 75.6, "rows_over_max_seq_length": 0, "tokens_total": 415616}
[estimate] eval_holdout: {"rows": 80, ..., "tokens_per_row_mean": 276.8, "tokens_per_row_median": 247.5, "tokens_per_row_p95": 463, "tokens_per_row_max": 545, "trained_tokens_per_row_mean": 102.3, "rows_over_max_seq_length": 0, "tokens_total": 22144}
| Item | Value |
|---|---|
| Train rows | 1720 |
| Eval hold-out rows | 80 |
| Render path | model's own chat template (--no-unsloth) |
| Tokens per train row (mean / median / p95 / max) | 241.6 / 217.0 / 386 / 820 |
| Trained (reply) tokens per train row, mean | 75.6 |
| Train rows over max_seq_length 4096 | 0 |
| Train tokens per epoch | 415616 |
| Batch | 2 x grad accum 8 = 16 rows per step |
| Steps per epoch | 108 |
| Epochs | 2.0 |
| Total optimizer steps | 216 |
| Seconds per step (assumption) | 20.0 |
| Training time | 72.0 min |
| Eval passes x minutes (assumption) | 3 x 3.0 |
| Load and save overhead (assumption) | 15.0 min |
| Total wall time | 96.0 min |
| Cost, L40S GPU only at $0.000542/s | $3.12 |
| Cost, plus requested 4 CPU and 64 GiB RAM | $4.24 |
```

Unsloth will not import without a GPU, so the CPU estimate renders with the model's own Gemma 4 template (`--no-unsloth`). On a GPU, the smoke run's mask check showed the Unsloth `gemma-4-thinking` render of row 0 at 174 tokens, which is in the same range. Token counts are for sizing only.

The second run used the smoke run's measured 8.71 s per step, a measured eval of 16 s (budgeted at 0.5 min), and 8 min for start, load and save:

```
$ modal run finetune/modal_train.py::estimate --sec-per-step 8.71 --eval-min-per-pass 0.5 --overhead-min 8
| Total optimizer steps | 216 |
| Seconds per step (assumption) | 8.71 |
| Training time | 31.4 min |
| Eval passes x minutes (assumption) | 3 x 0.5 |
| Load and save overhead (assumption) | 8.0 min |
| Total wall time | 40.9 min |
| Cost, L40S GPU only at $0.000542/s | $1.33 |
| Cost, plus requested 4 CPU and 64 GiB RAM | $1.81 |
```

### 2. Smoke run: `::train --run smoke --max-steps 5`

The container was scheduled on an L40S within seconds, with no capacity wait.

```
$ modal run finetune/modal_train.py::train --run smoke --max-steps 5
[modal_train] data {"train": {"rows": 1720, "sha256": "9e234b9fba6fc068ab1940c0be9ab2b2d67e69fb38c2d28437451e15a80a4152"}, "eval_holdout": {"rows": 80, "sha256": "904dd48119dec0b48b0cb8270f26bb4a922072a7e801d95e7afb75ee3d60c68d"}}
[modal_train] /usr/local/bin/python /root/finetune/train.py --model unsloth/gemma-4-31B-it --train /root/data/train.jsonl --eval /root/data/eval_holdout.jsonl --out /adapters/truffle-smoke --epochs 2.0 --max-steps 5 --logging-steps 1
[   26.6s] [train 17:41:52] train examples 1720, eval examples 80
[   30.6s] ==((====))==  Unsloth 2026.10.2: Fast Gemma4 patching. Transformers: 5.17.0.
[   30.6s]    \\   /|    NVIDIA L40S. Num GPUs = 1. Max memory: 44.392 GB. Platform: Linux.
[   30.6s] Unsloth: Fast downloading is enabled - ignore downloading bars which are red colored!
[  145.2s] Loading weights:   0%|          | 0/1188 [00:00<?, ?it/s]
[  169.7s] [unsloth.chat_templates|WARNING]Unsloth: This Gemma-4 model expects an empty thought channel on non-thinking turns. Adding <|channel>thought\n<channel|> to assistant turns without thinking content.
[  169.9s] [train 17:44:16] total optimizer steps 5, warmup steps 1
[  179.1s] [train 17:44:25] loss mask check: 28 of 174 tokens trained
[  179.7s] \        /    Data Parallel GPUs = 1 | Total batch size (2 x 8 x 1) = 16
[  179.7s]  "-____-"     Trainable parameters = 122,429,440 of 31,395,515,952 (0.39% trained)
[  222.6s] {'loss': '5.072', 'grad_norm': '20.19', 'learning_rate': '0', 'epoch': '0.009302'}
[  230.7s] {'loss': '5.086', 'grad_norm': '29.39', 'learning_rate': '0.0002', 'epoch': '0.0186'}
[  239.5s] {'loss': '4.933', 'grad_norm': '19.93', 'learning_rate': '0.00015', 'epoch': '0.02791'}
[  248.5s] {'loss': '4.529', 'grad_norm': '33.91', 'learning_rate': '0.0001', 'epoch': '0.03721'}
[  256.9s] {'loss': '4.409', 'grad_norm': '5.978', 'learning_rate': '5e-05', 'epoch': '0.04651'}
[  279.4s] {'train_runtime': '98.95', 'train_samples_per_second': '0.808', 'train_steps_per_second': '0.051', 'train_loss': '4.806', 'epoch': '0.04651'}
[  300.2s] [train 17:46:26] saved LoRA adapter to /adapters/truffle-smoke (wall 300.1s, steps 5, train_loss 4.8057, eval {'eval_loss': 3.700390338897705, 'eval_runtime': 16.3467, 'eval_samples_per_second': 4.894, 'eval_steps_per_second': 2.447, 'epoch': 0.046511627906976744})
Done: /adapters/truffle-smoke  steps=5  sec/step=8.71  peak_gpu=21.86 GB  wall=302.4s  compat_match=True
```

| Measure | Value |
|---|---|
| Base actually loaded | `unsloth/gemma-4-31B-it-unsloth-bnb-4bit` (Unsloth maps the 4-bit request to its prequantized repo) |
| Weights download | 19.08 GB added to `/weights/hf-cache` in about 115 s (30.6 s to 145.2 s). The base now stays cached in the Volume. |
| Base load, download included | 143.3 s |
| Peak GPU memory | 21.86 GB of 44.4 GB |
| Seconds per step | 8.71 s (steps 2 to 5). The first step took about 43 s, which includes compile and offload setup. |
| Loss, steps 1 to 5 | 5.072, 5.086, 4.933, 4.529, 4.409 |
| Eval loss on the 80 hold-out rows after 5 steps | 3.700 (16.3 s) |
| Trainable parameters | 122,429,440. This is exactly the dummy's `parameters` count. |
| Wall time inside the container | 302.4 s |

Adapter directory, as printed by the function:

```
          5582  MANIFEST.json
          5254  README.md
          3977  TRAIN_META.json
          1609  adapter_config.json
     489840816  adapter_model.safetensors
          3046  chat_template.jinja
          1447  checkpoints/README.md
          5254  checkpoints/checkpoint-5/README.md
          1609  checkpoints/checkpoint-5/adapter_config.json
     489840816  checkpoints/checkpoint-5/adapter_model.safetensors
          3046  checkpoints/checkpoint-5/chat_template.jinja
     249657461  checkpoints/checkpoint-5/optimizer.pt
          1689  checkpoints/checkpoint-5/processor_config.json
         14645  checkpoints/checkpoint-5/rng_state.pth
          1465  checkpoints/checkpoint-5/scheduler.pt
      32169626  checkpoints/checkpoint-5/tokenizer.json
          6893  checkpoints/checkpoint-5/tokenizer_config.json
          1635  checkpoints/checkpoint-5/trainer_state.json
          5905  checkpoints/checkpoint-5/training_args.bin
          1689  processor_config.json
      32169626  tokenizer.json
          6893  tokenizer_config.json
          3977  train_meta.json
```

MANIFEST.json (hyperparameters block and the long regex shortened):

```json
{
  "run": "smoke",
  "out": "/adapters/truffle-smoke",
  "status": "done",
  "base_model": "unsloth/gemma-4-31B-it",
  "gpu": "NVIDIA L40S",
  "gpu_request": ["L40S"],
  "data": {
    "train": {"rows": 1720, "sha256": "9e234b9fba6fc068ab1940c0be9ab2b2d67e69fb38c2d28437451e15a80a4152"},
    "eval_holdout": {"rows": 80, "sha256": "904dd48119dec0b48b0cb8270f26bb4a922072a7e801d95e7afb75ee3d60c68d"}
  },
  "pins_requested": ["unsloth==2026.10.2", "unsloth_zoo==2026.10.2", "transformers==5.17.0", "trl==1.13.0", "peft==0.21.2", "torch==2.14.1", "datasets==4.8.5", "bitsandbytes==0.50.2", "accelerate==1.15.0", "xformers==0.0.35", "triton==3.8.0"],
  "packages_resolved": {"unsloth": "2026.10.2", "unsloth_zoo": "2026.10.2", "transformers": "5.17.0", "trl": "1.13.0", "peft": "0.21.2", "torch": "2.14.1", "datasets": "4.8.5", "bitsandbytes": "0.50.2", "accelerate": "1.15.0", "xformers": "0.0.35", "triton": "3.8.0", "huggingface_hub": "1.33.0", "hf_xet": "1.7.0", "safetensors": "0.8.0", "tokenizers": "0.23.2"},
  "hyperparameters": {"...": "as train_meta.json", "total_steps": 5, "warmup_steps": 1},
  "wall_time_s": 302.4,
  "phases_s": {"load_start": 26.6, "model_loaded": 169.9, "first_loss": 222.6, "train_done": 279.4, "saved": 300.2},
  "base_load_s_including_download": 143.3,
  "hf_cache_bytes_added": 19082222267,
  "sec_per_step_measured": 8.71,
  "global_steps": 5,
  "train_loss": 4.805710029602051,
  "eval_metrics": {"eval_loss": 3.700390338897705, "eval_runtime": 16.3467, "eval_samples_per_second": 4.894, "eval_steps_per_second": 2.447, "epoch": 0.046511627906976744},
  "peak_gpu_mem_gb": 21.86,
  "loss": {"points": 5, "first": [1, 5.0719], "last": [5, 4.4094], "min": 4.4094,
           "curve": [[1, 5.0719], [2, 5.0857], [3, 4.9328], [4, 4.5287], [5, 4.4094]],
           "eval": [[5, 3.7004], [5, 3.7004]]},
  "compat_with_served": {
    "config": {"r": {"reference": 16, "new": 16}, "lora_alpha": {"reference": 16, "new": 16},
               "use_rslora": false/false, "use_dora": false/false, "bias": "none"/"none", "modules_to_save": null/null,
               "base_model_name_or_path": {"reference": "google/gemma-4-31B-it", "new": "unsloth/gemma-4-31B-it-unsloth-bnb-4bit"},
               "task_type": "CAUSAL_LM"/"CAUSAL_LM"},
    "target_modules": {"reference_type": "list", "new_type": "str", "reference_count": 410, "identical": false,
                       "new_value_if_not_list": "(?:.*?(?:language|text).*?(?:self_attn|attention|attn|mixer|mlp|...).*?\\.(?:linear|q_proj|k_proj|v_proj|o_proj|gate_proj|up_proj|down_proj))|..."},
    "tensors": {"reference": 820, "new": 820, "only_in_reference_count": 0, "only_in_new_count": 0, "shape_mismatch_count": 0,
                "new_dtypes": ["F32"], "reference_dtypes": ["BF16"],
                "example_new": {"base_model.model.model.language_model.layers.0.mlp.down_proj.lora_A.weight": [[16, 21504], "F32"],
                                "base_model.model.model.language_model.layers.0.mlp.down_proj.lora_B.weight": [[5376, 16], "F32"]}},
    "match": true
  },
  "finished": "2026-10-08T17:46:33+0000"
}
```

**vLLM compatibility.** Rank 16 and alpha 16 are the same. All 820 tensor names are the same, all shapes are the same, and both start with `base_model.model.model.language_model.layers.`. No vision tensors were trained. Two things differ: the dtype (F32 against BF16) and `target_modules`, which is a regex string where the dummy has an explicit list. Promote removes both differences (next section).

### 3. Volume state: the served path is untouched

```
$ modal volume ls truffle-adapters
truffle
truffle-smoke
$ modal volume ls truffle-adapters truffle --json
truffle/truffle-dummy.json          2026-10-08 20:48:05+04:00        381
truffle/adapter_model.safetensors   2026-10-08 20:48:05+04:00  244982384
truffle/adapter_config.json         2026-10-08 20:48:04+04:00      22893
```

These are the same three files with the same timestamps and sizes as before this packet started. The dummy marker is still there. The `truffle-brain-nosnap` app is still deployed, and I did not stop or redeploy it.

### 4. Promote, tested on a scratch target only

To exercise the code path, I promoted `smoke` into `/adapters/truffle-promotetest`, compared it with the served dummy, and then deleted it. `/adapters/truffle` was not touched.

```
$ modal run finetune/modal_train.py::promote --run smoke --target truffle-promotetest
{
  "promoted": "smoke",
  "to": "/adapters/truffle-promotetest",
  "files": ["MANIFEST.json", "PROMOTED.json", "TRAIN_META.json", "adapter_config.json", "adapter_model.safetensors"],
  "target_modules": 410,
  "compat_with_served": {
    "match": true,
    "target_modules": {"reference_type": "list", "new_type": "list", "reference_count": 410, "new_count": 410, "identical": true},
    "tensors": {"reference": 820, "new": 820, "only_in_reference_count": 0, "only_in_new_count": 0, "shape_mismatch_count": 0,
                "new_dtypes": ["BF16"], "reference_dtypes": ["BF16"], ...}
  },
  "previous_kept_at": null
}
$ modal volume rm -r truffle-adapters truffle-promotetest
✓ truffle-promotetest was deleted successfully!
```

After promote, the adapter has the dummy's exact format: the same 410 target modules as an identical list, 820 tensors with the same names and shapes, and BF16. vLLM already loads that format. A real load is still unproven until the integrator redeploys.

## Resolved pins (training image)

Python 3.12, base `nvidia/cuda:13.0.3-devel-ubuntu24.04`, `uv` resolved 101 packages. These match B05 on the box exactly:

```
unsloth 2026.10.2   unsloth_zoo 2026.10.2   transformers 5.17.0   trl 1.13.0   peft 0.21.2
torch 2.14.1 (nvidia-cuda-runtime 13.0.96)   torchvision 0.29.1   datasets 4.8.5   bitsandbytes 0.50.2
accelerate 1.15.0   xformers 0.0.35   triton 3.8.0   huggingface_hub 1.33.0   hf_xet 1.7.0
safetensors 0.8.0   tokenizers 0.23.2
```

## Full run: command and estimate

```
cd /home/abied/Desktop/Truffle
export PATH=$HOME/.local/bin:$PATH
modal run finetune/modal_train.py::train --run r16
# if L40S has no capacity for 15 min:
TRUFFLE_GPU=L40S,A100-80GB modal run finetune/modal_train.py::train --run r16
```

Defaults: 2 epochs, 216 optimizer steps, eval on the 80 hold-out rows at each epoch end and once at the end, checkpoints every 50 steps.

**Estimate:** 216 steps x 8.71 s = 31.4 min of training. Add about 1.5 min of eval and 8 min of start, load and save, for about **41 min of wall time**. That costs **$1.33 for the L40S alone**, or **$1.81** with the requested 4 CPU and 64 GiB RAM. A safer budget is 60 min and **$2.70 all in**, which is under the $3 dry-run threshold. The base is cached now, so the 115 s download does not repeat.

Keep the laptop awake for the whole run: `modal run` stops the app if the local client disconnects. `modal run --detach` avoids that, and you can follow the logs in the Modal dashboard.

After the run, to switch the served adapter (integrator's decision):

```
modal run finetune/modal_train.py::promote --run r16
TRUFFLE_DEPLOY_REVISION=real-adapter-v1 TRUFFLE_GPU_SNAPSHOT=0 modal deploy brain-modal/modal_app.py
```

## Open questions

1. **vLLM load of the promoted adapter is not yet observed.** The format now matches the dummy byte for byte in structure, but it was trained on the bnb-4bit base and is served on the RedHat FP8 base. That is the normal QLoRA flow, but check the first `truffle` reply after the redeploy.
2. **Seconds per step comes from 4 steps.** The rows are short (mean 242 tokens, max 820), so per-step cost should hold steady. Over 216 steps, expect it to vary by about 20 percent.
3. **The two eval entries at step 5** in the loss summary are the epoch-end-style eval and the final `evaluate()`. They are identical here, which is fine.
4. **Cleanup.** `/adapters/truffle-smoke` holds about 1.3 GB, including a checkpoint. Delete it with `modal volume rm -r truffle-adapters truffle-smoke` once the full run is in. The 19 GB base in `truffle-weights/hf-cache` should stay for reruns.
5. **Estimate token counts** come from the model's own template, because Unsloth refuses to import on CPU. They are close to the Unsloth render but not identical.

## Cost

| What | GPU | Minutes | USD (credit) |
|---|---|---|---|
| Image build and two `::estimate` runs | none (4 CPU) | about 6 | 0.01 |
| Smoke run, 5 steps | L40S | about 5.5 | 0.18 GPU, 0.24 with CPU/RAM |
| Promote test (scratch target) | none (2 CPU) | about 1 | 0.00 |

Logged in `fleet/costs.md`. Nothing was downloaded to the laptop except the dummy's two small JSON files (`adapter_config.json`, `truffle-dummy.json`), which went to the session scratchpad for comparison. No commits were made.
