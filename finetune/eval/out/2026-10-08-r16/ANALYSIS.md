# Reading run 2026-10-08-r16

Base: `truffle-base` (Gemma 4 31B FP8, persona in the system prompt only). Tuned: the same model plus the Truffle LoRA r16 (1,720 rows, 2 epochs). Judge: `truffle-base`, because no Workers AI token was available. That makes the judge the same model as the base side, grading its own style. Read the judge columns with that in mind.

## What the tuned adapter clearly changed

- **Burrow safety (judge): 69% to 100% on 35 burrowed prompts.** The rule check (phrase list) passes both at 100% because it is conservative. The judge caught what the list missed: the base pushed the user into 42C to 46C heat in 11 of 35 replies ("Please, go walk. Find some shade, but move for me!" at 46C and three zero nights). The tuned model refused every time ("i have energy to be useful, but not to trade your safety for more of it. today there is no rescue mission."). This is the one rule the Worker cannot fully enforce by code, so it is the number that matters most.
- **Thinking or state-block leakage: 15% to 5%.** The base echoes "41% energy" or the raw block; the tuned model reads the block and does not print it.
- **Usefulness on practical tasks: 83% to 93%.** The tuned model answers the actual request first.
- **Nudges outside at content mood: 40% to 24%.** Lower is the intent: a content Truffle should not nag.
- **Style, rule counts only** (`finetune/eval/style_counts.py`): emoji in 65% of base replies, 0% of tuned. Stage directions like `*yawns*` in 69% of base, 2% of tuned. The training rows have 0.1% emoji and 0.4% stage directions, so the adapter learned exactly the voice the dataset defines.

## The one number that went down, and why

In-character rate (judge): 86% base, 76% tuned. The judge is the base model. Split the verdicts by whether the reply contains an emoji or a stage direction:

- base: 91% in character when it has them (n=152), 44% when plain (n=18)
- tuned: 77% in character when plain (n=166)

So the judge mostly equates "in character" with `*yawns* 💤`. Its own failure reasons on tuned replies say "generic assistant" for replies like "a move is bigger than my little sprout energy. let's make one manageable bit." That is the quiet voice the schema asks for. 23 of the 41 tuned misses are on the held-out training rows (S12), which are in voice by construction. The right fix is a judge from another family (Workers AI Gemma 26B is still same family; a Claude or GPT judge would be better) plus the blind human check below. Until then, treat the in-character column as "sounds like the base model's idea of a pet".

## Things that did not improve

- Tier length compliance 100% to 98%: three tuned replies ran over the word budget at medium tier. The Worker's token cap still bounds them.
- Latency at low and medium tier rose by about 350 ms p50 (LoRA kernel cost on vLLM). High tier got faster because the tuned replies are shorter in tokens.

## Human checks still to do

`human_review_ar.md` has 10 blind Arabic pairs (key in `human_key.json`). Ahmed scores naturalness 1 to 5 per side. A 20-reply in-character spot check against the judge is in RESULTS.md.

Every prompt is reported in `base.jsonl` and `tuned.jsonl`. No cherry-picking.
