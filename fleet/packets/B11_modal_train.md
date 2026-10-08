# B11 modal_train
Owner: opus        Wave: Thu Oct 8 night        Due: Fri 2026-10-09 02:00 Oman

## Goal
Run the existing fine-tune script on a Modal L40S and land the adapter where the serving app loads it. Prove the path with a 5-step smoke run. The integrator launches the full run after reading your report.

## Inputs
Read first: CLAUDE.md, finetune/README.md, finetune/train.py (all flags), fleet/outbox/B05/RESULT.md (what was dry-run on the box, pins that worked), brain-modal/modal_app.py (image pattern, Volumes `truffle-weights` and `truffle-adapters`, `/adapters/truffle` layout, the dummy adapter marker written by make_dummy_lora), brain-modal/README.md (pins, "New weights or adapter, old snapshot"), docs/03_finetune_plan.md. Modal CLI is installed and logged in on this laptop (`~/.local/bin/modal`). Secrets `huggingface` and `truffle-brain` exist. Data: `finetune/data/generated/train.jsonl` (1,720 rows) and `eval_holdout.jsonl` (80), gitignored, present on disk.

## Deliverable
1. `finetune/modal_train.py`: a Modal app `truffle-train` with one GPU function `train` on `L40S` (accept `TRUFFLE_GPU` list like the serving app), 4 CPU, 64 GiB RAM, timeout 4 h. Image: Python 3.12, CUDA 13 base like the serving app, `uv pip install unsloth` plus the pins B05 verified (unsloth 2026.10.2, transformers 5.17.0, trl 1.13.0, torch 2.14.1+cu130 or whatever Unsloth resolves; record the resolved set). Mount `finetune/` and `finetune/data/generated/` into the image with `add_local_dir`. Attach the `huggingface` secret (the base `unsloth/gemma-4-31B-it` may be gated behind Gemma terms). Mount `truffle-adapters` at `/adapters` and `truffle-weights` at `/weights` (use `/weights/hf-cache` as HF_HOME so the 31B download is cached across runs).
2. The function runs `finetune/train.py` with `--out /adapters/truffle-<run>` where `<run>` is a short id you pass in, then writes `/adapters/truffle-<run>/TRAIN_META.json` (train_meta.json copied) and a `MANIFEST.json` (run id, data sha256s, row counts, pins, GPU, wall time, loss curve summary). It never touches `/adapters/truffle` (the served path): promotion is a separate `promote` function that copies `truffle-<run>` to `truffle` after removing the dummy marker, so the integrator chooses when the served adapter changes.
3. Local entrypoints: `modal run finetune/modal_train.py::train --run <id> [--max-steps N] [--epochs E]`, `::promote --run <id>`, and `::estimate` which prints rows, tokens per row (from `--render-only`), steps per epoch at the script's batch settings, and a cost estimate at $0.000542 per L40S second with a stated seconds-per-step assumption.
4. Proof: run `::estimate` (CPU only, cheap) and paste it. Then run `::train --run smoke --max-steps 5` for real and paste the output: weights download time, peak memory, seconds per step, loss at steps 1 to 5, the adapter directory listing, and the MANIFEST. Confirm the adapter files have the same names and shapes vLLM expects (compare `adapter_config.json` target modules and rank with the dummy's). Expected cost under USD 1; stop and report if the download alone passes 20 minutes.
5. Log every paid run you make in `fleet/costs.md` (what, GPU, minutes, USD estimate).

## Acceptance
`::estimate` output and the 5-step smoke output pasted in the report. The smoke adapter exists in the Volume under `truffle-smoke` and `/adapters/truffle` is untouched (show `modal volume ls truffle-adapters`). Full run command for the integrator written out with the estimate.

## Do not
Do not run the full training. Do not promote anything. Do not download weights to the laptop (9 GB free). Do not touch brain-modal/modal_app.py, worker/, web/, feeder-android/. Do not put tokens in any file or in the report. Do not commit. No co-author trailers. No em or en dashes.

## Report
fleet/outbox/B11/RESULT.md: what was built, evidence, the resolved pins, the full-run command and estimate, open questions, cost.
