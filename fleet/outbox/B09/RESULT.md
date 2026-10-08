# B09 RESULT: worker hardening round 2

Status: **done, all 6 items**. Nothing committed. Nothing deployed. Cost: 0 GPU, $0. The smoke run made at most one Workers AI call through `wrangler dev`.

Tests: **238 before, 288 after**, all green. Typecheck clean. Smoke passes against `wrangler dev`. The golden file is unchanged.

## Files

| File | Change |
|---|---|
| `worker/src/do.ts` | Chat tickets, reservation at admission, deadline abort, generation fence on the whole completion, shared visible-text check, rolling facts, single-flight weather with backoff and coordinate revision, admitted tier into the state block, no logging into deleted storage. |
| `worker/src/brain.ts` | `hasVisibleText` (the one predicate). `BrainRequest.signal`: passed to Workers AI (`AiOptions.signal`) and linked to the Modal fetch for the whole stream. The retry uses the predicate and will not start once aborted. |
| `worker/src/engine.ts` | `stateBlock(state, { lang, weather_text, tier? })`. The tier goes through `decideTier`, so it can only lower what energy allows. No tier: same output as before. |
| `worker/src/index.ts` | Per-IP failed-lookup limit on every owner route, checked before the Truffle stub is fetched. |
| `worker/src/limiter.ts` | `peek(rules)`: checks without counting. |
| `worker/src/ratelimit.ts` | `unreserve`, `AUTH_FAILS_PER_MINUTE` (30), `MINUTE_MS`, `nextWeatherBackoff`, backoff constants. |
| `worker/src/types.ts` | `Meta.chat` (a `ChatTicket`) replaces `chat_lock_until`. New `coords_rev`, `weather_fail`. |
| `worker/src/pairing.ts`, `worker/src/facts.ts` | Comments only: no timing claim, rolling memory. |
| `worker/README.md` | 401 and limiter, chat ticket and deadline, fencing, demo reservation, visible text, rolling memory, weather single flight and backoff. The "same timing" wording is gone. |
| `worker/vitest.config.ts` | Aliases `cloudflare:workers` to a test stand-in so DO code can load in Node. |
| `worker/test/helpers/` | **New.** `do-harness.ts` (node:sqlite host, clock, fake Workers AI SSE, held streams, fake Open-Meteo fetch, LimiterDO and namespace fakes), `cloudflare-workers.ts` (DO base class stand-in). |
| `worker/test/do.test.ts` | **New.** D01, D02, D03, D07, M03, P01, D09. 38 tests. |
| `worker/test/auth-limit.test.ts` | **New.** R02 through the real Hono app. 6 tests. |
| `worker/test/b09-units.test.ts` | **New.** stateBlock tier, `unreserve`, backoff. 6 tests. |

Nothing outside `worker/` was changed, apart from this report. No existing test or golden was edited.

A note on "the same fakes the existing DO tests use": the repo had no DO tests. S11's offline harness lives in its outbox as CommonJS. I built the Vitest harness on the same idea: real source, node:sqlite storage, fake platform. These are not workerd tests. `@cloudflare/vitest-pool-workers` is still not installed.

## Per item

### 1. S11-01 and S11-02: chat identity and fencing

- Admission creates a ticket: `{id, generation, until, demo_window?}` in `Meta.chat`. `id` is a random UUID. `until` is admission plus 60 s.
- Quota is reserved at admission. The hourly chat window counts every admitted attempt and is never given back. A demo reply slot is taken with `checkRate` and only if it says `allowed`. It is given back (`unreserve`, same window only) when the chat ends with no visible text.
- Before the deadline a second chat gets 429. After it, the next request aborts the old call through its `AbortController`, clears the old ticket, then admits. A 60 s timer also aborts a reply still running on its own. The abort reaches the provider (`signal` on Workers AI and Modal) and our reader (`reader.cancel`), in case a provider ignores the signal mid-stream.
- `finish` re-reads storage and checks three things: the ticket id still owns the slot, the generation is unchanged, the Truffle is not dead. Otherwise it charges nothing, writes no turns, starts no fact extraction and sends `error` ("Truffle lost the thread of that reply. Nothing was charged."). It logs `chat_stale` with the reason.
- The `finally` frees the slot only if the stored ticket is still its own.
- If the object restarted and lost the old run, the next admission gives back the old demo slot itself.
- Demo expiry while a reply runs: the alarm drops tables and resets the schema flag. The late completion reads nothing, logs nothing and recreates nothing.

Tests: D01 (5), D02 (6), D03 (4).

### 2. S11-06: visible text predicate

