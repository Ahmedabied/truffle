# Fleet 25 / 03: gifts actually made while away

Date: 2026-10-09. Scope: read-only architecture review; this document is the only change. No inference, training, paid probe, commit, or deployment was run. Physical-phone behavior is unverified.

## Recommendation

Make the first version a **real server-side procedural craft job**, triggered ten minutes after an owner starts an outing or a best-effort authenticated browser-away event arrives. Decision 0023, written while this review was underway, extends the original explicit-outing scope to browser-away events. Generate fresh ASCII geometry and a small safely personalized note; persist the finished object before the owner returns. This meets the request for new surprises made while away without depending on an unreconciled paid-inference budget. It must not merely choose another entry from the twelve-object library.

Suitable generators are a constellation with a newly arranged star field, a bouquet with varying stems and petals, a pocket garden with different plant arrangements, and a woven pattern with generated symmetry. Save an independent random seed at job admission, combine it with the generation and day, and have pure bounded generators produce the actual glyphs. Seed inputs must not include the secret or expose the pairing phrase. Determinism supports retries; random admission seeds provide fresh combinations. Select among generator families, then create new geometry within the family. Keep a stable generator version so later code changes do not silently redraw collected objects.

Use the declared `walk`, `errand`, or `rest` kind and safe pet state to choose a warm authored note template. For example: “A little garden for your pocket. I made the taller sprout match your Truffle.” Call that **procedural art with an authored note**, not model-generated or knowledge of what happened outdoors. Note templates can mention the current pet stage or an explicitly saved non-sensitive preference; they must not infer location, route, weather exposure, actual steps during the outing, emotions, or health. No extra fact extraction is needed. Text-only personalization is optional; the new geometry alone distinguishes this from the current catalog.

Gifts cost **zero game energy**. They change no steps, mood, tier, affection, lifespan, or streak. A living pet can craft on rest and heat days, including at zero energy. That preserves decision 0021's no automatic energy spending and avoids making leaving the screen a penalty. Server CPU/storage is bounded but is not literally zero infrastructure cost. Paid model-generated art or notes remain an optional later extension, below.

## What the code currently does

| Surface | Evidence and implication |
|---|---|
| `web/src/keepsakes.ts` | Twelve authored ASCII objects with English/Arabic notes; `returnToShelf()` resolves a deterministic choice on return after a local ten-minute gap. Maximum twelve stored; one per supplied local day. No server work. |
| `web/src/main.ts:262` | Shelf is keyed by API origin, real/demo mode, and phrase. Outing buttons save browser data only (`:771`). `refreshKeepsakes()` creates the return gift. |
| `web/src/main.ts:283` | `showGift()` already uses `textContent` and a `pre`; scene clicks open the chat gift card. Reuse this rendering. |
| `web/src/scene/keepsakes.ts` | World accepts arbitrary `{id, art}`; last three shown, ASCII restricted to seven rows by twelve columns, 44 px minimum hit area. The server should validate to exactly those constraints instead of relying on renderer truncation. |
| `worker/src/do.ts:302,924` | One alarm currently serves local midnight or demo expiry. A gift alarm must share the scheduler, never overwrite midnight. |
| `worker/src/do.ts:542` | Owner authentication, generation tickets, a one-chat slot, and a 60-second deadline protect chat completion. `wipeMemory()` bumps generation on death/new spore/reset. Gifts need the same lifetime boundary. |
| `worker/src/brain.ts:344` | `askBrain()` can try Modal, Workers AI fallback, and an empty-output retry. One gift call through this router can therefore initiate multiple billable attempts. |
| `worker/src/do.ts:677,845` | Chat logs energy and characters; optional fact extraction calls Workers AI separately. These are not a complete provider-usage ledger. The local log also retains only 200 rows. |
| `fleet/costs.md` | Explicit $50 total cap ($20 loaded plus $30 Modal credit); cash and recent serving usage remain unreconciled. Credit is consumed budget, not zero compute cost. |

## Minimal API contract

