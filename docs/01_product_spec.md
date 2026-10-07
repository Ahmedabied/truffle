# 01 - Product spec: Truffle

Status: **settled 2026-10-07**. Changes go through `decisions/` first.

## One line

Truffle is an AI pet whose brain only works when you walk. It runs on Gemma 4 31B, fine-tuned to be Truffle. The screen is the shortest part of the experience: you check in, it tells you what it needs, you go outside.

## Who it is for

Ahmed first. Someone who loves nature, lives in a place where the weather makes going outside hard for half the year, and wants a reason that is not a guilt-trip. Then anyone with a Samsung/Android phone who wants the same.

## The lore (why "Truffle")

Desert truffles (فقع / faqa' in the Gulf, كمأة in classical Arabic) grow underground, hidden from the heat, and come up after the rains. People find them by walking the desert and reading small cracks in the sand. Truffle the pet does the same: it hides from heat, it grows when you walk, and it is found, not bought.

## Core loop

1. You walk. Your phone's step count flows to Truffle (Health Connect on Samsung/Android).
2. Steps become **energy**.
3. You open the ASCII world. Truffle is there, in a mood that matches its energy and the real weather where you are.
4. You talk to it. The **effort** it can spend answering depends on its energy. Thinking costs energy.
5. At your local midnight, Truffle **burns** a day's metabolism. Bigger Truffle burns more.
6. If energy stays at zero for 4 midnights, Truffle **dies**. You get a gravestone and a new spore.
7. If you beat your own 7-day step average, Truffle gets **affectionate**.
8. If it is dangerously hot where you are, Truffle **burrows**. Burrowed days do not count toward death and do not grow it.

## The energy engine (exact rules, v1)

All numbers are constants in one config file. Tune them with a decision record.

### State

| Field | Meaning |
|---|---|
| `energy` | Current energy points, integer, 0..`energy_max` |
| `lifetime_steps` | Steps that counted toward growth (excludes burrow days) |
| `stage` | Derived from `lifetime_steps` |
| `zero_days` | Consecutive midnights ended with `energy == 0` |
| `affection` | 0..5 |
| `age_days` | Midnights survived |
| `steps_today` | Steps received since local midnight |
| `avg7` | Mean of the last 7 completed days' steps (0 if fewer than 1 day) |
| `burrowed` | True when today's weather is dangerous (see below) |
| `dead` | True after death until a new spore is started |

### Stages (from `lifetime_steps`)

| Stage | lifetime_steps | energy_max | daily burn | ASCII |
|---|---|---|---|---|
| Spore | 0 - 4,999 | 6,000 | 1,500 | a dot under the sand |
| Sprout | 5,000 - 29,999 | 12,000 | 3,000 | small bump, one leaf |
| Truffle | 30,000 - 99,999 | 20,000 | 5,000 | round truffle, face |
| Elder | 100,000+ | 30,000 | 7,000 | big truffle, cracks, a flower |

"The bigger it grows the more it eats" is the burn column.

### Feeding

- `/feed` carries `steps_today_total` (absolute total since local midnight, not a delta). Engine computes `delta = max(0, total - steps_today)`.
- `energy = min(energy_max, energy + delta)`. Overflow is lost.
- `steps_today = total`.
- If not `burrowed`: `lifetime_steps += delta`. Stage is re-derived (growth happens the moment the threshold is crossed).
- If `burrowed`: `lifetime_steps` unchanged (fed, not grown).
- Feeding never changes `zero_days` directly. Only midnight does.

### Effort tiers (from `ratio = energy / energy_max`)

| Tier | ratio | Model call | Thinking | Max output | Memory window | Cost per reply |
|---|---|---|---|---|---|---|
| asleep | energy == 0 | **none** (canned sleepy lines) | no | 1 line | none | 0 |
| low | 0 < ratio < 0.25 | yes | off | 120 tokens | today only | 20 |
| medium | 0.25 <= ratio < 0.60 | yes | off | 400 tokens | 7 days | 60 |
| high | ratio >= 0.60 | yes | **on** | 1,200 tokens | everything | 200 |

- The user may ask for more effort. The engine **caps** at the tier the energy allows. No exception, no "please".
- If `energy < cost` of the allowed tier, drop one tier. If `energy < 20`, treat as asleep for that message.
- Cost is deducted **after** the reply is produced. One reply = one deduction.
- Tier is computed per message from current energy, so a long chat slides down as energy drains. Truffle should notice and say so (fine-tune behaviour).

### Midnight tick (Durable Object alarm at the user's local midnight)

Order matters:

1. Close the day: push `steps_today` into the 7-day history, recompute `avg7`.
2. Affection: if `steps_today >= 500` and `steps_today > avg7_before_today * 1.10` then `affection = min(5, affection + 1)` else `affection = max(0, affection - 1)`. (First day: `avg7_before_today` is 0, so any day >= 500 steps earns +1.)
3. Burn: if `burrowed` was true for that day, **skip** the burn. Else `energy = max(0, energy - burn)`.
4. Zero days: if `burrowed`, `zero_days` unchanged. Else if `energy == 0` then `zero_days += 1` else `zero_days = 0`.
5. Death: if `zero_days >= 4` then `dead = true` (see Death).
6. `age_days += 1`, `steps_today = 0`, re-evaluate `burrowed` for the new day from the weather forecast.

### Wilting

| zero_days | Status word | What the user sees |
|---|---|---|
| 0 | fine | normal |
| 1 | tired | droopy, slower text reveal |
| 2 - 3 | wilting | greyed, leaf curls, Truffle says less even at the same tier |
| 4 | dead | gravestone |

### Death

- On death the engine writes a **gravestone**: `age_days`, `lifetime_steps`, stage reached, and one favourite memory (the memory with the highest affection at write time, or the last one).
- The world shows the gravestone until the user taps "plant a new spore".
- New spore: all state reset to a fresh Spore. Gravestones are kept in a list (max 20) and shown as a small row of stones in the sand.
- Death is never caused by a burrowed day. That is the point of the burrow rule.

### Burrow (weather)

- Each midnight (and at pairing) the Worker fetches Open-Meteo for the user's coordinates: hourly `apparent_temperature` for the coming day.
- `burrowed = max(apparent_temperature over 06:00 - 22:00 local) >= 42` (Celsius). Constant `BURROW_APPARENT_C = 42`, tunable.
- Burrowed day: Truffle is underground in the ASCII world. It still talks (tier rules unchanged), it can still be fed, it does not grow, it cannot die that day.
- Truffle should say why it burrowed, in its voice, and suggest an evening or indoor walk (fine-tune behaviour).
- Coordinates: from the feeder app (precise) or from `request.cf.latitude/longitude` (city level) as fallback. We never store a location history, only the current city-level point.

### Affection and mood

Mood is derived, not stored, in this priority:

`dead > burrowed > wilting (zero_days >= 2) > tired (zero_days == 1) > asleep (energy == 0) > affectionate (affection >= 3) > content`

Mood feeds the ASCII world (eyes, posture, sky tint) and the state block the model reads.

## The state block (what the model sees)

Every model call gets a system prompt that includes one compact line the fine-tune is trained to read:

```
[truffle stage=Sprout energy=63% tier=high mood=affectionate zero_days=0 burrowed=no weather="34C clear, Muscat" lang=ar steps_today=6120 avg7=4800 age_days=3]
```

The fine-tune teaches Truffle to behave like this block says, in its own voice. The engine, not the model, decided the values.

## Memory

- Memory = short facts Truffle keeps about you ("name is Ahmed", "likes wadis", "mom was sick on day 2"). Stored in the Durable Object, max 60 facts, oldest dropped.
- Fact extraction runs after each high or medium tier reply (a cheap second call to the fallback model with a fixed extraction prompt, or the same reply if structured output works).
- Memory window per tier decides which facts are included in the prompt (by day written).
- Memory is wiped on death, except the one favourite memory that goes on the gravestone.

## Language

- Default language from `request.cf.country`: Arabic for AE, SA, OM, QA, KW, BH, JO, EG, IQ, LB, SY, YE, PS, LY, TN, DZ, MA, SD, MR, SO, DJ, KM. English elsewhere. User can toggle. Truffle replies in the user's language and can code-switch if the user does.

## The ASCII world

- A `<pre>` grid, mobile-first (portrait, ~40 columns), 10 - 12 fps, no WebGL.
- Layers: sky (tinted by local time of day, from the user's timezone), drifting clouds, sun or moon, horizon, grass or sand depending on `burrowed` and country (Oman and Gulf: sand and a few grass tufts; elsewhere: grass), Truffle itself, a small HUD line (energy bar, stage, steps today).
- Rain falls only when Open-Meteo says precipitation now. Wind speed nudges cloud drift.
- Reduced motion: respect `prefers-reduced-motion` (stop drift, keep state).
- Chat is a single input line under the world. Replies type out at a speed that depends on tier (low = slow, high = quick). Asleep = one grey line, no input focus.
- While the Modal brain is cold, Truffle "yawns" (ASCII stretch animation) and the reply comes from the Workers AI fallback with a small "half-awake" marker. Honest, never hidden.

## Judge mode

- `/demo` spawns a fresh demo Truffle per visitor (no pairing needed).
- Controls: a **steps slider** (0 - 15,000 for today), a **time-travel** button (advance one midnight), a **heat toggle** (force a burrowed day), and **reset**.
- Everything else is the real engine and the real brain. Judges can grow a Truffle from spore to Truffle stage and kill it in 60 seconds.
- Demo Truffles are deleted after 24h.

## Pairing (no accounts)

- The web app creates a Truffle id and shows it as a 3-word phrase (e.g. `sand-moon-fig`). It is stored in the browser.
- The feeder app takes the same phrase. All `/feed` calls carry it.
- Phrase space is 2,000^3 = 8e9. Fine for a hackathon. Rate-limit `/feed` per phrase.

## Out of scope for Week 1

- iOS. Accounts. Push notifications. Multiplayer. Store listing. Quest system is a Saturday stretch only (see architecture doc for the design so it is ready if time allows).

## Safety rails

- Truffle never shames. Low energy is sleepy and funny, never cruel. No weight, calories or body talk. The fine-tune data must not contain any of that.
- Heat days are protected. The app must never encourage going out when `burrowed` is true; it suggests evening or indoor walking instead.
- Steps from any source count (mall, gym, home). We do not try to detect "real" outdoor walking.
