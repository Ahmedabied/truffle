# Fleet 25 / 02: companion event and state contract

Date: 2026-10-09. Review only. No application source changed, no deploy, no phone access.

## Recommendation

Add a small pure companion reducer beside the existing energy engine. It owns short visual reactions, a user-declared outing, and a return note. It never owns energy, pet identity, authoritative mood, steps, model admission, or notification scheduling. Preserve the full existing ASCII mushroom and its world.

Use two truthful activity signals. A newer server total means accepted steps arrived. A fresh, validated native counter delta means this phone recently observed movement. Only the latter supports an immediate walking reaction before hourly feeding. Neither signal proves that the person is outdoors, where they are, whether an errand occurred, or their activity's purpose.

A chat message remains one ordinary request with the existing energy rules. Recognizing an outing adds a visual reaction and small local context. It does not send a second chat, add an energy charge, create a pet, navigate away, open a modal, enable reminders, or credit steps.

## What is already present

| Existing path | Evidence and implication |
| --- | --- |
| Native counting | `StepCounterService.onSensorChanged` validates the hardware reading and derives an event-time timestamp, then calls `NativeWalkStore.observe`. `SensorAccumulator.observe` handles baselines, reboot, reset, ordering, zones and ambiguous midnight gaps. Derive a reaction from the accepted before/after result, never directly from the raw counter. |
| Upload timing | `FeedWorker` schedules hourly work. `main.ts` polls state every 30 seconds. Polling alone cannot make a prompt reaction to actual movement before the next feed. |
| Server mood | `engine.ts:moodOf` returns dead, burrowed, wilting, tired, asleep, affectionate or content. Affection is established by the existing engine rules. It is not a recent-walking indicator. Keep it authoritative. |
| Expression | `World.set` transitions expressions. `pet.ts` already draws an affectionate smile and small hops. `Scene.compose` currently derives the face only from server mood and yawn. Add a presentation input, preserving geometry, glyph rendering, caching and reduced motion. |
| Outings | `main.ts` has two manual buttons and saves `{ version: 1, kind, at }`. `resumeOuting` consumes that value on any visible render. Adding chat plans to this path unchanged would welcome the person back on the next poll before they had left. |
| Chat | `Chat.send` owns admission, generation cancellation, streaming and one completed response. `ChatDeps` has no submitted-message callback. Add one small callback at the accepted-send boundary. |
| Return gifts | `keepsakes.ts` already uses a ten-minute absence, one gift per local day, a twelve-item shelf and an API/pet/demo scope. Keep gifts independent of steps, declared outings and reactions. |
| Identity | Native World sends credentials only in the existing one-time URL fragment. Web verifies the import before showing the scene. No new identity flow or automatic pairing belongs in this work. |
| Reminders | `ReminderPolicy` is opt-in, daytime-only, at least 24 hours apart, and suppresses heat, uncertainty, sufficient feeding, recent activity and missing permissions. Do not make outing or return events a second notification stream. |
| Useful fed chat | `prompt.ts` already says accepted steps refill energy, requested low effort does not mean hunger, and the model should answer the actual request without unsolicited walking suggestions. Keep the canonical state block and all energy goldens unchanged. |

## Pure modules and ownership

- `web/src/companion/intent.ts`: `classifyIntent(text)` and EN/AR fixtures. No DOM, model calls, clocks or storage.
- `web/src/companion/state.ts`: `reduceCompanion(state, event, context)` and snapshot comparison. Explicit time arguments; no timers or storage inside the reducer.
- `web/src/companion/copy.ts`: short EN/AR authored manual and return notes, selected from explicit facts. No secrets or names inferred from pairing phrases.
- `web/src/companion/controller.ts`: storage validation, one expiry timer, wiring and side effects. It may call injected `setReaction`, `showNote` and `requestState` functions. It does not obtain credentials or pair pets.
- Optional native `RecentMovement.kt`: pure derivation of recent movement from accepted accumulator transitions. Keep it separate from accounting.

Keep `main.ts` as a small integration surface owned by one integrator. Needed hooks are: initialize after verified state, pass fresh state snapshots, forward accepted chat submissions, forward visibility changes, and reset on existing identity/life reset paths. The manual buttons call the same reducer. Other agents can implement and test the pure modules without sharing `main.ts` ownership.

## State and event contract

The following is a proposed interface, not new Worker state:

