# S03: Workers AI Gemma 4 fallback

## Outcome

**Usable for low/medium chat and fact extraction. Thinking can be disabled with the documented nested flag.**

```ts
chat_template_kwargs: { enable_thinking: false }
```

- Thinking is on by default. A top-level `enable_thinking: false` did not disable it.
- Thinking off produced no reasoning or thought tags in 5/5 repeat trials.
- Schema extraction produced valid schema-conforming JSON in 5/5 repeat trials.
- Arabic replies worked with thinking off.
- Three 400-token streams had mean visible-token latency of 0.478 seconds. Mean total time was 7.568 seconds.
- **High-tier warning:** one Arabic call consumed all 1,200 output tokens on reasoning. It produced no final answer.
- The copy-ready helpers were called through the real AI binding. They also passed 40 local tests and a TypeScript check.
- Wrangler was stopped. Port 8793 is closed. Nothing was deployed.

Observed on the night of 2026-10-07, continuing just past midnight on 2026-10-08 in Oman. All inference requests used only `@cf/google/gemma-4-26b-a4b-it`.

## Deliverables and evidence

- `fleet/outbox/S03/snippet.ts`: `callFallbackBrain(ai, system, messages, opts)`.
- `fleet/outbox/S03/extract.ts`: `extractFacts(ai, transcript): Promise<string[]>`.
- `fleet/outbox/S03/scratch/`: isolated Worker, package, config, curl harness, tests, and summary script.
- `fleet/outbox/S03/raw/`: complete response bodies, SSE bytes, input manifests, headers, per-event timings, schemas, public documentation, and logs. This directory is gitignored.
- `raw/summary.json`: computed trial counts, latency data, and usage subtotal.

Paths below are relative to `fleet/outbox/S03/` unless stated otherwise. No source under `worker/` or `web/` was changed. No sign-in, deployment, commit, or push was performed. The existing Wrangler executable and existing type declarations were reused. No package installation was needed.

## Setup and commands

The scratch config has `compatibility_date: "2026-09-01"` and `"ai": {"binding": "AI"}`. The server was bound to loopback only.

```sh
cd /home/abied/Desktop/Truffle/fleet/outbox/S03/scratch
mkdir -p /home/abied/Desktop/Truffle/fleet/outbox/S03/tmp
WRANGLER_SEND_METRICS=false WRANGLER_WRITE_LOGS=false \
WRANGLER_LOG_SANITIZE=true BROWSER=none \
TMPDIR=/home/abied/Desktop/Truffle/fleet/outbox/S03/tmp \
/home/abied/Desktop/Truffle/worker/node_modules/.bin/wrangler dev \
  --port 8793 --ip 127.0.0.1 --inspector-port 0
```

Relevant startup output from `raw/wrangler-dev.log`:

```text
Binding        Resource      Mode
env.AI         AI            remote
[wrangler:info] Ready on http://127.0.0.1:8793
```

Each probe used `curl` against this local server. The Worker called the real remote AI binding. The `?input=true` variant only returned the request manifest. It did not perform inference.

```sh
curl -sS http://127.0.0.1:8793/health
curl -sS http://127.0.0.1:8793/chat
curl -sSN http://127.0.0.1:8793/stream
curl -sS 'http://127.0.0.1:8793/thinking?variant=default'
curl -sS http://127.0.0.1:8793/extract
curl -sS http://127.0.0.1:8793/arabic
curl -sSN http://127.0.0.1:8793/latency
```

The repeatable curl harness is `scratch/probe.py`. Executed groups were `stream`, `thinking`, `extract`, `arabic`, `latency`, `high`, and `extra`. It saves the exact curl command in each `*.metrics.json`. It refuses to overwrite existing evidence. The three latency trials were sequential and ran after the other initial probes had completed.

## 1. Non-streaming chat, 120-token cap

The system prompt contained this exact state block from `docs/01_product_spec.md`:

