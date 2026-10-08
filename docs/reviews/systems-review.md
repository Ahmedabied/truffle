# Chat systems review

Reviewed 2026-10-09. Local code and controlled streams only. No production chat, GPU request, deployment, or load test was run for this review.

The biggest first-impression problem is the deliberate cold-provider wait. The repository records an approximately 26-second first cold reply: the configured Modal wait is 25 seconds, while the documented cold start is about 10 minutes. Waiting 25 seconds cannot make that cold model ready. A separate bug let an initial role or reasoning event disable even that deadline.

## Fixed and reproduced

| Finding | User or resource consequence | Fix and evidence |
| --- | --- | --- |
| Modal stopped its timeout at the first SSE payload, including role, hidden reasoning, and `[DONE]`. | A silent model appeared ready. The fallback was skipped, or an empty reply reached the chat handler. | Provider choice now waits for text that survives thought stripping and the visible-text predicate. A role/reasoning-only stream with a 20 ms deadline falls back and cancels the source. Empty Modal output also falls back. |
| Stream cancellation waited for `AsyncGenerator.return()` behind a pending `next()`. | A silent provider could retain its byte stream after cancellation. | Cancellation reaches the byte reader directly before closing the generator. Both Modal and Workers AI have regressions that cancel during a pending read and verify the underlying byte source is cancelled. |
| A provider's `[DONE]` was ignored until the HTTP connection closed. | A complete answer could remain busy until the deadline. | The sentinel closes the text stream and cancels any open source. A fixture deliberately keeps its connection open after `[DONE]`. |
| Cancellation during an empty-answer retry did not dispose of a stream that arrived later. | A replaced conversation could keep consuming inference output. | A cancelled retry wrapper cancels the late source with the original cancellation reason. |
| Successful Modal streams retained the caller's abort listener. | Completed replies retained request lifecycle state. | Completion, cancellation, and error detach listeners. A regression completes a reply, aborts its former caller, and confirms that the finished provider is unaffected. |
| Outgoing `TransformStream` writes waited for downstream reads, including during deadline cleanup. | A paused browser could retain the chat ticket and leave `waitUntil` pending beyond 60 seconds. | The finite, provider-token-capped reply uses a `ReadableStream` queue. Deadline tests deliberately stop downstream reads and verify upstream abort, ticket release, unused quota refund, and partial charging exactly once. Existing deadline SSE error assertions remain green. |
| Browser request timeouts ended when headers arrived. | Health checks and JSON state requests could wait forever on a stalled body. | The deadline covers the response consumer, including error bodies. Fake-clock regressions keep the body open past the health and state deadlines. |
| Browser parsing normalized a trailing CR before receiving its LF. | Splitting a CRLF pair between network chunks changed a named token event into an unrecognized message event. Tokens could disappear. | A trailing CR is retained until the next chunk. Tests also split Arabic UTF-8 into single bytes and preserve multiline data. |
| Browser EOF fabricated an extra blank line. | An interrupted terminal frame could be accepted as a completed chat. | Only terminated SSE frames dispatch. Incomplete EOF data is discarded. |
| Browser chat events trusted JSON to be an object. | `null` threw; arrays and scalars fabricated completion events. | Non-object payloads are ignored. |
| Browser chat could remain reading after a terminal event and had no caller cancellation input. | A new pet or reset could leave the old network request active. | `RealBackend.chat` accepts an optional `AbortSignal`, cancels pending reads immediately, and ends after `done` or `error`. Wiring the signal into the view is an integration responsibility. |

The parser behavior follows the [HTML SSE framing rules](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream). Reader cancellation and releasing a reader lock are different operations in the [Streams Standard](https://streams.spec.whatwg.org/#default-reader-cancel); releasing the lock alone does not cancel the source.

## What the deadline now means

Modal's configured timer starts before its HTTP request and remains active through headers, role events, reasoning tokens, whitespace, and inline thought stripping. Successful provider selection preserves the first visible chunk for the client. Subsequent text continues streaming.

This is a Modal selection deadline, not a promise that a user sees a token within that time. A fallback still needs its own inference latency. Workers AI can also require its existing empty-output retry. The Durable Object has a separate 60-second whole-chat deadline and the browser has a 90-second stream-idle deadline. The object may buffer text in its status-block guard before displaying it.

The cancellation tests establish local stream disposal and signal propagation. They do not establish when either hosted provider releases GPU resources after a cancelled HTTP request.

## Remaining priorities

1. **Measure before shortening the Modal selection wait.** An 8-second value was proposed because the repository reports a roughly 4-second warm response. The integrating agent retained 25 seconds: one warm observation does not establish warm p95, especially for high-tier thinking. The cold-path latency remains unresolved. Measure low, medium, and high tiers separately, then change the decision record and runtime configuration together. A lower deadline trades faster cold fallback against more lost opportunities for the tuned voice.
2. **Connect UI cancellation to the new API input.** Generation fencing already protects against stale UI callbacks. The view must also abort the previous controller when clearing or replacing a conversation. This was escalated to the integrating agent.
3. **Collect latency without recording message text.** Add request start, provider selected, first visible token, completion, fallback reason, tier, and cancellation reason to structured timing logs. The existing `brain_fallback` log proves routing but cannot establish user-visible p50/p95 or distinguish warm inference from stream buffering.

Avoid a parallel-provider race until measured latency and budget justify it. It can bill both providers while presenting only one answer. A future cold-provider circuit breaker should likewise follow measured recovery behavior, because a long arbitrary open interval can unnecessarily suppress the fine-tuned voice.

## Verification

- Worker regression run first: 7 failures that reproduced the routing and cancellation bugs, then all passed after the fixes. Two additional caller-cancellation and listener-cleanup checks passed.
- Browser regression run first: 10 failures out of 12 tests, then all 12 passed after the fixes.
- Outgoing-backpressure regressions first: both new Durable Object tests failed because the deadline left background work pending. All 40 object tests passed after replacing the blocking output writer.
- Web checkpoint: full suite 160 tests passed; `tsc --noEmit` passed; Vite production build passed.
- Final worker checkpoint: full suite 428 tests passed, including 23 brain tests and 40 object tests. TypeScript checks passed. The integrating agent should verify its combined changes before deployment.

Existing tooling warnings: Vite warns that the test configuration's `__dirname` needs modernization for a future config loader; Node labels its SQLite API experimental. Neither produced a test failure.

## Integration follow-up

The view now owns an AbortController and passes its signal to the browser API.
Clearing or replacing a conversation aborts the request as well as fencing stale
UI completions. Browser tests cover cancellation before and after visible text.
The default provider-selection wait remains 25 seconds. The recorded evaluation
shows substantial tier variation in whole-request latency; see
[completion latency artifact](recorded-completion-latencies.json). These figures
are not first-token timings and do not establish a new production timeout.