```ts
type OutingKind = "walk" | "errand";
type Intent =
  | { type: "plan"; kind: OutingKind }
  | { type: "back"; kind?: OutingKind }
  | { type: "cancel" }
  | { type: "quiet" }
  | { type: "none" };

type CompanionState = {
  version: 1;
  // API origin + verified pet + real/demo + local life epoch.
  // An internal storage scope, never sent to a model or native event.
  scope: string;
  quietNotes: boolean;
  cursor?: { day: string; acceptedTotal: number; lifetimeTotal: number };
  outing?: {
    kind: OutingKind;
    declaredAt: number;
    expiresAt: number;
    leftAt?: number;
    source: "button" | "chat";
  };
  hiddenAt?: number;
  pendingReturn?: { cameBackAt: number; awayMs: number };
  reaction?: { kind: "happy" | "anticipating"; until: number };
};

type Event =
  | { type: "snapshot"; summary: StateSummary; at: number; fresh: boolean }
  | { type: "intent"; intent: Intent; source: "button" | "chat"; at: number }
  | { type: "movement"; eventId: string; delta: number; observedAt: number;
      intervalMs: number; at: number }
  | { type: "hidden"; at: number }
  | { type: "visible"; at: number }
  | { type: "tick"; at: number }
  | { type: "reset"; scope: string; at: number };
```

Context supplied by the controller includes current verified scope, import/auth readiness, whether this is a labelled demo, visibility, authoritative alive/burrowed state, and whether a reply is currently being shown. Reject events before this context is ready. Effects returned by the reducer are declarative: set/clear reaction, show one note, persist validated state, request a state refresh. Effects never include a feed, chat request, credential change or notification.

Persist only preferences, the accepted-step watermark, declared outing and last genuine hidden/visit time. Do not persist a transient reaction, its event queue, or raw chat. Drop expired or future-dated outing timestamps on hydration. Validate finite integer totals and bounded timestamps. Scope persisted data with the existing collection boundary; never use one global outing key across pets or APIs.

The existing Worker summary does not expose its generation counter. Increment the local life epoch on the existing spore/reset actions and clear the controller on identity changes. When another client changes this life, lifetime-step regression or a changed grave boundary invalidates transient state and establishes a baseline. Do not mistake a stale, smaller same-day response for a new life: retain the watermark and wait for a newer fresh response. A server generation identifier would be stronger if the API later exposes one, but it is not required for this small UI change and must not be invented client-side as authoritative identity.

## Transition rules

| Event | State transition | Visible result |
| --- | --- | --- |
| First verified snapshot or hydration | Establish a watermark. Never celebrate all existing steps as new. | Existing world state. A separately eligible return may be resolved. |
| Fresh newer same-day snapshot | Set watermark to the maximum accepted total. If both snapshots belong to the same verified scope and life, `delta = max(0, next - previous)`. | A short happy reaction for `delta > 0`. Optional caption says only that steps arrived, never that a walk just happened. No announcement for every poll. |
| Duplicate or smaller same-day snapshot | Do not lower the watermark. | No reaction. |
| A later local day | Establish the new day's total without subtracting yesterday. | No invented overnight walk. Return note can still resolve from absence. |
| Invalid day, clock rollback, failed refresh, auth loss, unresolved import | Preserve pending return when safe; do not manufacture a signal. Auth/import loss clears visible reactions. | Existing recovery behavior. No replacement world. |
| Valid recent native movement | Accept only once per event ID and only in the verified embedded-document scope described below. | A nonverbal happy reaction. It changes no HUD number and makes no feeding claim. |
| Explicit present/near-future plan | Replace any earlier plan. Save kind, current time and expiry six hours later. Clear pending return. | An anticipating reaction for six seconds. Button action uses authored copy; chat leaves text to the one normal response. |
| Hidden while an outing exists | Set `leftAt` once. Record hidden time. | No background animation or message. |
| Visible after at least 30 seconds hidden | Set pending return and request one fresh state. Do not complete the outing yet. | No premature greeting while identity/alive state is unresolved. |
| Fresh living snapshot resolves pending return | Consume the matching outing once, clear its saved value, then resolve independent keepsake eligibility. A generic no-outing welcome needs at least the existing ten-minute absence. | At most one soft return note. Do not overwrite streamed or typed chat; show below it or defer until idle. |
| Explicit “I'm back” | Consume an active, unexpired outing immediately. This is the person's report, not an inference from steps. | Brief warmth in the normal chat response and a short happy reaction. Do not add a duplicate authored chat reply. |
| Cancel / “not going after all” | Clear outing and anticipation immediately. | No disappointment, penalty, prompt to reschedule or follow-up notification. |
| Quiet | Persist `quietNotes=true`, clear automatic outing context and proactive return notes. | One calm acknowledgement. Manual actions and ordinary chat remain available. No claim that Android notifications were disabled. |
| Expiry / long absence | Drop the plan silently after six hours, including across restart. | At most a generic welcome on a later eligible return. No “you never went” or overdue state. |
| Dead / life reset / owner or API switch / real-demo switch | Clear outing, return pending state, timer and reaction. | Existing authoritative dead/new-life/identity behavior wins. |