- `hasVisibleText(text)`: true if any character is not whitespace and not a Unicode format character (`\p{Cf}`: zero-width space, word joiner, BOM and similar).
- Used by `retryIfEmpty`, the DO success path and the DO error path. The error path used `reply.length > 0` before. That was the bug.
- Results, from the D07 matrix (demo Truffle, medium, energy 3600):

| First | Retry | Calls | Charged | Demo slot | Turns | End |
|---|---|---:|---|---|---:|---|
| visible | none | 1 | yes | used | 2 | done |
| empty | visible | 2 | yes | used | 2 | done |
| whitespace | visible | 2 | yes | used | 2 | done |
| empty | empty | 2 | no | given back | 0 | error |
| whitespace | whitespace | 2 | no | given back | 0 | error |
| whitespace | throws | 2 | no | given back | 0 | error |
| whitespace | stream error | 2 | no | given back | 0 | error |
| zero-width | zero-width | 2 | no | given back | 0 | error |
| visible, then stream error | none | 1 | yes | used | 2 | done, partial |

Every row also checks that the lock is released. A high retry runs with thinking off and the same 2224 token budget (1200 plus 1024).

### 3. S11-08: rolling memory

- `addFacts`: a duplicate (case-insensitive) is skipped and evicts nothing. A new distinct fact at 60 deletes the oldest by id, then inserts. The bound stays 60. Death still wipes all facts.
- Tests (M03, 4): the 61st evicts the oldest, a duplicate evicts nothing, three new facts evict three, and a full store from Oct 1 learns a fact on Oct 8 that the next low and medium prompts include.

### 4. S11-09: decision 0013

- `stateBlock` takes an optional `tier`. The DO passes `decision.tier`, the tier it charges. Token cap, thinking, memory window and cost already followed that decision.
- The 30 original goldens pass unchanged. They pass no tier.
- Tests: P01 (4) at energy 3600. Low gives `tier=low`, 120 tokens, thinking off, today's fact only, cost 20. Medium gives `tier=medium`, 400, off, the 7 day facts, 60. High gives `tier=high`, 2224, on, all facts, 200. Asleep makes no model call and charges nothing. Each prompt holds exactly one `tier=` field. Unit tests check that a higher tier than energy allows is clamped down.

### 5. S11-11: weather single flight

- One flight per object, keyed by the coordinate revision. Callers of the same revision share it.
- On failure: `weather_fail = {until_ms, backoff_ms}`, 5 minutes then doubling to 1 hour. Owner reads during the backoff keep the old data and do not fetch. A good fetch clears it. Forced refreshes (pairing, the midnight alarm) skip the backoff but still share a flight.
- `moveTo` bumps `coords_rev`. A forecast that comes back for an older revision is discarded and logged. It writes neither `weather_now` nor `weather_days`.
- `/feed` still never fetches.
- Tests (D09, 4): two stale readers make one fetch. The backoff runs 5, 10, 20, 40, 60, 60 minutes with no fetch inside a window. An old point's forecast is discarded and the next read fetches the new point. Feed makes zero fetches.

### 6. S11-05: auth lookups

- Every owner route (`/state`, `/chat`, `/spore`, `/demo/*`) first runs `LimiterDO.peek` on `auth:<ip>`. This happens after the phrase is parsed and before the Truffle stub is fetched. Over the limit, the answer is `429 {"error":"Too many failed tries from here. Try again in N s.","retry_after_s":N}`.
- Each failure counts one hit: a missing secret, or any 401 from the Truffle (unknown phrase, wrong secret, expired demo). Successes do not count. The limit is 30 a minute.
- The 401 body is unchanged and byte-identical in all three cases.
- The "same time class" claim is gone from `pairing.ts`, the `open()` comment and the README. They now say the bodies are identical, times are not equal, and lookups are rate-limited.
- Tests (R02, 6): identical status and bytes for unknown, wrong and missing. An unknown phrase creates no tables. After 30 failures the 31st gets 429, and the Truffle namespace `get` count does not move. Missing and correct secrets from that IP also wait. Another IP is unaffected. The limit clears after a minute. Missing secrets count. 35 successes do not count. `/chat` failures share the limit.

## Evidence

### Test-first

Before any source change, with only the new tests in place:

```text
$ npx vitest run test/do.test.ts
 ❯ test/do.test.ts (38 tests | 20 failed)
   × past the deadline the old call is aborted and fenced before the new one starts
   × one event then a stall: the whole-reply deadline still applies
   × the 30th reply is reserved at admission; ...
   × a held 30th reply blocks a 31st even after the lock deadline
   × demo: a reply released after reset changes nothing in the new life   (energy and turns changed, 'done' sent)
   × real: death at midnight, a new spore, a feed, then the old reply
   × death without a new spore: no charge, no turns
   × demo expiry while a reply is pending: storage stays deleted
   × whitespace then a throw / whitespace then a stream error            (expected 'error', got 'done')
   × zero-width only, twice
   × one shared visible-text predicate
   × a 61st distinct fact evicts the oldest / three new facts ... / a full old store learns ...
   × requested low at 3600 / requested medium at 3600                    (block said tier=high)
   × two stale readers share one forecast fetch                          (2 fetches)
   × failures back off ... / an old point's forecast cannot overwrite ...

$ npx vitest run test/auth-limit.test.ts
   × after 30 failed lookups a minute, the next gets 429 ...
   × missing secrets count as failed lookups
   × other owner routes share the limit
      Tests  3 failed | 3 passed (6)
```