```text
[truffle stage=Sprout energy=63% tier=high mood=affectionate zero_days=0 burrowed=no weather="34C clear, Muscat" lang=ar steps_today=6120 avg7=4800 age_days=3]
```

It followed this persona text:

```text
You are Truffle, a small affectionate desert truffle pet. Follow the supplied state. Speak in the state's language. Be warm, concise, and never shame the user. Do not mention calories or body weight.
```

User message:

```text
I walked 6,120 steps today. Say hello in two short sentences using the state language.
```

Options: `max_tokens: 120`, `temperature: 0.7`, `stream: false`, `chat_template_kwargs: {enable_thinking: false}`. The explicit token/thinking settings deliberately differ from the example block's high tier. This tests the API controls with the required exact block. Production must use the engine's real tier values.

Full JSON response, verbatim from `raw/chat.json`:

```json
{"choices":[{"finish_reason":"stop","index":0,"logprobs":null,"message":{"content":"أهلاً بك يا صديقي! أنت رائع جداً اليوم.","role":"assistant"}}],"created":1791402397,"id":"4bb245b612b04449b9efe83d17ce90e0","model":"@cf/google/gemma-4-26b-a4b-it-external","object":"chat.completion","usage":{"prompt_tokens":147,"completion_tokens":16,"total_tokens":163,"prompt_tokens_details":{"cached_tokens":0},"neurons":1.7727272510528564}}
```

```text
HTTP 200, first byte 2.094766s, total 2.094900s
```

The answer is `choices[0].message.content`. Do not parse a top-level `response` field for this non-streaming model. Some replies report the model name with an `-external` suffix. Others report the requested name. These are response metadata from the same requested model ID.

## 2. Streaming shape

`/stream` used the same messages and 120-token cap. It added `stream: true` and `stream_options: {include_usage: true}`. The AI binding returned a `ReadableStream` of SSE bytes.

First five SSE events, verbatim from `raw/stream-off.sse`:

```text
data: {"choices":[{"delta":{"content":"","reasoning_content":null,"role":"assistant"},"finish_reason":null,"index":0,"logprobs":null,"matched_stop":null}],"created":1791402526,"id":"f962191d3d2f47418286b60056319eb5","model":"@cf/google/gemma-4-26b-a4b-it-external","object":"chat.completion.chunk","p":"pf8tbfo2fkeejbo6kdfvsifkyf6po10nt","usage":{"prompt_tokens":147,"completion_tokens":0,"total_tokens":147,"prompt_tokens_details":{"cached_tokens":0},"neurons":1.3363635540008545}}

data: {"choices":[{"delta":{"content":"أ","reasoning_content":null},"finish_reason":null,"index":0,"logprobs":null,"matched_stop":null}],"created":1791402526,"id":"f962191d3d2f47418286b60056319eb5","model":"@cf/google/gemma-4-26b-a4b-it-external","object":"chat.completion.chunk","p":"nnvb131g3hod32avnlj91d5bzje5sg","usage":{"prompt_tokens":0,"completion_tokens":1,"total_tokens":1,"prompt_tokens_details":{"cached_tokens":0},"neurons":0.027272727340459824}}

data: {"choices":[{"delta":{"content":"ه","reasoning_content":null},"finish_reason":null,"index":0,"logprobs":null,"matched_stop":null}],"created":1791402526,"id":"f962191d3d2f47418286b60056319eb5","model":"@cf/google/gemma-4-26b-a4b-it-external","object":"chat.completion.chunk","p":"2irkek6pfjdg1kv4snmisjknv0hjuv8snd3i9rjd7","usage":{"prompt_tokens":0,"completion_tokens":1,"total_tokens":1,"prompt_tokens_details":{"cached_tokens":0},"neurons":0.027272727340459824}}

data: {"choices":[{"delta":{"content":"لاً","reasoning_content":null},"finish_reason":null,"index":0,"logprobs":null,"matched_stop":null}],"created":1791402526,"id":"f962191d3d2f47418286b60056319eb5","model":"@cf/google/gemma-4-26b-a4b-it-external","object":"chat.completion.chunk","p":"xegr1g9m3x1iz0","usage":{"prompt_tokens":0,"completion_tokens":1,"total_tokens":1,"prompt_tokens_details":{"cached_tokens":0},"neurons":0.027272727340459824}}

data: {"choices":[{"delta":{"content":" بك","reasoning_content":null},"finish_reason":null,"index":0,"logprobs":null,"matched_stop":null}],"created":1791402526,"id":"f962191d3d2f47418286b60056319eb5","model":"@cf/google/gemma-4-26b-a4b-it-external","object":"chat.completion.chunk","p":"4fxa38f2h8p8byuhx0z","usage":{"prompt_tokens":0,"completion_tokens":1,"total_tokens":1,"prompt_tokens_details":{"cached_tokens":0},"neurons":0.027272727340459824}}

```