Coalesce repeated movement or accepted-step signals. Use a six-second reaction, a ten-second minimum gap between new pulses, and a maximum twelve-second continuous reaction. A suppressed duplicate still advances its input watermark. A later accepted feed after native movement may update the HUD but does not need a second pulse inside the gap. These are presentation constants, not steps targets. Nothing queues up while hidden.

One wall-clock expiry timer drives reactions even with reduced motion. Return/reaction expiry must not rely on `World.seconds`, which freezes when the world is paused or reduced. On resume, expire old reactions before painting; do not replay them.

## Renderer contract

Add a presentation input such as `View.reaction: "happy" | "anticipating" | null` and resolve its geometry separately from `View.mood`. Keep the server mood available to HUD, accessibility details, palette and energy behavior. Do not replace `summary.mood` with affectionate and do not write affection to the Worker.

Reuse the existing affectionate eyes/smile and gentle posture for an awake mushroom. Both cues can initially share that geometry. Dead and burrowed shapes always win. An asleep mushroom may have a small sleepy smile while retaining closed eyes and its sleeping pose; native movement must not falsely imply that unsynced steps bought a model reply. This can be a small `PetOpts.joy` presentation weight without expanding Worker `Mood`. Tired/wilting body state stays intact while the smile changes. Yawning and closed eyelids keep their existing meaning.

Reduced motion changes the static facial expression for the same bounded interval without a hop, sway or confetti. No sound, full-screen flash, replacement mascot, toast cascade or constantly repeating ARIA announcement. Reaction labels are optional; canonical mood and actual energy remain readable in details.

## Optional immediate native signal

A server-only implementation is sufficient for “happy when accepted steps arrive,” but not for immediate movement response because uploads are hourly. If immediate in-app response is in scope, add one narrow, native-to-page event. Do not add `addJavascriptInterface`, a credential getter, native pairing method, or an identity handshake.

1. Compare the accumulator snapshot before and after `observe`. A signal exists only when the accepted same-zone, same-boot, same-day total increases. Baseline-only, reset, reboot, stale, midnight-ambiguous, invalid and zero-delta samples do not signal.
2. Require the event to be recent, for example observed no more than 15 seconds ago, and require the accepted interval to be at most 30 seconds. Accumulate at least three accepted steps over the bounded 30-second window before emitting. This is a conservative visual cue, not a claim of precise physical activity. Expire samples; do not relabel a long batched gap as current walking.
3. Emit only while direct counting is still enabled/permitted, bound to native's current owner, MainActivity is resumed and World is the visible native tab. No event on returning from background for an old delta.
4. WorldScreen sends a one-way DOM CustomEvent with a version, event ID, positive delta, interval length and observation time. JSON-encode the payload. No phrase, secret, raw since-boot count, location, path, model instruction or energy value is included. IDs need only be unique within the current document/session.
5. Gate injection against the exact allowed loaded web origin and captured native owner/document generation. Drop pending callbacks on pause, navigation, reload, owner/API change or WebView replacement. Do not broadcast to external pages or `/demo`.
6. In web, capture an in-memory native-import scope only after the current document's existing fragment import was successfully verified. Accept events only when that scope still equals the currently verified collection, with no pending import, recovery or auth loss. Reject unknown event versions, bad numbers and replayed IDs. A normal Chrome tab or a document that merely loads saved credentials has no native-import scope and ignores this event. A native fresh reload may establish it through the existing import flow.

