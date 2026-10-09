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

*The world in an earlier local capture with simulated state. Every mark is a rendered glyph.*

Steps fill its food balance. A little food buys a short reply. More unlocks longer answers, a larger memory window and Gemma's thinking mode. Below 20 points, Truffle offers a sleepy hello without calling the model. Ordinary conversation costs at most 60 points; deeper thinking is a choice, with a maximum cost of 200 shown before sending.

The first version took food at midnight. That made a late walk feel disposable and a bigger pet more expensive to keep. Version 2 carries food into tomorrow and uses 1,000 points per actual 24 hours at every age. A busy day can support a quieter one. That rate is a game-design trial, not a walking target.

The world fills the phone's width, with conversation directly underneath. A **Pocket** holds the tools. Truffle blinks, looks around and changes expression; sleep means closed eyes and slow breathing, feet planted. More intelligence brings more cap freckles. The youngest spore is already recognizably a mushroom.

You can tell it you're heading out for a walk or an errand, through a button or a clear English or Arabic chat message. Truffle looks expectant. Fresh steps can make it brighten; they do not tell it where you went. **Take a moment** offers something small to notice: a sound, a shadow, a change in the air. Then put the screen away. **I'm back** returns to the conversation without sending anything; what you noticed is yours to tell. On a burrowed day, the invitation stays indoors.

After an away plan reaches the server, an alarm can make a small ASCII drawing after ten minutes. It composes shapes and details from a fresh seed, with a short authored note. This happens in the background, without a model call or food charge. Tap its object among the plants to read it in chat, or use Pocket's keyboard-accessible list. There is at most one per local day, and twelve recent server gifts stay with the pet. Rest days qualify too. Closing a page before its away signal arrives cannot promise a gift.

Heat also changes the underlying rules. A daytime apparent-temperature forecast of at least 42°C makes Truffle burrow. Heat shelter pauses food use and the empty-food clock; indoor steps still feed it. A pet dies only after 96 actual, non-sheltered hours continuously without food, leaving a gravestone and an explicit choice to plant a new spore. The shelter has to exist in code as well as in the character's words. The threshold is a game safeguard, not exercise advice.

## Demo

