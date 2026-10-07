import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { callFallbackBrain } from "../snippet.ts";
import { extractFacts } from "../extract.ts";

const raw = new URL("../raw/", import.meta.url);
const load = (file) => readFileSync(new URL(file, raw), "utf8");
const json = (file) => JSON.parse(load(file));
const messages = [{ role: "user", content: "Hello" }];
const options = { maxTokens: 120, thinking: false, stream: false };
function fakeAi(value) {
  const calls = [];
  return { calls, async run(...args) { calls.push(args); return value; } };
}
function bytes(text, stride = 71, cancel) {
  const data = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= data.length) return controller.close();
      controller.enqueue(data.slice(offset, offset + stride));
      offset += stride;
    },
    cancel,
  });
}
async function collect(stream) {
  const reader = stream.getReader();
  const output = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      assert.equal(typeof value, "string");
      output.push(value);
    }
    return output.join("");
  } finally {
    reader.releaseLock();
  }
}
const sse = (value) => `data: ${JSON.stringify(value)}\n\n`;
const delta = (value) => ({ choices: [{ index: 0, delta: value, finish_reason: null }] });
const response = (content, extra = {}) => ({
  choices: [{ index: 0, finish_reason: "stop", message: { content, ...extra } }],
});

for (const fixture of ["chat", "arabic-off", "thinking-off-1", "thinking-off-2"]) {
  test(`non-streaming replay: ${fixture}`, async () => {
    const result = json(fixture + ".json");
    const ai = fakeAi(result);
    const parsed = await callFallbackBrain(ai, "system", messages, options);
    assert.equal(parsed.text, result.choices[0].message.content);
    assert.deepEqual(parsed.usage, result.usage);
    assert.equal(parsed.finishReason, "stop");
    assert.equal(ai.calls[0][0], "@cf/google/gemma-4-26b-a4b-it");
    assert.deepEqual(ai.calls[0][1].chat_template_kwargs, { enable_thinking: false });
    assert.equal(ai.calls[0][1].max_tokens, 120);
    assert.equal(ai.calls[0][1].messages[0].role, "system");
    assert.ok(!("reasoning" in parsed));
  });
}

test("thinking on returns only final answer, never analysis", async () => {
  const result = json("thinking-on-high.json");
  const ai = fakeAi(result);
  const parsed = await callFallbackBrain(ai, "system", messages, { ...options, thinking: true, maxTokens: 1200 });
  assert.equal(parsed.text, result.choices[0].message.content);
  assert.deepEqual(Object.keys(parsed).sort(), ["finishReason", "text", "usage"]);
  assert.equal(ai.calls[0][1].chat_template_kwargs.enable_thinking, true);
});

for (const fixture of ["thinking-on", "thinking-default"]) {
  test(`reasoning-only response is an error: ${fixture}`, async () => {
    await assert.rejects(callFallbackBrain(fakeAi(json(fixture + ".json")), "system", messages,
      { ...options, thinking: true }), /no answer text/);
    await assert.rejects(callFallbackBrain(fakeAi(json(fixture + ".json")), "system", messages,
      options), /reasoning with thinking disabled/);
  });
}

for (const fixture of ["stream-off", "latency-1", "latency-2", "latency-3"]) {
  test(`fragmented UTF-8 and SSE replay: ${fixture}`, async () => {
    const ai = fakeAi(bytes(load(fixture + ".sse"), fixture === "stream-off" ? 1 : 113));
    const stream = await callFallbackBrain(ai, "system", messages, { ...options, stream: true });
    assert.equal(await collect(stream), json(fixture + ".assembled.json").content);
    assert.equal(ai.calls[0][1].stream_options.include_usage, true);
  });
}

for (const fixture of ["stream-on", "stream-on-high"]) {
  test(`reasoning-only SSE is an error, not blank success: ${fixture}`, async () => {
    const stream = await callFallbackBrain(fakeAi(bytes(load(fixture + ".sse"))), "system", messages,
      { ...options, stream: true, thinking: true });
    await assert.rejects(collect(stream), /no answer text/);
  });
}

test("replay completed high-tier SSE without surfacing its reasoning", async () => {
  const fixture = "thinking-on-high-stream";
  const stream = await callFallbackBrain(fakeAi(bytes(load(fixture + ".sse"), 37)), "system", messages,
    { ...options, stream: true, thinking: true, maxTokens: 1200 });
  assert.equal(await collect(stream), json(fixture + ".assembled.json").content);
});