The foreground event is presentation-only. The current feed route, source fence, permissions, native journal and one-source accounting remain the sole feeding paths. Health Connect receives the accepted-server-step reaction; it does not pretend to provide the immediate hardware signal. Unsupported/paused tracking remains a normal usable companion.

## Intent recognition and copy

Implement a conservative deterministic classifier. Normalize case, whitespace, English apostrophes and common Arabic letter/diacritic variations for matching, while leaving the original message untouched for chat. Bound the scan to the accepted input length. Detect an explicit first-person action and an outing object in the same clause. Missing or ambiguous intent returns `none`. The classifier must not decide facts or energy rules, and its output must never be accepted from model-generated text.

Reject negated, past, quoted/reported, conditional, tentative and third-person plans. A cancellation of the person's existing plan is distinct from merely mentioning a negative sentence. Do not let the word “walk” inside “walk me through this code” or “grocery list” create an outing. Do not require English-only keywords for Arabic. Use authored positive patterns plus rejection cases, not a broad substring test.

| Submitted text | Expected local intent |
| --- | --- |
| “I'm going for a walk”; “Heading out for groceries”; “I'm off to the shop” | `plan(walk)` / `plan(errand)` |
| “أنا طالع أمشي”; “بروح البقالة”; “رايح أقضي أغراض” | `plan(walk)` / `plan(errand)` |
| “I'm walking to the store now” | `plan(errand)`; self-reported purpose, no extra step credit |
| “I am not going for a walk”; “I'm not going to the shops”; “ما بطلع أمشي”; “ماني رايح البقالة” | `cancel` only for an existing relevant plan; otherwise `none` |
| “I walked yesterday”; “I went for groceries”; “رحت البقالة أمس”; “كنت أمشي” | `none` |
| “Maybe I'll walk”; “If I go for groceries”; “Should I walk?”; “يمكن أطلع”; “لو رحت البقالة”; “أفكر أمشي” | `none` |
| “She is going for a walk”; “My friend said 'I'm going shopping'”; “هو رايح البقالة” | `none` |
| “Walk me through this”; “Help me make a grocery list”; “اشرح لي خطوة خطوة” | `none`; answer the actual request |
| “I'm back”; “Back from groceries”; “رجعت”; “رجعت من البقالة” | `back`, with kind only when explicit |
| “Not back yet”; “If I come back”; “لسه ما رجعت”; “لو رجعت” | `none` |
| “Changed my mind, staying in”; “بطلت، بجلس في البيت” | `cancel` |
| “Please stop reminding me”; “No more outing prompts”; “لا تذكرني بالمشي”; “ما أبي تذكير” | `quiet` |
| “I don't want a reminder, but I'm going shopping” | `quiet` wins; no automatic plan |

Priorities: clear quiet request, explicit cancellation, explicit return, affirmative plan, none. With conflicting clauses, choose none unless quiet/cancel is unambiguous. An explicit manual outing button remains available for unsupported wording. False negatives leave normal model chat intact, while false positives manufacture plans and must be avoided.

For automatic chat anticipation, invoke `onSubmitted(message)` only after `Chat.send` has accepted its normal guards and captured its generation. Do not bind a second raw form-submit handler that fires while blocked. Network failure does not negate what the person said, but cancellation/reset of the conversation must invalidate old callback effects. Never inspect streamed reply text as if it were a user intention.

Authored copy examples:

- Walk button: “A little pocket adventure. I'm with you. Take your time.” / “مغامرة صغيرة في الجيب. أنا معك، خذ راحتك.”
- Errand button: “Groceries count as an adventure in my book. I'll keep you company.” / “حتى البقالة مغامرة عندي. أنا رفيقك الصغير.”
- Contextual return after a declared errand: “Welcome back. You mentioned groceries. I'm here if you feel like telling me about your day.” / “هلا برجعتك. قلت لي عندك مشوار. أنا هنا إذا ودك تسولف عن يومك.”
- Generic return: “Hello again. I saved a little quiet for you.” / “هلا فيك من جديد. خليت لك شوية هدوء.”
- Heat: use the existing heat/rest note. Do not promote an indoor/evening walk as a safety substitute or promise a route is safe.
- Quiet acknowledgement: “Of course. I'll keep these in-app notes quiet.” / “أكيد. بخلي ملاحظاتي هنا هادية.” Link or point to Walk for the separate phone reminder switch if relevant. Do not say phone reminders are off unless native settings actually changed.

