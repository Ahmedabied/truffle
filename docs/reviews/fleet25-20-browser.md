# Fleet 25 / 20: browser integration

Date: 2026-10-09. Result: **49 browser cases passed** (41 smoke + 8 v2 integration).

## Execution and scope

Real headless desktop Google Chrome opened `http://localhost:5191` with disposable
Playwright contexts. Every context blocked all origins except the local Vite app
and the synthetic `http://localhost:8787` API. API handlers supplied fabricated
credentials, state, gifts and SSE text. No public backend, paid inference, physical
phone, pet feed or deployment was used. These are application integration results,
not evidence of server alarm execution or physical WebView behavior.

The browser skill was read. Agent 19's after frame-rate sample had an exclusive
browser window: this agent's Chrome was closed before that sample and browser
work resumed only after its completion signal. Native fragment/event authority
and delayed poll/chat races are independently covered by agent 21 in
`web/test/identity.browser.mjs`; they are not counted in the 49 cases below.

```sh
CHROME_BIN=/usr/bin/google-chrome node web/test/browser.smoke.mjs
CHROME_BIN=/usr/bin/google-chrome node web/test/companion-v2.browser.mjs
npm --prefix web run typecheck
git diff --check -- web/test/browser.smoke.mjs web/test/companion-v2.browser.mjs
```

All commands passed. The existing smoke baseline was 33/40 before this work.
The standalone v2 suite remains directly runnable without a Worker or model.

## Real defect fixed

`main.ts` previously bound companion transport whenever the client exposed a
`companion` method. A generation-bearing older API can omit the additive
`summary.companion` capability and return 404 for `/companion`. The automatic
return request then treated this unsupported endpoint as lost pet credentials,
so a later native Retry could abandon the real transport for the unavailable
health fallback. This reproduced in the old native outage case.

With root's explicit source ownership approval, the only production edit by
this agent requires `s.companion !== undefined` before wiring companion requests.
The dedicated legacy regression checks zero companion calls, retained verified
identity, no re-pairing, enabled chat and successful native Retry while health
is unavailable. The normal v2 fixture now explicitly supplies both the capability
and the endpoint, so the normal outage test still exercises real companion calls.
Root and other reviewers retain ownership of all other production edits.

## Expectations updated to the approved v2 behavior

- Arabic world descriptions name food points.
- A brief pause freezes the canvas and sends no chat, without inventing a return.
- Gift previews are labelled, do not enter earned counts, disappear on reload,
  and can be previewed again. Reset preserves earned device gifts as an archive.
- Outing buttons use inline companion notes, with no modal or invented groceries.
  Heat keeps the note sheltered. A quick reload does not invent an absence;
  an actual elapsed absence produces one welcome after a fresh state read.
- Sample conversation details disclose no model call and a simulated 60-point
  everyday cost. They no longer assert the obsolete automatic 200-point cost.

## V2 evidence and limitations

The suite observes actual fetch bodies and owner secrets on intercepted routes.
It verifies current-life gift filtering, archive provenance, owner changes,
exactly one chat under duplicate submit, one authenticated away request, and no
pending promise before the scheduling receipt. Normal plan and return chat have
one verbal reply; quiet notes persist while normal chat remains available.
English and Arabic plans are exercised, along with uncertain speech.

Food tests separately check stored food, the qualified reserve estimate,
before-send price ceiling, short-hello low effort, everyday medium effort,
explicit high effort, 20/60/200 actual-response details, and Arabic text. Costs
are supplied by the synthetic server; Worker accounting correctness belongs to
its engine/DO tests.

The already-gifted-day scenario tests the intended successful idempotent server
response: pending stays null, the existing gift remains the only gift, and no
failure note appears. Root owns the matching Worker daily-cap contract and its
server tests. The browser fixture does not establish real server enforcement.

## Complete final case list

### Existing smoke suite: 41/41

- PASS — pending slider cannot undo Reset
- PASS — pending slider cannot feed the next day
- PASS — rapid slider changes commit only the last value
- PASS — chat canceled before first token stays cleared
- PASS — chat canceled after first token stays cleared
- PASS — heat, steps, and progress persist through reload
- PASS — seen moments do not replay on reload
- PASS — demo and main simulation retain separate pet progress
- PASS — 320px English/Arabic layout and maximum text size do not overflow
- PASS — reduced motion freezes actual canvas pixels
- PASS — demo share card includes provenance and downloads a PNG
- PASS — system reduced motion disables the conflicting app toggle
- PASS — Reset clears a canceled chat cooldown
- PASS — chat recovers after a temporary server error
- PASS — 401 chat opens settings without replacing the saved pet
- PASS — invalid API address is rejected without navigating
- PASS — temporary boot failure exposes a working Retry action
- PASS — background refresh failure marks stale state and Retry recovers
- PASS — an offline return preserves its keepsake through heartbeat and recovery
- PASS — 404 on real-pet startup preserves saved identity and does not pair
- PASS — declined fresh import stays unpaired through reload
- PASS — native declined import never displays the other saved pet
- PASS — failed import preserves saved identity and Retry retains the stripped candidate
- PASS — accepted verified import survives reload without another pairing
- PASS — malformed import cannot create a replacement pet
- PASS — offline import cannot substitute a sample and Retry reconnects
- PASS — native World without an owner directs setup to Feed without pairing
- PASS — native Retry after a later outage keeps the real backend
- PASS — a generation-bearing legacy API without companion capability retains native identity and Retry
- PASS — explicit Forget clears an unfinished browser import
- PASS — Arabic world description follows the UI language
- PASS — pause ritual freezes the world and returns without sending a message
- PASS — heat pause invites comfort indoors without asking for a walk
- PASS — invalid saved language and scale do not prevent startup
- PASS — gift previews are temporary, labelled, and never enter the earned count
- PASS — an elapsed absence creates one local gift on a rest day
- PASS — heading out is a warm local interaction, and heat keeps the invitation indoors
- PASS — mobile world fills the width and chat follows it with secondary controls in Pocket
- PASS — outing survives a quick reload without claiming an absence, then welcomes once after time away
- PASS — world gift and its keyboard alternative open the same keepsake in chat
- PASS — normal chat uses plain food feedback while Pocket discloses simulated effort and cost

### New v2 integration suite: 8/8

- PASS — server gifts use authenticated owner and current generation; device gifts remain labelled archive
- PASS — a fresh life clears open server gifts and never promotes an old life response
- PASS — verified owner change scopes server gifts and device archives to the new pet
- PASS — natural chat sends exactly once and schedules one owned job only after its server receipt
- PASS — uncertain speech never schedules work; quiet preference cancels and persists across reload
- PASS — failed gift scheduling makes no pending or earned-gift claim and preserves normal chat
- PASS — an already-gifted day acknowledges another away quietly without a new job or gift
- PASS — food reserve, reply ceiling, greeting price and explicit deep effort are distinct
