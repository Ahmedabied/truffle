# 0002 - Gemma 4 31B dense, not 26B-A4B
Date: 2026-10-07. Decided by: Ahmed (accuracy first), confirmed by Fable.
31B is the most accurate Gemma 4 (MMLU-Pro 85.2 vs 82.6). Both need similar VRAM to serve. 31B is a dense model and easier to QLoRA (Unsloth: 22GB; the MoE needs >40GB and QLoRA is not recommended). Slower per token; acceptable for chat. 26B-A4B remains the fallback brain via Workers AI.