The 18 that passed at once in `do.test.ts` were controls that already held: the 429 while a chat runs, sequential pricing, feed during inference, the refused-request and asleep quota cases, the D07 rows the success path already got right, the duplicate fact rule, high tier P01 and feed-without-fetch. `b09-units.test.ts` was written alongside the helpers, not before them.

### After

```text
$ cd worker && npx tsc --noEmit && echo "tsc: clean"
tsc: clean

$ npm test
 Test Files  14 passed (14)
      Tests  288 passed (288)
   Duration  1.11s

per file: do 38, validate 46, golden 33, time 28, weather 23, facts 20, ratelimit 18, prompt 17,
          brain 15, time-b02 15, engine 13, pairing 10, auth-limit 6, b09-units 6
```

Three full runs back to back were green. A timing flake in the first D09 draft came from `crypto.subtle` work outside the event loop. The tests now wait for the fetch (`until`) and do not rely on a fixed number of ticks.

```text
$ git diff --quiet -- tests/golden && echo "golden unchanged"
golden unchanged
```

### Smoke

```text
$ npx wrangler dev --ip 127.0.0.1 --port 8787   (background)
$ curl -s http://127.0.0.1:8787/health
{"ok":true,"service":"truffle","modal":false}
$ bash scripts/smoke.sh http://127.0.0.1:8787
SMOKE OK against http://127.0.0.1:8787 (real phrase smoothie-earth-foal, demo phrase field-bistro-nook)
```

Then, against the same local Worker, 31 wrong-secret `/state` calls from one address. The smoke had already made 2 failed lookups:

```text
     28 401
      3 429
{"error":"Too many failed tries from here. Try again in 54 s.","retry_after_s":54}
```

wrangler was stopped afterwards. No wrangler process is left running.

## Left out, and why

- **Production timing sample (S11-05 acceptance).** S11 asks for a small randomized production timing sample after the change. That needs a deploy, and the packet says nothing to deploy. The limiter bounds guessing. It does not make timing equal, and the README no longer claims it does.
- **D01 backpressured SSE delivery.** Not a separate test. The deadline is a wall-clock timer plus abort, so it does not depend on the client reading. That is covered by the stall test, but no test throttles the client side.
- **D09 rows that B06 already covers** (partial, out-of-range and nonfinite coordinates rejected, two-decimal storage, no trail). These are in `validate.test.ts` and B06's DO behaviour. No new test was added.
- **M03 "overlapping extraction completions".** `addFacts` is synchronous SQL in one object, so completions cannot interleave inside it. There is no separate concurrency test.
- **S11-03, S11-04, S11-07, S11-10** were out of scope by packet. Burrow and missing-forecast policy are unchanged. `day` is still optional. The 50,000 cap is unchanged. The fact filter is unchanged.

## Open questions for the owner

1. **Reset and death do not abort a running reply.** They fence it: it cannot charge or write. It keeps running until it ends or reaches its deadline, and it holds the chat slot until then (at most 60 s). Aborting at reset would save model time. It was left out to keep the change small.
2. **A reply cut off by its own 60 s timer with visible text is charged as partial.** This follows the existing mid-reply failure rule. It is only fenced (not charged) when a newer chat took the slot or the life changed.
3. **A fenced reply that showed text keeps its demo slot**, but costs the pet nothing. The words did reach the client, so it counts against the 30 demo replies.
4. **The auth limit is per IP.** Behind carrier NAT, one bad actor could make honest owners on the same address wait up to a minute. 30 failures a minute is high for honest use. A per-phrase limit would need object access, which S11 asked to avoid.
5. **Workers AI abort.** `AiOptions.signal` is in the published types. We also cancel our reader. Whether aborting stops billing on the Workers AI side is not verified.
6. **Forced weather refreshes skip the backoff.** These are pairing and the midnight alarm. During an outage, the midnight alarm still tries once per midnight.
7. **The invisible-text rule uses `\p{Cf}`.** That also covers the soft hyphen and bidi marks. A reply made only of those counts as empty.

## Cost

$0. No GPU, no Modal. At most one Workers AI call (the smoke chat) through `wrangler dev`.
