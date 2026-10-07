# Truffle

**An AI pet that only eats steps.**

Truffle is a desert truffle (فقع) that lives in your pocket. Its brain is Gemma 4 31B, fine-tuned to be Truffle. It can only think when you have walked. Walk a lot and it thinks hard, remembers everything you told it, and gets clingy. Stop walking and it gets sleepy, forgets things, and eventually dies.

Built for the [Hacktoberfest Open-Source AI Challenge, Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05) on DEV. Repo opened 2026-10-07, inside the challenge window (Oct 5 - 11, 2026).

## Why open weights

Truffle's whole mechanic is impossible on a closed API:

- **The rules live in code, the soul lives in the weights.** The energy engine (steps in, thinking out) is plain code and cannot be talked out of. Truffle's voice, moods and the way it reads its own energy state come from a LoRA fine-tune of Gemma 4 31B. You cannot fine-tune a closed model's personality like this, and you cannot gate its effort by a number you control.
- **Thinking mode is a switch we own.** Gemma 4's thinking is turned on only when Truffle has enough energy. Low energy means no thinking, short answers, short memory.
- **Your steps and your location never leave infrastructure we control.** Cloudflare edge for the app, one GPU on Modal for the brain, and a Workers AI Gemma 4 fallback when the big brain is asleep.

## How it works (short)

```
Samsung phone (Health Connect)  --steps-->  Cloudflare Worker + Durable Object (Truffle's body)
                                             energy, age, mood, memory, weather check
                                             picks an effort tier --> Modal: vLLM + Gemma 4 31B + Truffle LoRA
Cloudflare Pages: the ASCII world  <-------------------------------------------------+
  clouds, grass, real sky for your local time, rain only when it really rains
```

- Steps become energy. Thinking costs energy. Bigger Truffle burns more per day.
- Four days at zero energy and Truffle dies. You get a small gravestone and a new spore.
- On dangerously hot days (checked against real local weather) Truffle burrows. Those days do not count toward death. Oman summers are why this rule exists.
- Beat your own 7-day average and Truffle gets affectionate.

## Status

Build day 1 (night of Oct 7 to 8): the world, the chat and the energy engine are live with the Workers AI fallback brain. The Modal brain and the fine-tune come next.

- Try it: https://truffle-web.ahmed-abied.workers.dev (judge mode: https://truffle-web.ahmed-abied.workers.dev/demo)
- API: https://truffle.ahmed-abied.workers.dev
- Read `PLAYBOOK.md` for the plan, `STATE.md` for where things are, `docs/` for the specs, `fleet/outbox/` for the spike results.

## Licence

Code: MIT (see `LICENSE`). Model weights and the Truffle LoRA are derivatives of Gemma and are subject to the [Gemma Terms of Use](https://ai.google.dev/gemma/terms) and the [Gemma Prohibited Use Policy](https://ai.google.dev/gemma/prohibited_use_policy). See `NOTICE-GEMMA.md`.
