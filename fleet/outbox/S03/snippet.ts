// Workers AI binding types supply the global Ai type.
// Tested with @cf/google/gemma-4-26b-a4b-it on 2026-10-07.
const FALLBACK_MODEL = "@cf/google/gemma-4-26b-a4b-it";

export type FallbackMessage = {
  role: "user" | "assistant";
  content: string;
};

export type FallbackOptions = {
  maxTokens: number;
  thinking: boolean;
  stream: boolean;
};

export type FallbackReply = {
  text: string;
  finishReason: string | null;
  // Preserves token counts, cached_tokens, and neurons without double counting.
  usage?: Record<string, unknown>;
};

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function assertNoUnexpectedReasoning(message: JsonObject, thinking: boolean): void {
  // Both spellings occurred in real responses. Never display either field.
  if (!thinking && [message.reasoning, message.reasoning_content].some(
    (value) => typeof value === "string" && value.trim().length > 0,
  )) {
    throw new Error("Fallback returned reasoning with thinking disabled");
  }
}

function assertSuccessfulFrame(frame: JsonObject): void {
  if (frame.error || frame.success === false || (Array.isArray(frame.errors) && frame.errors.length)) {
    throw new Error("Workers AI returned an error frame");
  }
}

function textDeltas(source: ReadableStream<Uint8Array>, thinking: boolean): ReadableStream<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;
  let hasText = false;
  let finishReason: string | null = null;

  function event(raw: string, controller: TransformStreamDefaultController<string>): void {
    const data = raw.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data || done) return;
    if (data === "[DONE]") {
      done = true;
      if (!hasText) {
        throw new Error(`Fallback produced no answer text (finish_reason=${finishReason})`);
      }
      return;
    }
    const frame = object(JSON.parse(data));
    if (!frame) throw new Error("Invalid Workers AI SSE frame");
    assertSuccessfulFrame(frame);
    // Ignore usage-only frames, including the final cumulative {response:"",usage}.
    if (!Array.isArray(frame.choices)) {
      if (object(frame.usage)) return;
      throw new Error("Unexpected Workers AI SSE shape");
    }
    for (const value of frame.choices) {
      const choice = object(value);
      if (!choice || choice.index !== 0) continue;
      if (typeof choice.finish_reason === "string") finishReason = choice.finish_reason;
      const delta = object(choice.delta);
      if (!delta) continue;
      assertNoUnexpectedReasoning(delta, thinking);
      if (typeof delta.content === "string" && delta.content.length > 0) {
        hasText = true;
        controller.enqueue(delta.content);
      }
    }
  }

  function drain(controller: TransformStreamDefaultController<string>): void {
    let boundary: RegExpExecArray | null;
    while ((boundary = /\r?\n\r?\n/.exec(buffer)) !== null) {
      const raw = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      event(raw, controller);
    }
  }

  // Native pipeThrough propagates errors and downstream cancellation upstream.
  // Incremental decoding also handles Arabic UTF-8 split across network chunks.
  return source.pipeThrough(new TransformStream<Uint8Array, string>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      drain(controller);
    },
    flush(controller) {
      buffer += decoder.decode();
      drain(controller);
      if (buffer.trim()) event(buffer, controller);
      if (!done) throw new Error("Workers AI SSE ended before [DONE]");
    },
  }));
}

export function callFallbackBrain(
  ai: Ai, system: string, messages: readonly FallbackMessage[],
  opts: FallbackOptions & { stream: true },
): Promise<ReadableStream<string>>;
export function callFallbackBrain(
  ai: Ai, system: string, messages: readonly FallbackMessage[],
  opts: FallbackOptions & { stream: false },
): Promise<FallbackReply>;
export function callFallbackBrain(
  ai: Ai, system: string, messages: readonly FallbackMessage[], opts: FallbackOptions,
): Promise<FallbackReply | ReadableStream<string>>;
export async function callFallbackBrain(
  ai: Ai, system: string, messages: readonly FallbackMessage[], opts: FallbackOptions,
): Promise<FallbackReply | ReadableStream<string>> {
  if (!Number.isInteger(opts.maxTokens) || opts.maxTokens < 1) {
    throw new RangeError("maxTokens must be a positive integer");
  }
  // The engine must choose the tier and token cap. Never infer them from user text.
  // max_tokens includes reasoning tokens. A 400-token thinking call can be all thought.
  const result: unknown = await ai.run(FALLBACK_MODEL, {
    messages: [{ role: "system", content: system }, ...messages.map(({ role, content }) => ({ role, content }))],
    max_tokens: opts.maxTokens,
    temperature: 0.7,
    stream: opts.stream,
    chat_template_kwargs: { enable_thinking: opts.thinking },
    ...(opts.stream ? { stream_options: { include_usage: true } } : {}),
  });

  if (opts.stream) {
    if (!(result instanceof ReadableStream)) throw new Error("Workers AI did not return an SSE stream");
    return textDeltas(result as ReadableStream<Uint8Array>, opts.thinking);
  }
  if (result instanceof ReadableStream) {
    await result.cancel();
    throw new Error("Workers AI unexpectedly returned a stream");
  }
  const frame = object(result);
  if (!frame) throw new Error("Invalid Workers AI response");
  assertSuccessfulFrame(frame);
  const choice = Array.isArray(frame.choices) ? object(frame.choices[0]) : undefined;
  const message = object(choice?.message);
  if (!message) throw new Error("Workers AI response has no assistant message");
  assertNoUnexpectedReasoning(message, opts.thinking);
  const text = typeof message.content === "string" ? message.content : "";
  const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
  if (!text.trim()) throw new Error(`Fallback produced no answer text (finish_reason=${finishReason})`);
  return { text, finishReason, usage: object(frame.usage) };
}