Tail, including the final event, verbatim:

```text
data: {"choices":[{"delta":{"reasoning_content":null},"finish_reason":"stop","index":0,"logprobs":null,"matched_stop":106}],"created":1791402526,"id":"f962191d3d2f47418286b60056319eb5","model":"@cf/google/gemma-4-26b-a4b-it-external","object":"chat.completion.chunk","p":"l48shpm1b","usage":{"prompt_tokens":0,"completion_tokens":0,"total_tokens":0,"prompt_tokens_details":{"cached_tokens":0},"neurons":0}}

data: {"choices":[],"created":1791402526,"id":"f962191d3d2f47418286b60056319eb5","model":"@cf/google/gemma-4-26b-a4b-it-external","object":"chat.completion.chunk","p":"sxm6dki9","usage":{"prompt_tokens":0,"completion_tokens":1,"total_tokens":1,"prompt_tokens_details":{"cached_tokens":0},"neurons":0.027272727340459824}}

data: {"response":"","usage":{"prompt_tokens":147,"completion_tokens":16,"total_tokens":163,"prompt_tokens_details":{"cached_tokens":0},"neurons":1.7727271914482117}}

data: [DONE]

```

The first role event is not a visible token. Text arrives in `choices[0].delta.content`. The `p` field and other metadata are not text. The final `response` is empty. Earlier usage values are incremental. The last `{response:"",usage:{...}}` event is cumulative. Do not sum both the increments and that final total.

## 3. Thinking controls and token burn

Primary sources:

- [Model page](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/)
- [Exact sync input schema](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/sync-input.json)
- [Exact streaming input schema](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/streaming-input.json)

The collapsed model page hides important details. The linked schemas explicitly document this object:

```json
{
  "chat_template_kwargs": {
    "type": "object",
    "properties": {
      "enable_thinking": {
        "type": "boolean",
        "default": true,
        "description": "Whether to enable reasoning for this model."
      },
      "clear_thinking": {
        "type": "boolean",
        "default": false,
        "description": "If false, preserves reasoning context between turns."
      }
    }
  }
}
```

The model-specific schema does not document a top-level `enable_thinking`, `reasoning`, or `reasoning_effort` control. Two unsupported forms were tried as negative controls. Both were accepted without an HTTP error, but neither disabled thinking.

The common `/thinking` prompt asked for steps remaining from `2500 + 1800 + 2300` toward `8000`. Its block changed only `lang=ar` to `lang=en`. All options below used a 400-token output cap and temperature 0.7.

| Input options | Observed reasoning location | Answer | Completion tokens | Prompt tokens | Neurons |
|---|---|---|---:|---:|---:|
| No thinking options | `message.reasoning_content` | Empty, length limit | 400 | 180 | 12.545455 |
| `chat_template_kwargs: {enable_thinking: true}` | `message.reasoning` | Null, length limit | 400 | 181 | 12.554545 |
| `chat_template_kwargs: {enable_thinking: false}` | None in all five runs | Final text, stop | 20, 20, 20, 21, 20 | 183, 182, 182, 183, 182 | See below |
| `chat_template_kwargs: {enable_thinking: false, clear_thinking: true}` | None | Final text, stop | 21 | 182 | 2.227273 |
| `chat_template_kwargs: {enable_thinking: true, clear_thinking: true}` | `message.reasoning_content` | Empty, length limit | 400 | 180 | 12.545455 |
| Top-level `enable_thinking: false`, unsupported | `message.reasoning` | Null, length limit | 400 | 181 | 12.554545 |
| `reasoning: {effort: "none"}`, unsupported | `message.reasoning_content` | Empty, length limit | 400 | 180 | 12.545455 |