Personalize from explicit, available context such as the declared kind, prior shared conversation and authored gift. Do not infer a human name from the pairing phrase, location, account or device. The Worker can use an explicitly shared name already available in its allowed memory window. This review does not add a profile/name collection step.

## Useful chat and gentle reminders

Keep the existing useful-answer prompt lines. Add only a short behavior clarification if needed: when the person explicitly says they are heading for an outing, respond warmly and briefly to that stated plan; do not invent a destination or observed activity; accept cancellation/rest without pressure; when they return, welcome them without demanding a report. Do not append outing encouragement to unrelated requests, repeat a hunger statement after feeding, or turn every exchange into a walking task.

No new Worker event fields are required for this first change. The current user message and existing recent turns already carry declared plans and return reports. Keep the canonical header/state/language trio byte-compatible and memory notes untrusted. If future cross-device return context is requested, add a separate reviewed server feature; local UI state must not masquerade as a verified server fact.

Retain the existing opt-in reminder policy and its single stream. An outing is not consent to notifications. An ignored reminder creates no debt, retry or escalation. On a quiet request, the local UI must be honest about the distinction between its notes and the native notification switch.

One existing implementation detail deserves a focused follow-up: `CompanionReminderWorker` uses `store.state().baseline.recordedAt` as `lastMove`. Zero-delta observations also advance that baseline, so it is not necessarily the time of positive movement. If this area changes, store a separate `lastMovementAt` only after a positive accepted accumulator delta. Keep `store.lastActive` for genuine foreground interaction. This affects reminder suppression only; never reuse it to credit steps. Conservative over-suppression is preferable to extra nudges.

## Focused acceptance cases

1. Pure snapshot tests: hydration with 4,000 existing steps produces no reaction; same-scope 4,000 to 4,015 produces one; duplicate and lower reads produce none; newer-day zero does not underflow; midnight's first 10 does not become a 4,000-step “walk.”
2. Scope tests: API change, real/demo switch, rejected native import, unresolved hash import, auth loss, spore/reset and remote-life evidence leave no reaction/outing from the previous scope. Nothing calls pair/spawn on failure.
3. Reducer tests: chat plan survives same-page renders/polls; plan plus hidden/visible resolves only after fresh living state; failed refresh retains eligible pending return; consumed plan never greets twice; six-hour plan expiry is silent; rollback cannot resurrect a plan.
4. Intent table above plus mixed-clause adversarial examples in both languages. Confirm ordinary requests still go through normal chat exactly once.
5. Fake-timer tests: reaction expires under reduced motion and while hidden, pauses do not replay it, rapid deltas coalesce and neither death nor heat is visually overridden.
6. Keepsake tests: ten-minute rest without steps still yields its existing eligible gift; a five-second outing does not earn an extra gift; one local day still has at most one gift; failed state refresh does not consume absence.
7. Native pure tests, if immediate signal is implemented: accepted positive bounded interval qualifies; duplicate/out-of-order/reset/reboot/zone/midnight/baseline-only/zero/old batch does not; stopped tracking emits nothing. No accepted delta is added twice to feed accounting.
8. Browser fixture: same pet, 15 accepted steps, gentle reaction and unchanged canonical energy/mood semantics; plan submitted through chat, no modal; hide/return, one context-aware note; quiet, no subsequent automatic notes; RTL and reduced motion remain usable. Test rejection of synthetic invalid native payloads and native events before import verification.
9. Reminder policy regression tests retain all current suppression cases. If `lastMovementAt` is added, stationary zero deltas do not refresh it, positive ones do, and permission revocation still suppresses.
10. Worker prompt assertions retain the canonical trio and useful-answer guidance. Canned prompt fixtures can check that instructions exist; they cannot establish generated-model adherence. A generated answer evaluation remains separate evidence.

Verification for the implementation can run on the workstation/browser without a phone. Preserve the recorded device evidence, but do not claim this new foreground movement path, physical step accuracy, battery behavior or the installed Android build has been verified on a device. No phone request is needed to complete the code and workstation checks.

## Review result

The smallest complete connection is: accepted submit or fresh activity -> pure reducer -> bounded display reaction; explicit plan plus genuine return -> one optional contextual note; ordinary chat -> one useful response under current rules. Native foreground movement is the only additional path needed for immediate response before the existing hourly upload. It is an optional presentation signal with strict existing-import gates, not a new owner or feeding channel.
