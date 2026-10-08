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
| 2026-10-08 | S01 no-snapshot cold start attempt 2 | Modal | L40S | pending | pending |

Running total: $0.00