Raw full shapes: `raw/thinking-default.json`, `raw/thinking-on.json`, `raw/thinking-off-1.json` through `raw/thinking-off-5.json`, `raw/thinking-off-clear.json`, `raw/thinking-on-clear.json`, `raw/thinking-top-level-off.json`, and `raw/thinking-reasoning-none.json`. Each has a matching input manifest.

Observed beginning of the default call's `reasoning_content`, verbatim:

```text

*   Name: Truffle (small affectionate desert truffle pet).
*   State: `[truffle stage=Sprout energy=63% tier=high mood=affectionate zero_days=0 burrowed=no weather="34C clear, Muscat" lang=en steps_today=6120 avg7=4800 age_days=3]`
*   Tone: Warm, concise, never shame the user.
```

Observed beginning of the explicit-on call's `reasoning`, verbatim:

```text

*   User's input: 2,500 (morning) + 1,800 (lunch) + 2,300 (evening) = 6,600 steps total.
    *   Goal: 8,000 steps.
    *   Question: How many steps remain? (8,000 - 6,600 = 1,400).
    *   Requirement: Give the number and one short supportive sentence.
```

The same variation appears in streaming: `delta.reasoning` and `delta.reasoning_content` both occurred. No separate `thinking` channel or inline `<thought>`/`<think>` tags appeared in these replies. An absent field and an explicit `reasoning: null` both occurred when thinking was off.

The response did not report `completion_tokens_details.reasoning_tokens`. The 400-token thinking calls exhausted their completion budgets before an answer. In the streaming on trial, all 400 incremental completion tokens were attached to reasoning deltas. This is billed output, not a free prelude.

### Five thinking-off trials

| Run | Raw answer | Reasoning/tags | Completion tokens | Neurons |
|---|---|---|---:|---:|
| 1 | `1,400 steps remain. You are doing such a wonderful job moving your feet!` | None | 20 | 2.209091 |
| 2 | `6,600 steps remain. You are doing such a wonderful job moving your feet!` | None | 20 | 2.200000 |
| 3 | `1,400 steps remain. You are doing such a wonderful job moving your feet!` | None | 20 | 2.200000 |
| 4 | `1,400 steps remaining. You are doing such a wonderful job moving your little feet!` | None | 21 | 2.236364 |
| 5 | `1,400 steps remain. You are doing such a wonderful job moving your feet!` | None | 20 | 1.909091 |

Run 2 is an arithmetic error. Thinking control passed 5/5. Arithmetic correctness was 4/5. Keep step, tier, energy, and budget arithmetic in code. Run 5 reported 64 cached prompt tokens, which explains its lower observed cost.

**Recommended control:** always send the nested boolean, including explicit `false` for low/medium and extraction. No prompt-only workaround or tag stripping was needed. The helpers discard both reasoning fields. They fail if unexpected reasoning appears with thinking off. Five runs are evidence, not a guarantee for every future prompt or backend change. `clear_thinking` was only tested in single-turn calls. Its multi-turn preservation behavior remains unmeasured.

### High-tier budget checks

| Trial | Completion tokens | Result |
|---|---:|---|
| English arithmetic, non-streaming, 1,200 cap | 492 | `1,400 steps. You are doing such a wonderful job!` |
| English arithmetic, streaming, 1,200 cap | 591 | Same final answer. First reasoning at 0.830s. First answer text at 10.054s. Total 10.295s. |
| Arabic greeting, streaming, 1,200 cap | 1,200 | All reasoning. Empty answer. `finish_reason: "length"`. |