Use the existing `owned()` / `ownerReply()` path and secret header; phrase-only `/feed` must neither start jobs nor expose gifts. Preserve uniform owner-auth failure behavior and the request-body cap. No gift URL is public, and this feature publishes or sends nothing to others.

```ts
// POST /companion: owner-authenticated existing button or browser lifecycle
type CompanionAction = {
  phrase: string;
  action: "away" | "return" | "cancel";
  intent: "walk" | "errand" | "rest" | null;
  client_request_id?: string; // recommended UUID, stable across retries
};
// Owner-authenticated response; server timestamps and pinned server timezone.
type OutingReceipt = {
  id: string;
  generation: number;
  day: string;
  state: "scheduled" | "ready" | "cancelled" | "expired";
  due_ms: number;
};

// Additive owner /state.companion; absent means an older server.
type GiftSummary = {
  generation: number;
  pending: OutingReceipt | null;
  gifts: StoredGift[]; // last 12, stable ascending server ids
};
type StoredGift = {
  id: string;
  generation: number;
  day: string;
  at: number; // actual completed server creation time
  art: string;        // 1..7 lines, each 1..12 printable ASCII chars
  name: string;
  note: string; // bounded plaintext, localized by existing safe authored copy
  provenance: "procedural"; // authored fallback/legacy use their own discriminator
};
```

Start after the user's click or an authenticated best-effort visibility-away event under decision 0023. Null intent means rest/ordinary browser absence, never inferred walking. `/state` polling, step upload, and geolocation do not create jobs. A page closing before its event is delivered cannot promise creation. Browser absence and a declared outing are app evidence, not sensed real-world activity. Await a start receipt before promising preparation; failed admission can keep the outing UI but must not claim a scheduled craft. Browser-away events must never enable the optional paid extension.

One active job and at most one completed gift per **pet and pinned local day**; the request id makes double-clicks and response-loss retries idempotent. Existing pending jobs keep their original due time. Completed-day tombstones and monotonic last-gift/admission time survive new spore/demo reset, so resetting or clock rollback cannot mint more gifts that day. A cancelled early absence may be replaced by a later genuine away event, with a fresh full ten-minute wait and bounded owner action rate (at most 30/hour). Other days require another away event; there is no recurring daily generation while a user remains away. The day comes from server `localDayKey(now, m.tz)`, never from the browser.

Return before creation changes `scheduled` to `cancelled`. Returning after creation leaves the gift intact. Opening a second client and returning cancels the shared job. Frontend return must POST the return action before its return refresh; failed return delivery must not be presented as confirmed cancellation. An ordinary background `/state` poll is not evidence of return. For simultaneous tabs, one hidden tab must not continually reschedule while another is visibly active: use a browser BroadcastChannel leader/presence check for best-effort away signals, while server idempotency/caps remain authoritative. Show a small “making a keepsake” state when admitted; do not promise a completed gift at a precise instant.

## Persistence, alarm, and race contract

Use a small server gift table plus one current job in `Meta`; add schema only after successful ownership/pairing, preserving the current no-storage-on-unknown-phrase behavior. Existing paired objects need an explicit idempotent schema migration path, since their `ensureSchema()` is not called on every open.

Persist job `{id, client_request_id, generation, day, kind, seed, generator_version, created_ms, due_ms, expires_ms, state}` before acknowledging. Keep seed and generator metadata internal. `due_ms = created_ms + 10 minutes`; expire unstarted jobs after 24 hours from admission. No historical catch-up gifts. Terminal jobs need no recurring alarm. Keep completed-day/high-water accounting separate from the twelve-gift retention ring. A midnight-crossing job consumes the completion day's gift slot; recheck that slot atomically at commit, so yesterday's delayed job and today's job cannot both create today's gift.