test("thinking SSE keeps only content from both observed reasoning fields", async () => {
  const stream = await callFallbackBrain(fakeAi(bytes(
    sse(delta({ reasoning: "private one" })) + sse(delta({ reasoning_content: "private two" })) +
    sse(delta({ content: "أهلاً" })) + "data: [DONE]\n\n", 1)), "system", messages,
  { ...options, stream: true, thinking: true });
  assert.equal(await collect(stream), "أهلاً");
});

test("CRLF, multi-line data, comments, and multiple events per chunk", async () => {
  const data = ': heartbeat\r\n\r\ndata: {"choices":\r\ndata: [{"index":0,"delta":{"content":"ok"}}]}\r\n\r\ndata: [DONE]\r\n\r\n';
  const stream = await callFallbackBrain(fakeAi(bytes(data, 4096)), "system", messages,
    { ...options, stream: true });
  assert.equal(await collect(stream), "ok");
});

for (const key of ["reasoning", "reasoning_content"]) {
  test(`fail closed if thinking-off stream contains ${key}`, async () => {
    const stream = await callFallbackBrain(fakeAi(bytes(sse(delta({ [key]: "not allowed" })) + "data: [DONE]\n\n")),
      "system", messages, { ...options, stream: true });
    await assert.rejects(collect(stream), /reasoning with thinking disabled/);
  });
}

for (const [name, data, pattern] of [
  ["unterminated", sse(delta({ content: "partial" })), /ended before/],
  ["error", sse({ error: { message: "failed" } }), /error frame/],
  ["malformed", "data: {broken}\n\n", /JSON|Unexpected|Expected/],
  ["wrong shape", sse({ unexpected: true }), /Unexpected Workers AI SSE shape/],
]) {
  test(`reject bad SSE: ${name}`, async () => {
    const stream = await callFallbackBrain(fakeAi(bytes(data)), "system", messages,
      { ...options, stream: true });
    await assert.rejects(collect(stream), pattern);
  });
}

test("downstream cancellation cancels the upstream binding stream", async () => {
  let canceled;
  const source = new ReadableStream({ cancel(reason) { canceled = reason; } });
  const stream = await callFallbackBrain(fakeAi(source), "system", messages, { ...options, stream: true });
  await stream.cancel("user left");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(canceled, "user left");
});

test("bad token caps and empty replies fail before rendering", async () => {
  const ai = fakeAi(response(""));
  for (const maxTokens of [0, -1, 1.5, NaN]) {
    await assert.rejects(callFallbackBrain(ai, "system", messages, { ...options, maxTokens }), RangeError);
  }
  assert.equal(ai.calls.length, 0);
  await assert.rejects(callFallbackBrain(ai, "system", messages, options), /no answer text/);
});

for (let i = 1; i <= 5; i++) {
  test(`extract replay validates real output ${i}`, async () => {
    const ai = fakeAi(json(`extract-${i}.json`));
    assert.deepEqual(await extractFacts(ai, "transcript"), ["My name is Ahmed.", "I like Wadi Shab."]);
    const input = ai.calls[0][1];
    assert.equal(input.chat_template_kwargs.enable_thinking, false);
    assert.equal(input.response_format.json_schema.strict, true);
    assert.equal(input.response_format.json_schema.schema.properties.facts.maxItems, 3);
  });
}

for (const content of [
  '{"facts":["a","b","c","d"]}', '{"facts":[2]}', '{"facts":[""]}',
  '{"facts":["ok"],"other":true}', '{"other":[]}', '```json\n{"facts":["a"]}\n```',
  '["a"]', 'null', '{"facts":',
]) {
  test(`invalid extraction discarded: ${content}`, async () => {
    assert.deepEqual(await extractFacts(fakeAi(response(content)), "transcript"), []);
  });
}

test("empty transcript, duplicate facts, truncation, and unexpected reasoning", async () => {
  const unused = fakeAi(null);
  assert.deepEqual(await extractFacts(unused, "  "), []);
  assert.equal(unused.calls.length, 0);
  assert.deepEqual(await extractFacts(fakeAi(response('{"facts":[" a ","a"]}')), "transcript"), ["a"]);
  assert.deepEqual(await extractFacts(fakeAi(response('{"facts":[]}')), "transcript"), []);
  const truncated = response('{"facts":["a"]}');
  truncated.choices[0].finish_reason = "length";
  assert.deepEqual(await extractFacts(fakeAi(truncated), "transcript"), []);
  for (const key of ["reasoning", "reasoning_content"]) {
    assert.deepEqual(await extractFacts(fakeAi(response('{"facts":["a"]}', { [key]: "unexpected" })), "transcript"), []);
  }
});

test("binding errors propagate so the caller can track extraction failures", async () => {
  const ai = { async run() { throw new Error("binding unavailable"); } };
  await assert.rejects(extractFacts(ai, "transcript"), /binding unavailable/);
});