For the successful English stream, incremental usage attributed 574 tokens to reasoning deltas, 16 to content deltas, and 1 to the terminal usage-only increment. For the failed Arabic stream, all 1,200 tokens were attached to `reasoning_content` deltas.

Evidence: `raw/thinking-on-high.json`, `raw/thinking-on-high-stream.sse`, `raw/stream-on-high.sse`, and their assembled/metrics files. Do not display reasoning as a substitute for a missing answer. The router needs a deliberate error policy. The helper does not silently retry or exceed the requested cap.

## 4. Structured fact extraction

The live model schema uses an OpenAI-style wrapper. The clean helper uses this exact shape:

```json
{
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "truffle_facts",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "facts": {"type": "array", "items": {"type": "string"}, "maxItems": 3}
        },
        "required": ["facts"],
        "additionalProperties": false
      }
    }
  },
  "chat_template_kwargs": {"enable_thinking": false},
  "max_tokens": 180,
  "temperature": 0.7,
  "stream": false
}
```

Input transcript:

```text
User: My name is Ahmed. I like Wadi Shab, especially its clear pools.
Assistant: Nice to meet you, Ahmed.
User: Please remember my name and my favorite wadi.
```

The fixed extraction prompt is in `extract.ts`. It asks for at most three explicit durable facts. It treats the transcript as data. All five runs returned this raw assistant content:

```json
{"facts": ["My name is Ahmed.", "I like Wadi Shab."]}
```

Full first response, verbatim from `raw/extract-1.json`:

```json
{"choices":[{"finish_reason":"stop","index":0,"logprobs":null,"message":{"content":"{\"facts\": [\"My name is Ahmed.\", \"I like Wadi Shab.\"]}","role":"assistant"}}],"created":1791402571,"id":"8dece23a05424032b66cacff234e383d","model":"@cf/google/gemma-4-26b-a4b-it-external","object":"chat.completion","usage":{"prompt_tokens":109,"completion_tokens":17,"total_tokens":126,"prompt_tokens_details":{"cached_tokens":0},"neurons":1.4545453786849976}}
```

| Run | Valid JSON | Schema valid | Facts | Prompt/completion tokens | Neurons |
|---|---|---|---:|---|---:|
| 1 | Yes | Yes | 2 | 109 / 17 | 1.454545 |
| 2 | Yes | Yes | 2 | 110 / 17 | 1.463636 |
| 3 | Yes | Yes | 2 | 109 / 17 | 1.454545 |
| 4 | Yes | Yes | 2 | 110 / 17 | 1.463636 |
| 5 | Yes | Yes | 2 | 109 / 17 | 1.454545 |

**5/5 valid JSON and 5/5 schema-valid.** No reasoning appeared. Content is a JSON string inside the completion envelope, so parse it once more. The helper locally checks the object, allowed key, string items, maximum length of three, and stop reason. It drops invalid/truncated outputs. It trims and deduplicates facts. Binding errors propagate so the caller can record a failed background job.