Cloudflare allows one alarm per object; setting another replaces it, and execution is at least once. The scheduler must choose the earliest relevant time from midnight catch-up, demo expiry, scheduled gift due time, and any existing recovery deadline. Persist state first, then schedule. Recompute using **fresh loaded state after every network await**. See [Cloudflare alarms documentation](https://developers.cloudflare.com/durable-objects/api/alarms/).

At an alarm: handle demo expiry first; perform the existing bounded midnight catch-up and generation changes; then load fresh job/state. If due, same generation, alive, unexpired, and still scheduled, synchronously generate bounded art and validate it. Commit gift insertion plus `ready` status in one local transaction, with a unique job id preventing duplicate insertion. Do not `await` inside this small generation/commit section. Retain the existing catch-up debt behavior and recompute the next alarm on every exit, including failures. Persistence, rather than an in-memory timer, makes the job survive eviction; see [Cloudflare storage guidance](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/).

At-most-once visible creation follows from the persisted terminal status and unique job id. A retry can recreate candidate bytes from the saved seed but cannot append a second gift. No provider is involved, so retry has no inference side effect. Catch generator/validation errors and store a bounded authored fallback with honest provenance, or finish as failed; never endlessly retry a broken generator.

Extend `wipeMemory()` to cancel active gift jobs and clear current-life gifts. Abort optional in-flight gift inference there too. New generation responses must discard old selected gift, scene objects, and cached shelf scope. Generation must be returned in owner `/state`; phrase alone does not distinguish successive pets. Demo expiry deletes local DO state and prevents a late completion from recreating it. A demo preview remains clearly labelled, costs no inference, and cannot change the real daily gate.

## Preserve the current shelf and UI

Make the UI adapter accept stored art/text plus provenance; remove the `GiftId`-only assumption for server gifts. Use stable server ids instead of `at` for selected item and scene hit targets. Retain `textContent`, `dir="ltr"` for art, Arabic prose direction, keyboard-accessible shelf buttons, and the current three-object world placement. Labels should distinguish “Made while you were away · procedural art” from “From the authored collection.” Never call an authored fallback a personalized AI creation.

Do not silently delete the existing local collection. Read shelf v1 as a separate legacy collection and merge it for display with server gifts using namespaced ids. If importing, add an owner-only bounded legacy import (maximum twelve valid known catalog entries), mark them `authored`/`legacy-local`, and make import ids idempotent. Legacy imports do not occupy fresh-generation slots or affect daily job gates. Keep the original local shelf until the server acknowledges every imported id; no loss on interrupted migration. Preserve API, pet, and real/demo boundaries, then add generation to future cache keys. Legacy gifts with unknown generation should remain clearly archival rather than appear on a newly reset pet's ground.

## Optional paid extension: closed until accounting is ready

Do not run this extension in the present review. Default `PAID_GIFTS_ENABLED=false`; missing, stale, or unknown budget state denies model work and uses procedural creation. The user's feature authorization does not mean new training, public posting, or an unlimited GPU allocation.

Before enabling, reconcile all prior consumption against the $50 cap and account for active Modal containers, cold starts, idle tails, CPU/RAM, and pending bills. Do not calculate remaining budget from the sum of estimates alone. Every paid attempt, including failed/aborted attempts, chat fallbacks, retries, and fact extraction, must have a durable usage record. A per-pet gift quota cannot enforce a project-wide dollar ceiling.

Add a small centralized budget authority used only for spending reservations, not every app request. Store amounts in integer microdollars and separate provider balances. Require atomic `reserve(attemptId, worstCaseUsd, purpose)` before dispatch, `markStarted`, and idempotent settlement. Suggested gift sublimits after reconciliation: one attempt per admitted daily job; maximum $0.01 verified worst-case reservation per attempt, $0.10 across all gifts per day, and $1 cumulative experiment budget drawn from the remaining $50, not added to it. These are proposed admission ceilings, not provider-price claims. Deny any provider whose full exposure cannot fit a proven bound; a client timeout is not evidence GPU billing stopped. In particular, do not wake Modal for a tiny gift without a provider-side lifecycle cost bound.

Persist a dispatch marker before HTTP. A crash after this marker becomes `usage_unknown`, with reservation retained and **no automatic redispatch** unless the provider has verified idempotency. Reconcile unknown outcomes separately. Cross-DO reservation calls can interleave: reserve by stable attempt id, then re-read the pet's job/generation before dispatch; release only a confirmed never-started reservation. Global usage history must survive pet resets and demo deletion, and must not be pruned with the 200-row pet log. Mirror paid-run summaries into `fleet/costs.md` without logging secrets or personal prompts.

A future gift request should use an explicit single-attempt provider method, not today's unrestricted `askBrain()` routing. Preserve the existing chat timeout and generation fences; admit background work only when no chat holds the per-pet inference slot, and give foreground chat priority. Never clear another ticket in cleanup. Retain provider-call abort and stream cancellation, with a hard overall deadline no greater than the current 60 seconds. A procedural gift is the fallback on any refusal/failure; do not spend on “repair” or translation calls.

Bound model input to a versioned system prompt and a JSON data object: requested language, declared outing kind, pet stage, and at most three cleaned non-sensitive facts within the existing memory window. Exclude raw recent chat, credentials, coordinates, health numbers, and entire transcripts. Facts are untrusted data, never instructions; existing `isInstructionLike()` filtering is defense in depth, not a security boundary. No tools, network actions, or external URLs. Disable thinking; cap input and output before dispatch (suggestion: verified <=1,024 input tokens and <=384 output tokens). Return only strict `{name,note,art}` JSON. Enforce printable-ASCII art dimensions, text length/control-character bounds, existing voice/safety checks, and no HTML sinks in code. Reject malformed output instead of regenerating. Persist actual provider/model, prompt version, attempt id, completion time, usage status, and field-level provenance internally; show a small truthful source label. Do not feed a gift back into fact extraction.

## Required offline acceptance tests

Use the current fake-clock/SQLite/fake-AI harness; fake all provider and weather calls. No phone or live model is required for these checks.

1. Initial visit, polling, and feed produce no job; an authenticated browser-away event can create one under decision 0023. Hidden-tab handling never calls AI; a visible peer tab suppresses redundant browser-away admission where presence is known.
2. Authenticated start persists a receipt; duplicate/concurrent start and response-loss retry reuse the job. Wrong/missing secret and unknown phrase create no tables or alarm.
3. At 9:59 no gift exists; alarm at 10:00 creates new ASCII and stores it before any return request. Two seeds produce different valid geometry; fixed seed/version is reproducible.
4. Return at 9:59 cancels; return after completion preserves the gift; a racing alarm/return yields one well-defined result and never two gifts.
5. Repeated alarms, DO recreation, duplicate requests, and table-ring eviction never reopen a completed day. Reset/new spore cannot bypass the daily gate. Cancel/restart requires a fresh ten minutes and is action-rate-limited.
6. Midnight plus gift due, multi-midnight debt, demo expiry, and weather-fetch interleaving retain all necessary alarm deadlines. Fresh state prevents overwriting a return/cancellation.
7. Death/reset/spore or owner switch removes old-generation scene/chat/shelf state; old completion cannot mutate the new life. API-origin and real/demo collections remain isolated.
8. Zero-energy, rest, and burrowed pets receive eligible procedural gifts without engine state changes. Dead pets receive none. A long absence creates only its one admitted job.
9. Generator errors, overwide art, too many lines, control characters, and malformed notes yield an honest authored fallback or terminal failure; no retry loop or AI call.
10. Twelve retained server gifts, three world hitboxes, keyboard shelf access, Arabic prose, LTR art, reduced motion, and `<script>`-like text remain safe and readable.
11. Legacy v1 shelf stays visible; interrupted import retains local data; repeated import is idempotent and does not poison daily caps. Reset keeps archival legacy items off the new pet's ground.
12. Paid mode disabled/unknown budget always produces zero calls. If later enabled, test global reservation concurrency across pets, unknown dispatch outcomes, per-provider balances, every fallback/retry/extraction attempt recorded, and no automatic redispatch after a crash.

The decisive product proof is an offline integration trace showing `scheduled -> ready` from `alarm()` while no browser return request exists, followed by retrieval of those exact stored bytes. A screenshot alone cannot prove background creation.
