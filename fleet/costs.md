# Cost ledger

Cap: $50 total ($20 loaded + Modal $30 free credit). Log every paid run.

| Date | What | Provider | GPU | Minutes | USD |
|---|---|---|---|---|---|
| 2026-10-07 | S03 fallback probe: 33 Workers AI calls (222 neurons) | Cloudflare Workers AI | none | n/a | 0.00 (est. 0.003, inside the free allowance) |
| 2026-10-08 | B02 dev and live checks: about 15 Workers AI calls | Cloudflare Workers AI | none | n/a | 0.00 (inside the free allowance) |
| 2026-10-07 | S09 baseline: 20 Workers AI calls to gemma-4-26b-a4b-it | Cloudflare Workers AI | none | n/a | 0.00 (est. 0.0012, inside the free 10k neurons/day) |
| 2026-10-08 | B06 hardening local tests and smoke: about 40 Workers AI calls | Cloudflare Workers AI | none | n/a | 0.00 (inside the free allowance) |
| 2026-10-08 | S01 weight download to the Volume (RedHatAI FP8, 16 files, 2.5 min) | Modal | none (2 CPU) | 3 | est. 0.01 (credit) |
| 2026-10-08 | S01 dummy rank-16 LoRA on CPU | Modal | none (4 CPU) | 2 | est. 0.01 (credit) |
| 2026-10-08 | S01 first cold start on L40S (snapshot mode): vLLM engine core died 44 s into weight load, no reply served | Modal | L40S | about 3 | est. 0.10 (credit) |
| 2026-10-08 | S01 no-snapshot variant: deploy rejected (snap=True hook bug, fixed), no GPU time | Modal | none | 0 | 0.00 |
| 2026-10-08 | S01 no-snapshot cold start attempt 2: weights loaded in 21 s, graph compiled in 93 s, then vLLM refused 16K context (5.17 GiB KV needed, 5.1 GiB free) | Modal | L40S | about 6 | est. 0.20 (credit) |
| 2026-10-08 | S01 no-snapshot attempt 3 at 8K context: no L40S capacity for 15 min, never scheduled | Modal | none | 0 | 0.00 |
| 2026-10-08 | S01 attempt 4 at 8K context: healthy, health 200 after 585 s from the first request (GPU queue plus 116 s weight load, 93 s compile, cache 9,151 tokens) | Modal | see log | about 12 so far | est. 0.45 (credit) |
| 2026-10-08 | S01 warm bench, 2 samples per cell, 24 requests, about 12 min of L40S | Modal | L40S | about 12 | est. 0.40 (credit) |
| 2026-10-08 | B11 training image build and two `::estimate` runs (tokenizer only, render 1,800 rows) | Modal | none (4 CPU) | about 6 | est. 0.01 (credit) |
| 2026-10-08 | B11 smoke fine-tune `truffle-smoke`, 5 steps: 19.1 GB base download 115 s, load 28 s, 8.7 s per step, eval 16 s, save | Modal | L40S | about 5.5 | est. 0.18 GPU, 0.24 with CPU/RAM (credit) |
| 2026-10-08 | B11 promote test into scratch path `truffle-promotetest` (deleted after), bf16 cast | Modal | none (2 CPU) | about 1 | est. 0.00 (credit) |
| 2026-10-08 | Brain woken by a Worker chat after idle (cold start plus 300 s idle tail) | Modal | L40S | about 15 | est. 0.50 (credit) |

Running total: $0.00