**[Try the sample world](https://truffle-web.ahmed-abied.workers.dev/demo?mock=1).** No phone setup or model call is needed. The sample runs the shared food engine:

1. Choose **Try a 4,000-step walk** below the world to wake the creature with simulated steps.
2. Choose **Everyday** or **Think deeper** and send a message. The reply and food charge are labelled as simulated.
3. In Pocket, choose **Take a moment**. Put the screen away; **I'm back** returns you to chat.
4. Choose **Preview a return gift** in Pocket. It uses the same drawing maker as server gifts, but the labelled preview does not enter the collection.
5. Choose **Next day (+24 hours)** to see food carry over with elapsed use. Turn **Heat day** on and advance again; shelter pauses that use.

For live conversation, the [main world](https://truffle-web.ahmed-abied.workers.dev) distinguishes a trained Gemma reply from **half-awake**, an untuned fallback while the adapted brain wakes. **Offline demo** means local sample replies. A drawing preview demonstrates the generator, not a server alarm or an AI conversation.

The [Android 0.4 test APK](https://github.com/Ahmedabied/truffle/releases/tag/v0.4.0-app) is a public debug prerelease with an anonymously verified download and checksum. The [setup guide](https://github.com/Ahmedabied/truffle/tree/main/feeder-android) distinguishes its build and emulator evidence from the physically checked 0.3 version.

The [public sample check](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/fleet25-public-web.md) passed on October 9: expected deployed assets, a full-width mobile world and the direct 4,000-step simulation, without API calls. The rest of the flow has [local browser coverage](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/fleet25-25-final.md).

In a separate live check, one synthetic test pet [migrated to v2](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/fleet25-live-release/migration.json) and had a [Paper bouquet waiting before any return request](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/fleet25-live-release/gift.json). No user pet was changed and no model was called. The [earlier public walkthrough](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/public-walkthrough/README.md) records fallback replies from the previous release.

## Code

{% github Ahmedabied/truffle %}

Start with [the v2 food rules as test cases](https://github.com/Ahmedabied/truffle/blob/main/tests/golden/energy_v2_cases.json), [the engine](https://github.com/Ahmedabied/truffle/blob/main/worker/src/engine.ts), or [training and evaluation](https://github.com/Ahmedabied/truffle/tree/main/finetune). The [original goldens](https://github.com/Ahmedabied/truffle/blob/main/tests/golden/energy_cases.json) remain intact to check legacy rules and migration.

Application code is MIT. The exact Google, Unsloth and Red Hat Gemma 4 checkpoints publish Apache 2.0 licenses. [The model notice](https://github.com/Ahmedabied/truffle/blob/main/NOTICE-GEMMA.md) records their provenance; model and adapter artifacts are separate from the application-code license.

## How I Built It

### Rules in code, soul in weights

```text
Phone steps → Android → Worker + Durable Object → Gemma + LoRA
                             ↕                         │
                       food and memory                 │
                             ↕                         ↓
                       ASCII world ←─────────────── reply
```

The Worker chooses the thinking flag, output limit, memory window and food cost before calling Gemma. It reserves that cost so maintenance cannot spend it during generation, then charges once when text becomes visible. An empty or cancelled reply returns an unused reservation. Neither persuasion nor a forged state block gives the model authority to mint food.

That boundary held in adversarial testing. The voice did not always hold: the untuned model could obey the budget while asking someone to walk in extreme heat. Code can protect a balance. It cannot make every generated sentence considerate. I added an explicit heat line and a state-block filter, then trained against the same state format. [Red-team findings and fixes](https://github.com/Ahmedabied/truffle/blob/main/fleet/outbox/B10/RESULT.md).

### Did changing the weights change the pet?

The `r16` adapter used Unsloth QLoRA, 1,720 synthetic examples and two epochs. The run took about 41 minutes and an estimated $1.81 of Modal credit, excluding the rest of the project. The examples cover energy tiers, moods, practical requests, and English, Arabic and mixed-language conversations. The project has a $50 cap; provider totals are still unreconciled, and credit is not zero compute cost. [Training report](https://github.com/Ahmedabied/truffle/blob/main/fleet/outbox/B11/RESULT.md) · [Cost record](https://github.com/Ahmedabied/truffle/blob/main/fleet/costs.md).

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

The landscape is a 100×68 cell world: distant ridges, acacia trees, near grasses, a lit mushroom. More detail initially hid the face. Clearing its texture made two closed eyes more expressive than another layer of shading. Anticipation now has its own attentive eyes and small lean, with feet planted. A cached glyph atlas and selective repainting kept the full-width desktop storm scene near **59 fps at 4× CPU slowdown** in a ten-second sample. Reduced motion freezes the scene. That is a controlled browser measurement, not a handset guarantee. [Art review](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/fleet25-19-art-motion.md) · [Full-width measurement](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/fleet25-19-art-motion/full-width/measurements.json).

Android offers Health Connect or an opt-in hardware step counter, with a silent, visible tracking notification. Its **Walk** notebook now shows a matching total and date span for Today, 7 days or 30 days. Missing native records stay blank, distinct from a recorded zero. The 0.4 implementation also sends a fresh foreground movement signal to the verified pet's face without claiming the steps have reached the server. Separate companion reminders start off, allow at most one a day, and are suppressed by heat, storms or uncertain weather.

A direct-counter check with version 0.3 on a Samsung SM-A366B recorded **81 steps** during a short walk. A dated upload for October 9 in Asia/Muscat reached the then-current Worker as **81 steps and 81 energy**, admitting low-effort replies. That is a small, concrete connection between movement and a conversation budget. It was not manually counted, and it does not validate the new native reactions on a phone. [Device record](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/android-qa.md).

Serving has a less charming edge: a recorded GPU cold start took about ten minutes. The earlier public high-effort fallback check took about 53 seconds to show text. The new router gives the trained provider four seconds to produce visible text for ordinary replies, or eight for explicit deep replies, before starting the labelled fallback. Those are routing deadlines, not total response-time promises. No new paid inference was used to validate this change, so faster live conversation remains unmeasured. [Serving history](https://github.com/Ahmedabied/truffle/blob/main/decisions/0015_serving_plan_a.md) · [Earlier public timing](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/public-walkthrough/chat-and-gift.json) · [Current routing review](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/fleet25-13-demo-chat.md).

> **Demonstrated:** the trained adapter and matched comparison; v2 accounting tests and one synthetic live migration/gift-alarm check; local browser checks and the public sample world; a verified public debug APK, Android build and emulator checks; a historical 81-step sensor-to-energy feed; controlled desktop frame timing.
>
> **Still unproved:** the new native reactions on a physical phone, step accuracy against a counted reference, sustained phone performance, faster live replies, independent model judging, blind Arabic preference and any change in walking habits. The walk had no recorded outdoor observation. [Evidence and remaining checks](https://github.com/Ahmedabied/truffle/blob/main/docs/submission_checklist.md).

## Why Does Open Innovation Matter?

Access to Gemma's weights made the character an experiment: keep prompt and state fixed, switch one adapter, and listen to what changed. I can revise the examples, retrain and choose where it runs. The failed base response remains inspectable beside the improvement. [Gemma 4's publisher card](https://huggingface.co/google/gemma-4-31B-it) documents this Apache 2.0 release.

Energy gating also works with a closed API; open weights give this project control over the adaptation and a direct baseline comparison. This uses servers: walk analytics stay on the phone, daily totals reach Cloudflare, and chat plus selected memories reach the model providers. Coarse coordinates go to Open-Meteo. [Architecture and data boundaries](https://github.com/Ahmedabied/truffle/blob/main/docs/02_architecture.md).

## My Agent Session

I used GPT and Claude agents for implementation, synthetic examples, performance experiments and adversarial review. For the companion redesign, 25 Astra Ultra assignments ran in waves of up to three alongside one integrator. Separate reviewers tested accounting, gifts, native identity and the unfamiliar-user experience. The [roster and reports](https://github.com/Ahmedabied/truffle/blob/main/docs/reviews/fleet25-roster.md) show their scopes; the integrator made the final changes and release checks. One found that the prompt described maximum effort even when the person requested a cheaper answer. The fix made Gemma read the tier actually admitted and charged. [That decision](https://github.com/Ahmedabied/truffle/blob/main/decisions/0013_state_block_shows_charged_tier.md) and the [task reports](https://github.com/Ahmedabied/truffle/tree/main/fleet/outbox) preserve the work, including failures.

The next test is whether returning to this small creature is worth putting the phone away. For now, the line I want it to remember is the one it learned to say in the heat: **today there is no rescue mission.**

## Prize Categories

Best Use of Gemma.
