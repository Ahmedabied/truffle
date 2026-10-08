# Truffle

**An AI pet that only eats steps.**

Truffle is a desert truffle (فقع) that lives in your pocket. Its brain is Gemma 4. It can only think when you have walked. Walk a lot and it thinks hard, remembers what you told it, and gets clingy. Stop walking and it gets sleepy, forgets things, and eventually dies.

Built for the [Hacktoberfest Open-Source AI Challenge, Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05) on DEV. Repo opened 2026-10-07, inside the challenge window (Oct 5 - 11, 2026).

## Why open weights

Truffle's mechanic leans on things an open model lets us do ourselves:

- **The rules live in code, the soul lives in the weights.** The energy engine (steps in, thinking out) is plain code with golden tests and cannot be talked out of. Truffle's voice and the way it reads its own energy state are meant to come from a LoRA fine-tune of Gemma 4 31B. The training set exists (1,800 filtered rows). The adapter is not trained yet. See the brain status table below.
- **Thinking mode is a switch we own.** Gemma 4's thinking is turned on only when Truffle has enough energy. Low energy means no thinking, short answers, short memory. The switch is a request flag the Worker sets from a number it computed, and the same code drives both brains below.
- **We can swap brains without touching the app.** The Worker talks to a 31B model on one rented GPU, or to a 26B model on Workers AI when that GPU is asleep, and the app does not know which answered. The UI shows "half-awake" when it was the fallback.
- **Where your data goes.** Steps go to a Cloudflare Worker we deploy. Your coordinates go to Open-Meteo for the weather check and are rounded to about 1 km. Chat text goes to the model host (Cloudflare Workers AI, or Modal when the big brain is live). Nothing is sold or used for training by us.

## Brain status

| Date | Live brain | Fine-tuned adapter | Notes |
|---|---|---|---|
| 2026-10-08 22:41 | Modal: vLLM + `RedHatAI/gemma-4-31B-it-FP8-dynamic` on one L40S, 8K context, model name `truffle` loads the trained Truffle LoRA r16. Workers AI `gemma-4-26b-a4b-it` answers when the GPU is asleep, flagged "half-awake" | **r16, trained**: Unsloth QLoRA, 1,720 rows, 2 epochs, train loss 1.61, eval loss 1.36 on 80 held-out rows (`fleet/outbox/B11/train_r16.log`) | First side by side at low energy, asked for a 500 word essay: base "please walk more, i need nap"; tuned "a 500-word essay is too big for me right now. i can give you one honest line". Full eval table pending in `finetune/eval/RESULTS.md`. |
| 2026-10-08 21:30 | Modal brain live with a placeholder adapter (random noise) | not trained yet | Cold start about 10 minutes including the GPU queue, warm replies about 4 s. Training data: 1,800 rows, 0 drops (`finetune/data/generated/REPORT.md`). |
| 2026-10-08 12:00 | Workers AI `gemma-4-26b-a4b-it`, un-tuned | not trained yet | Modal serving deployed, first cold start failed in snapshot mode, then 16K context did not fit beside the weights. |

This table is updated whenever the live brain changes. Claims in the DEV post will match it.

## How it works (short)

```
Samsung phone (Health Connect)  --steps-->  Cloudflare Worker + Durable Object (Truffle's body)
                                             energy, age, mood, memory, weather check
                                             picks an effort tier --> brain: Modal (Gemma 4 31B + LoRA) or Workers AI (Gemma 4 26B)
Cloudflare Pages: the ASCII world  <-------------------------------------------------+
  clouds, grass, real sky for your local time, rain only when it really rains
```

- Steps become energy. Thinking costs energy. Bigger Truffle burns more per day.
- Four days at zero energy and Truffle dies. You get a small gravestone and a new spore.
- On dangerously hot days (checked against real local weather) Truffle burrows. Those days do not count toward death. Oman summers are why this rule exists.
- Beat your own 7-day average and Truffle gets affectionate.

## Status

Build day 2 (Oct 8): the world, the chat, the energy engine, the Android feeder and the training set are done. Two red-team rounds are applied. The Modal brain and the fine-tune are in progress; see the brain status table above.

- Try it: https://truffle-web.ahmed-abied.workers.dev (judge mode: https://truffle-web.ahmed-abied.workers.dev/demo)
- API: https://truffle.ahmed-abied.workers.dev
- Feeder APK: GitHub Releases, `v0.1.0-feeder` (draft until the first real walk is verified)
- Read `STATE.md` for where things are, `docs/` for the specs, `decisions/` for why, `fleet/outbox/` for the agent results.

## Licence

Code: MIT (see `LICENSE`). Model weights and the Truffle LoRA are derivatives of Gemma and are subject to the [Gemma Terms of Use](https://ai.google.dev/gemma/terms) and the [Gemma Prohibited Use Policy](https://ai.google.dev/gemma/prohibited_use_policy). See `NOTICE-GEMMA.md`.
