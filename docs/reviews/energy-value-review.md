# Energy value and fairness review

Reviewed 2026-10-09, independently before comparing economy simulations. This is a product judgment grounded in the current engine, configuration, product spec, prompt, and English/Arabic UI copy. No hosted model calls, deployment, or external publication.

## Verdict

Energy can give Truffle a believable rhythm when walking stocks food for later and useful conversation spends some of it. The current daily upkeep dominates that exchange and makes successful growth a larger obligation. Do not invent chores, background “thinking,” or gift-making charges to explain the burn. Truffle is a fictional pet; upkeep is a game rule, not measured biology, calories, GPU electricity, or proof that it worked while the user was away.

## What currently fails

| Observed rule | User consequence |
| --- | --- |
| Energy already carries over: midnight subtracts upkeep rather than resetting the balance. Elder upkeep is 7,000. | Starting empty, an Elder fed 7,000 steps each day dies at its fourth midnight even with no conversation. “I fed you every day” is a justified complaint. |
| A 10,000-step Elder day plus ten automatic replies leaves 2,400 after midnight. | There is some carryover, but the following quiet day empties it. “A little life, at your pace” does not describe that obligation. |
| Growth raises upkeep and enlarges the denominator used for chat tiers. | With 12,000 energy at 99,999 lifetime steps, one more step changes high effort to medium and daily upkeep from 5,000 to 7,000. Growing feels like losing capacity. |
| At full storage, additional steps add lifetime growth but no food. | A long day can increase future obligation without stocking the pantry. Any cap needs an understandable limit; do not encourage more steps after it is full. |
| Automatic tier selects the highest available effort; a high-tier hello costs ten times a low-tier one. | Available food determines spending without asking whether the response needs that work. The current effort selector is in judge mode, so ordinary users do not get the same visible choice. |
| Affection falls unless steps beat the prior average by more than 10%. | Consistent movement and rest can make the pet less affectionate. That incentive undermines the otherwise gentle copy and should not be imported into the new economy. |
| Sleepy replies hash the incoming message into a canned line. | Exhaustion can answer an urgent request with “steps… then talk.” A safe response path must not depend on food or a walking prompt. |

The existing chat cost is real in one limited sense: it admits a model call with different thinking, output limits, and context. It does **not** measure the quality or usefulness of the result. Partial replies currently spend the full tier cost; the UI discloses this, but a few truncated words are not necessarily useful value.

## Three useful reasons to spend energy

1. **A conversation worth having.** Respond to what the person actually says, help them reflect on their day, and ask a relevant follow-up. A short exchange can be valuable; length is not the value metric.
2. **An explanation or small plan the person requests.** Explain something they noticed, help draft a message, or break a chosen task into a few realistic steps. Offer additional thought when it could improve the answer; do not create tasks, research claims, or errands just to consume food. No fabricated browsing, sensing, or activity while absent.
3. **Continuity the person chooses.** With consent, keep a preference or a short agreed note and use it in a later conversation. This is part of the conversation's cost, not a second surprise charge. Remembering must be reviewable and removable; today's automatic fact extraction is not evidence that this consent exists. Basic identity and agreed preferences should not disappear from conversational context merely because energy is low.

These are uses of the existing conversation, not three new product modes. Start with the first two; do not promise new memory controls until implemented.

## What stays free

Authored keepsakes, opening the world, animation, touch reactions, a greeting, reading existing chat/notes, settings, deletion, and basic safety responses must not consume food. Keepsakes already say they are fictional and locally stored; preserve that honesty. No charge for opening the app, leaving it, being absent, missed streaks, or deciding to rest. A failed reply with no visible answer stays free. In an urgent safety situation, a clear response must remain available at zero energy; this does not mean unlimited free general-purpose inference.

## Carryover, upkeep, and rest

Use one understandable food store with a generous capacity and a small, predictable upkeep rule. Walking should create several days of breathing room. Validate a concrete promise before choosing constants: a 10,000-step day followed by ten ordinary replies must leave enough for the next quiet day and another short check-in. Also test a lower-step week, a long rest, growth, and repeated heat days. These are simulation cases, not prescribed exercise targets.

Useful conversation must not silently consume the portion needed to remain safe through tonight. Prefer a simple automatic rest floor or a protected part of the same reserve over an extra wallet. Explain the consequence before a costly optional reply. Do not make growing older require ever more daily walking. A full store should feel “well fed,” without a refill task or extra outdoor pressure.

An empty store should first mean calm rest with free presence. If death remains a deliberate part of the fiction, it needs a separate, clearly disclosed product decision; conversation and an ordinary recovery day should not unexpectedly cause it. Heat shelter must protect upkeep and survival, and must never require compensatory indoor or evening steps. A forecast below the burrow threshold is not a guarantee that walking is safe or appropriate.

## Explain it without making an accounting dashboard

Keep the creature and its world primary. Show one food/energy indicator and a brief plain-language state such as “Well fed,” “A little sleepy,” or “Resting.” In “How energy works,” disclose carryover, upkeep, the cap, and when a reply costs energy. Use exact numbers there when useful, not “a little” for every tier regardless of cost. Before optional extra effort, describe its effect in ordinary language; afterward, show the admitted cost only in details.

Possible copy, contingent on tested rules: “Your steps stock food for later. Truffle uses a little each day and some when you talk. What is left stays for tomorrow.” Rest copy: “A quiet day is fine. I can rest here.” Do not expose model names, token budgets, or thinking toggles as the main explanation of companionship. Do not claim a precise number of days remaining unless its assumptions about chat and weather are stated.

## Evidence and limits

`npm test -- test/engine.test.ts` passed all 13 tests. A local TypeScript transpilation of the actual engine reproduced the four numerical cases above: 7,000/day death, 10,000 plus ten replies, the growth downgrade, and capped overflow. No new implementation tests or source changes were made for this review. The findings establish rule behavior, not whether model answers are consistently useful or how users feel after a week; those remain separate acceptance questions.

## Comparison follow-up

The subsequent executable comparison supersedes this review's initial fixed
reserve-floor preference: a 1,000-point floor makes the first 1,000-step walk
buy no conversation, and still only delays eventual depletion. The final
recommendation is model A's gentle continuous balance without that floor.
Death versus reversible dormancy remains an explicit product decision. See
[the tested comparison](energy-carryover-exploration.md); none of these proposed
economy rules is live.
