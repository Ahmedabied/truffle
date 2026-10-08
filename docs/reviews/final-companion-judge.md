# Independent companion review

Reviewed 2026-10-09 (Asia/Muscat), against the local working tree served at `http://localhost:5191`. I inspected the rendered product before reading any pitch or previous review. This is a focused usability/art pass, not a claim of complete device or production validation.

**Verdict:** the requested world-first companion is recognizable and usable. I found no blocking interaction defect in the tested flows. Art **7/10**, UI **8/10**, UX **7/10**. It has a coherent nostalgic ASCII identity; the remaining weakness is how quietly it communicates its most interesting details and available actions.

## Actual conditions

- Isolated headless Chrome (`/usr/bin/google-chrome`) controlled with the project's Playwright package. Fresh contexts, locale `en-US`, CSS pixel scale 1. Requests outside localhost blocked. No production service or phone interaction.
- Phone: 412×915, fresh `/demo?mock=1&hour=22`, `/demo?mock=1&scene=content&hour=12`, and `/demo?mock=1&scene=burrowed&temp=44&hour=12`.
- Also rendered Spore, Sprout, Elder, and affectionate samples at 412×915; Arabic at 320×700; Arabic and English landscape at 915×412; English desktop at 1440×1000.
- Browser errors were collected during the main phone and interaction passes; none were observed.
- Screenshots are local mock states, not proof of native sensor operation or live model quality.

## Visual judgment

**Art — 7/10.** The layered terrain, scattered grasses, trees, sun, stars, and deliberate ASCII texture give the world a specific personality. The day palette is cohesive, and the night Spore is a complete cap-and-stem mushroom with closed eyes: the previous “sleeping ball” problem is absent in this sample. Spore, Sprout, Truffle, and Elder are all recognizably mushrooms, with a readable increase in scale. Affection adds visible floating hearts. The face is readable at 412px, but still small and emotionally restrained. Daytime terrain and gifts are faint enough that a viewer can miss detail rather than feel invited to explore it. I would strengthen selected foreground edges and gift contrast while retaining quiet distant terrain.

Heat is an intentional sheltered state: only a cap peeks above the ground. Its home copy explicitly says that Truffle stays sheltered from the heat, so it reads as explained behavior rather than a missing creature. I do not count that pose as a failure of the sleep requirement.

**UI — 8/10.** Portrait home is clear: 60px header, an edge-to-edge 549px world (60% of a 915px screen), a thin status strip, then conversation. Secondary actions are collected in Pocket. The cream surface, serif voice, and green action color are consistent. Pocket's accordion grouping is legible and its return button is explicit. Arabic at 320px fits without horizontal overflow and retains usable input and send controls. Desktop's centered 740px column is comfortable.

**UX — 7/10.** The core interactions work. The main opportunity is gift discovery: the small placed object is functional but easily mistaken for another piece of ground texture. A fresh offline pet now explicitly points to Pocket to try a walk; I verified that instruction in a clean browser context. The outing prompt is clear and forgiving, and the returned gift's short authored note feels appropriate to a companion.

## Reproduced findings and concrete improvements

1. **Medium — landscape loses immediate access to conversation.** At 915×412, the centered world is 740×360 at `y=72..432`; even the status strip and every conversation control are below the first viewport. There is no horizontal overflow, but the first screen is effectively all world. Add a short-height layout rule that reduces scene height enough to expose the start of conversation, and keep mobile landscape edge-to-edge if that is the intended phone treatment. [Actual viewport screenshot](final-judge/landscape-viewport-915.png).
2. **Medium — the world gift needs more visual distinction.** The new star sits to the left of the mushroom and shares the terrain's restrained brown. Its hit target works, but its discovery depends on careful looking or already knowing where it appeared. A small one-time glint, stronger object ink, or a brief authored hint after return would help without adding permanent controls. [World before tap](final-judge/gift-world-before-412.png).
3. **Low — selected day details are too faint.** Keep the distant atmospheric marks faint, but increase the relative weight of nearby plants, gift edges, and the character's distinguishing expression. The current foreground can look washed out at ordinary phone scale. [Latest day capture](final-judge/content-latest-412.png).

None of these findings is a reproduced data-loss, navigation, or interaction blocker.

## Interaction evidence

| Flow | Result |
| --- | --- |
| Fresh offline first action | Pass on final retest. Home now says “Open Pocket to try a walk, then come back for a chat.” |
| Pocket open/close and settings discovery | Pass. Explicit “Back to world”; language, outings, keepsakes, demo actions, and settings grouped in Pocket. |
| Gift preview | Pass. Opened keepsakes, selected “Preview a return gift,” received **A spare star** with authored ASCII and note. |
| Actual world coordinate tap | Pass. Closed Pocket and used `mouse.click(100, 518)` on the drawn gift at 412×915. Its **A spare star** card appeared in chat; Pocket's unread dot cleared. This was not a list-button click. |
| Outing start | Pass. “Heading out?” → “Taking a walk” → clear companion dialog with “I'm back.” |
| Outing reload once | Pass. Reloading while away displayed “Welcome back. What did you notice? Share it if you like.” A second reload removed that return prompt. |
| Conversation | Pass. Submitted “Hello Truffle. I walked by the sea.” and received the sample response through the chat UI. |
| Arabic 320px | Pass for observed layout. Document width 320px; no sideways overflow. |
| Landscape | Functional; the viewport issue above remains. Document width 915px; no sideways overflow. |
| Desktop | Pass for observed layout. Centered 740px world at 1440×1000; conversation visible below. |

## Performance evidence and limits

A three-second foreground `requestAnimationFrame` sample produced 181 callbacks over 3004ms (**60.25Hz**), no gap over 25ms, and a maximum gap of 16.8ms. The app's actual `?fps=1` draw meter settled at **60fps**, with **0.4ms compose / 0.4ms paint** in the sampled local desktop run. Early meter readings were 65fps during boot and extra draws; I do not report those as sustained display performance.

This supports the 60fps target on this desktop browser. It does not prove 60fps on the Android phone, GPU presentation timing, battery cost, or consistently smooth emotional transitions. I observed distinct poses but did not run a frame-by-frame expression-transition audit. Tier-to-dot mapping was not independently isolated in this pass.

## Screenshot set

- [Night Spore](final-judge/night-412.png), [day Truffle](final-judge/content-latest-412.png), [heat shelter](final-judge/heat-412.png), [Pocket](final-judge/pocket-412.png).
- [Gift in Pocket](final-judge/gift-pocket-412.png), [gift tapped in world](final-judge/gift-world-after-412.png), [outing return](final-judge/outing-return-412.png).
- [Arabic 320px](final-judge/ar-320.png), [landscape viewport](final-judge/landscape-viewport-915.png), [desktop](final-judge/desktop-1440.png).
- [Spore](final-judge/spore-412.png), [Sprout](final-judge/sprout-412.png), [Elder](final-judge/elder-412.png), [affectionate](final-judge/affectionate-412.png).

## Native Walk

The latest fixed-cell native Walk screenshot was not available before this focused pass ended. Native visual and sensor checks remain with the native quality agent. No claim about Android step-counter correctness or nudge scheduling is made by this independent web pass.