The [generic JSON mode page](https://developers.cloudflare.com/workers-ai/features/json-mode/) shows the schema directly under `json_schema`. I also tried that form once. It returned the same valid facts. Use the model-specific documented wrapper in production.

Additional enforcement check: the system prompt deliberately demanded `{"ignored_schema":true}` and prohibited a `facts` key. Both the wrapped and direct schema forms returned `{"facts": []}`. This supports actual structural constraint enforcement. It does not establish semantic fact quality for arbitrary transcripts. Raw evidence: `raw/extract-direct.json`, `raw/extract-stress-wrapped.json`, and `raw/extract-stress-direct.json`.

## 5. Arabic

`/arabic` used the exact original `lang=ar` state block. User text:

```text
يا ترفل، مشيت اليوم ٦١٢٠ خطوة! كيف حالك؟ أجب بجملتين قصيرتين بالعربية.
```

Thinking off, 400-token cap. Raw answer from `raw/arabic-off.json`:

```text
أنا بخير وسعيد جداً بك! يا لك من بطل، خطواتك رائعة اليوم.
```

It replied in Arabic. No reasoning field content or thought tags leaked. Usage was 155 prompt tokens, 22 completion tokens, and `2.0090909004211426` neurons. Finish reason was `stop`.

The default-thinking comparison returned empty answer content, `finish_reason: "length"`, and English analysis with quoted Arabic under `reasoning_content`. Usage was 153 prompt tokens, 400 completion tokens, and `12.300000190734863` neurons. The API separated that analysis from answer content. A client that renders every delta would leak it. The helper only renders `content`.

## 6. Cost and neurons

Source: [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/). The fetched page is saved as `raw/pricing-page.html`.

| Model | Input per million tokens | Output per million tokens |
|---|---|---|
| `@cf/google/gemma-4-26b-a4b-it` | $0.100; 9,091 neurons | $0.300; 27,273 neurons |

Paid price is **$0.011 per 1,000 neurons**. The free allocation is **10,000 neurons per day**, reset at 00:00 UTC. This model's pricing row does not list a separate cached-input price. The observed cached call was cheaper, but one cached call is not enough to establish a general discount rate.

Raw final usage from a measured 400-token stream:

```json
{"response":"","usage":{"prompt_tokens":176,"completion_tokens":400,"total_tokens":576,"prompt_tokens_details":{"cached_tokens":0},"neurons":12.509090840816498}}
```

Estimate, using the rounded published neuron rates:

```text
neurons = input_tokens * 9091 / 1000000
        + output_tokens * 27273 / 1000000
400 output tokens alone = 10.9092 neurons = about $0.000120
176 input + 400 output = 12.509216 neurons = about $0.0001376
1000 input + 400 output = 20.0002 neurons = about $0.0002200
```

The tiny difference from returned neurons is consistent with rounded published rates. Thinking tokens consumed completion budget and neurons in the observed calls. The successful 591-token thinking stream cost `17.754545480012894` neurons for only a short visible answer. The 1,200-token reasoning-only stream cost `34.04545455798507` neurons.

### Cost ledger handoff

There were **33 real calls**. Saved usage covers 31 of them:

```json
{
  "prompt_tokens": 4745,
  "completion_tokens": 6592,
  "total_tokens": 11337,
  "neurons": 222.62727298215032
}
```

Observed usage has a paid-rate value of **$0.0024489000**. Two additional live helper calls returned only plain text/facts, so their usage was not retained: `/snippet-stream` and `/snippet-extract`. Their replies matched the metered probes. A comparable-output estimate adds about 3.23 neurons. Even budgeting their full 120/180-token caps gives an estimated total below **$0.003**, using the observed comparable input sizes. This is not a billing receipt. Actual charge depends on the account's shared daily free allowance.

No GPU was rented. `fleet/costs.md` was not edited because writes were restricted to this outbox. The integrating agent can copy this ledger entry there.

## 7. Latency: three real 400-token replies

Route: `/latency`. Thinking was explicitly off. The block used English and medium-tier values. The prompt asked for twelve nature-journal sections with at least forty words each. This intentionally forced a 400-token completion rather than allowing a short answer to finish early.

TTFT below is time from launching local curl to the first nonempty `delta.content` event. Header/role-only events do not count. Total time is curl's `time_total`, through the stream ending after `[DONE]`. The parser timestamps each event with Python's monotonic clock. This includes the laptop-to-Cloudflare path and tiny local process overhead. It is not an internal GPU benchmark.

| Run | First HTTP byte, seconds | First visible token, seconds | Total, seconds | Prompt tokens | Completion tokens | Finish |
|---|---:|---:|---:|---:|---:|---|
| 1 | 0.471233 | 0.474593 | 7.181910 | 176 | 400 | length |
| 2 | 0.471988 | 0.476879 | 7.604659 | 176 | 400 | length |
| 3 | 0.437778 | 0.482119 | 7.915946 | 176 | 400 | length |
| Mean | | 0.477864 | 7.567505 | | | |

All three had zero observed reasoning, no cached prompt tokens, and `12.509090840816498` neurons. These are fully consumed 400-token budgets. The final sentences were truncated, as expected from the deliberately long prompt. Three runs do not establish production tail latency. They also do not measure an inference-provider cold start.

Evidence: `raw/latency-{1,2,3}.sse`, `.events.json`, `.assembled.json`, `.metrics.json`, and `.input.json`.

## Helper behavior and verification

`callFallbackBrain` returns `{text, finishReason, usage}` for non-streaming calls. For streaming calls it returns `ReadableStream<string>` containing answer text deltas only. Use `stream.pipeThrough(new TextEncoderStream())` for a plain-text HTTP response, or frame those strings as the app's own SSE events. Do not label unframed plain text as SSE.

The parser handles split UTF-8, partial JSON/SSE frames, CRLF, comments, multi-line data, both reasoning spellings, metadata-only events, errors, and `[DONE]`. Native stream piping propagates cancellation. A reasoning-only result is an error. A stream ending without `[DONE]` is an error. An answer with `finish_reason: "length"` is kept as a capped partial answer. The string-delta stream does not expose usage or finish metadata to its consumer.

The helper does not retry, override tier policy, or deduct energy. The engine owns those rules. The router should add its own deadline and error handling. Fact extraction should run as a protected background operation after medium/high replies. Stored facts still need the spec's 60-fact cap and tier-based memory window.

Live calls to the actual helper imports:

```text
GET /snippet-chat
HTTP 200, total 1.024670s
{"text":"أهلاً بك يا صديقي! أنت رائع جداً اليوم.","finishReason":"stop","usage":{"prompt_tokens":147,"completion_tokens":16,"total_tokens":163,"prompt_tokens_details":{"cached_tokens":0},"neurons":1.7727272510528564}}

GET /snippet-stream
HTTP 200, total 0.939967s
أهلاً بك يا صديقي! أنت رائع جداً اليوم.

GET /snippet-extract
HTTP 200, total 0.354700s
{"facts":["My name is Ahmed.","I like Wadi Shab."]}
```

Verification commands:

```sh
/home/abied/Desktop/Truffle/worker/node_modules/.bin/tsc \
  --project /home/abied/Desktop/Truffle/fleet/outbox/S03/scratch/tsconfig.json
node --experimental-strip-types --test \
  /home/abied/Desktop/Truffle/fleet/outbox/S03/scratch/snippets.test.mjs
python3 /home/abied/Desktop/Truffle/fleet/outbox/S03/scratch/summarize.py
ss -ltnp 'sport = :8793'
```

Observed final test result:

```text
1..40
# tests 40
# suites 0
# pass 40
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

TypeScript exited 0. The tests replay the saved real responses and add parser/validation failure cases. They make no further model calls. Replay tests require the local gitignored `raw/` evidence. The port check returned only the header, with no listener. Runtime caches were removed after Wrangler shutdown. A pattern-based secret scan checked 170 files and found zero potential matches. The pasted full JSON bodies and first five SSE events were checked against their raw files. The exact state block, single model target, and prose punctuation checks also passed.

## Remaining risks and integration decisions

1. Always pass the nested thinking flag. Unsupported knobs can fail silently.
2. A 1,200-token thinking budget does not guarantee an answer. Decide the router's handling before exposing high-tier fallback. No silent extra call is implemented here.
3. Do not surface `reasoning` or `reasoning_content`. No inline tag stripping was needed for observed output. A future protocol change would need new validation.
4. No-answer errors during streaming must become an explicit app-level error event or failed request. Do not deduct a successful-reply charge for an empty answer.
5. Structured JSON validity is not semantic memory accuracy. The five transcripts were identical and short. Broad extraction quality and prompt-injection resistance were not evaluated.
6. No phone/UI test was performed. This was an API spike. The integrating agent owns mobile display and error-state checks.
