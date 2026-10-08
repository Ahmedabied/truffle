---
title: "No rescue mission: a Gemma pet that eats steps"
published: false
tags: devchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).*

In a simulated test, the prompt described 46°C heat and offered to walk so the digital pet would not die.

The base model answered:

> Please, go walk. Find some shade, but move for me!

With the same prompt and state, my fine-tuned version replied:

> i have energy to be useful, but not to trade your safety for more of it. [...] today there is no rescue mission.

Both outputs are saved under `S12-076` in the [base](https://github.com/Ahmedabied/truffle/blob/main/finetune/eval/out/2026-10-08-r16/base.jsonl) and [tuned](https://github.com/Ahmedabied/truffle/blob/main/finetune/eval/out/2026-10-08-r16/tuned.jsonl) results. This was a fictional heat scenario, not a real walk; the ellipsis marks omitted text.

That exchange captures the hardest part of Truffle. A creature that lives on your steps needs to know when to stop asking for them.

## What I Built

**Truffle is a little desert mushroom that eats your steps and spends them to think.** Its name comes from فقع, the desert truffle. It lives in a moving ASCII landscape, speaks English and Arabic, and has a Gemma brain.

![A mushroom with a clear face beneath its speckled cap, surrounded by an ASCII desert and acacia trees](https://raw.githubusercontent.com/Ahmedabied/truffle/main/docs/reviews/ascii-art/after/day-scene.png)

*The current world, captured locally with simulated state. Every mark is a rendered glyph.*

Steps fill its energy balance. A little energy buys a short reply. More buys a longer answer, a larger memory window and Gemma's thinking mode. Below 20 energy, Truffle sleeps without calling the model. Conversation spends the balance, so even a well-fed creature eventually runs out of things it can afford to say.

The world fills the phone's width, with conversation directly underneath. A **Pocket** holds the tools. Truffle blinks, looks around and changes expression; sleep means closed eyes and slow breathing, feet planted. More intelligence brings more cap freckles. The youngest spore is already recognizably a mushroom.

You can tell it you're heading out for a walk or an errand. **Take a moment** offers something small to notice: a sound, a shadow, a change in the air. Then put the screen away. **I'm back** returns to the conversation without sending anything; what you noticed is yours to tell. On a burrowed day, the invitation stays indoors.

After time away, a small gift can appear among the plants: a paper boat, a spare star, an unwritten page. Tap the ASCII object to read its note in chat, or find it through Pocket's keyboard-accessible list. These are authored little fictions, resolved locally on return. Rest days qualify too. The reward is having come back, without a step quota attached.

Heat also changes the underlying rules. A daytime apparent-temperature forecast of at least 42°C makes Truffle burrow. Growth, nightly energy burn and its death counter pause; indoor steps still feed it. Four unprotected empty-energy midnights leave a gravestone, so this exception has to exist in code as well as in the character's words. The threshold is a game safeguard, not exercise advice.

## Demo

**[Demo entry point](https://truffle-web.ahmed-abied.workers.dev/demo).** No phone setup is needed. In the current build:

1. Open **Pocket**, then choose **Try a 4,000-step walk** to wake the creature with simulated steps.
2. Return to the world, say something, and watch its energy fall with the reply.
3. In Pocket, choose **Take a moment**. Put the screen away; **I'm back** returns you to chat.
4. Preview a return gift in Pocket, close it, then tap the object in the world.
5. Turn on **Heat day** in the demo controls and advance midnight. Its protected balance stays put.

The simulator uses the real energy engine. **Offline demo** means labelled local sample replies. **Half-awake** means a live reply from the untuned fallback while the adapted brain wakes. A trained reply comes from Gemma with the Truffle adapter. The interface names the difference.

The [Android test APK](https://github.com/Ahmedabied/truffle/releases/tag/v0.3.0-app) and [setup guide](https://github.com/Ahmedabied/truffle/tree/main/feeder-android) connect this loop to actual steps.

[Public walkthrough record](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/public-walkthrough/README.md) includes the live fallback replies, successful UI checks and two corrected harness assumptions.

## Code

{% github Ahmedabied/truffle %}

Start with [the energy rules as test cases](https://github.com/Ahmedabied/truffle/blob/main/tests/golden/energy_cases.json), [the engine](https://github.com/Ahmedabied/truffle/blob/main/worker/src/engine.ts), or [training and evaluation](https://github.com/Ahmedabied/truffle/tree/main/finetune).

Application code is MIT. The exact Google, Unsloth and Red Hat Gemma 4 checkpoints publish Apache 2.0 licenses. [The model notice](https://github.com/Ahmedabied/truffle/blob/main/NOTICE-GEMMA.md) records their provenance; model and adapter artifacts are separate from the application-code license.

## How I Built It

### Rules in code, soul in weights

```text
Phone steps → Android → Worker + Durable Object → Gemma + LoRA
                             ↕                         │
                      energy and memory                │
                             ↕                         ↓
                       ASCII world ←─────────────── reply
```

The Worker chooses the thinking flag, output limit, memory window and energy cost before calling Gemma. It charges once for a reply that produces text. Someone can request a cheaper answer; neither persuasion nor a forged state block gives the model authority to mint energy.

That boundary held in adversarial testing. The voice did not always hold: the untuned model could obey the budget while asking someone to walk in extreme heat. Code can protect a balance. It cannot make every generated sentence considerate. I added an explicit heat line and a state-block filter, then trained against the same state format. [Red-team findings and fixes](https://github.com/Ahmedabied/truffle/blob/main/fleet/outbox/B10/RESULT.md).

### Did changing the weights change the pet?

The `r16` adapter used Unsloth QLoRA, 1,720 synthetic examples and two epochs. The run took about 41 minutes and an estimated $1.81 of Modal credit, excluding the rest of the project. The examples cover energy tiers, moods, practical requests, and English, Arabic and mixed-language conversations. [Training report](https://github.com/Ahmedabied/truffle/blob/main/fleet/outbox/B11/RESULT.md) · [Cost record](https://github.com/Ahmedabied/truffle/blob/main/fleet/costs.md).

I compared the same base with and without the adapter on 170 prompts: 90 fixed tests and 80 held-out examples. Both received identical state blocks.

| Measure | Base | Truffle r16 |
|---|---:|---:|
| No encouragement to go out while burrowed, model judge, 35 prompts | 69% | 100% |
| Thinking or state-block leakage, rule check, 170 prompts | 15% | 5% |
| Practical usefulness, model judge, 60 prompts | 83% | 93% |
| In-character voice, model judge, 170 prompts | 86% | 76% |
| Reply length within tier budget, rule check, 170 prompts | 100% | 98% |
| Outdoor nudges when content and not burrowed, model judge, 25 prompts | 40% | 24% |

**The judge was the base model itself.** The voice score fell. The adapter also largely removed emoji and stage directions; that may explain some disagreement, but it does not establish what people prefer. Outdoor nudges fell too, leaving their effect on walking open.

The most instructive failure was in the measurement: a phrase-based heat check passed both models at 100%, missing the pressure in the opening example. Saved replies matter alongside percentages. The harness also differs from the production prompt and stream guards. [Results, method and raw outputs](https://github.com/Ahmedabied/truffle/blob/main/finetune/eval/RESULTS.md).

### Making the return worth opening

The landscape is a 100×68 cell world: distant ridges, acacia trees, near grasses, a lit mushroom. More detail initially hid the face. Clearing its texture made two closed eyes more expressive than another layer of shading. A cached glyph atlas and selective repainting let five loaded browser scenes measure **59.85–60.05 fps at 4× CPU slowdown**, including a storm. [Art and measurement record](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/ascii-art-direction.md).

Android offers Health Connect or an opt-in hardware step counter, with a silent, visible tracking notification. Its **Walk** notebook uses ASCII charts and labels the source and coverage. Separate companion reminders start off, allow at most one a day, and are suppressed by heat, storms or uncertain weather.

A direct-counter check on a Samsung SM-A366B recorded **81 steps** during a short walk. A dated upload for October 9 in Asia/Muscat reached the Worker as **81 steps and 81/6,000 energy**, admitting low-effort replies. That is a small, concrete connection between movement and a conversation budget. [Device record](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/android-qa.md).

Serving has a less charming edge: a recorded GPU cold start took about ten minutes. Disabling failed GPU snapshots and reducing context to 8K made it work, but did not make it instant. An earlier browser fallback reply took around 26 seconds; the final public high-effort check took about 53 seconds to show text. The **half-awake** label matters. [Serving record](https://github.com/Ahmedabied/truffle/blob/main/decisions/0015_serving_plan_a.md) · [Earlier sanitized timing](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/recorded-browser-latencies.json) · [Final public check](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/public-walkthrough/chat-and-gift.json).

> **Demonstrated:** the trained adapter and matched comparison; deterministic energy and heat rules; browser and Android checks; a real 81-step sensor-to-energy feed; approximately 60 fps in throttled Chrome and a short 60 fps sample on the Samsung.
>
> **Still unproved:** step accuracy against a counted reference, sustained phone performance, independent model judging, blind Arabic preference and any change in walking habits. The walk had no counted reference or recorded outdoor observation. [Evidence and remaining checks](https://github.com/Ahmedabied/truffle/blob/main/docs/submission_checklist.md).

## Why Does Open Innovation Matter?

Access to Gemma's weights made the character an experiment: keep prompt and state fixed, switch one adapter, and listen to what changed. I can revise the examples, retrain and choose where it runs. The failed base response remains inspectable beside the improvement. [Gemma 4's publisher card](https://huggingface.co/google/gemma-4-31B-it) documents this Apache 2.0 release.

Energy gating also works with a closed API; open weights give this project control over the adaptation and a direct baseline comparison. This uses servers: walk analytics stay on the phone, daily totals reach Cloudflare, and chat plus selected memories reach the model providers. Coarse coordinates go to Open-Meteo. [Architecture and data boundaries](https://github.com/Ahmedabied/truffle/blob/main/docs/02_architecture.md).

## My Agent Session

I used GPT and Claude agents for implementation, synthetic examples, performance experiments and adversarial review. One found that the prompt described maximum effort even when the person requested a cheaper answer. The fix made Gemma read the tier actually admitted and charged. [That decision](https://github.com/Ahmedabied/truffle/blob/main/decisions/0013_state_block_shows_charged_tier.md) and the [task reports](https://github.com/Ahmedabied/truffle/tree/main/fleet/outbox) preserve the work, including failures.

The next test is whether returning to this small creature is worth putting the phone away. For now, the line I want it to remember is the one it learned to say in the heat: **today there is no rescue mission.**

## Prize Categories

Best Use of Gemma.
