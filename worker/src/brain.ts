// Brain router. Modal (Gemma 4 31B + Truffle LoRA) first. Workers AI
// (Gemma 4 26B A4B) when Modal is unset, cold past the timeout, 5xx or down.
// The fallback is flagged half_awake so the UI can be honest about it.

import type { Tier } from "./config";
import type { Env, Lang } from "./types";

export const FALLBACK_MODEL = "@cf/google/gemma-4-26b-a4b-it";
export const DEFAULT_BRAIN_TIMEOUT_MS = 25_000;
/**
 * Reasoning tokens count against max_tokens on both vLLM and Workers AI
 * (measured on Workers AI: 277 of 300 tokens went to reasoning). When thinking
 * is on we add this budget so the visible reply keeps its tier length.
 */
export const THINKING_BUDGET_TOKENS = 1024;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface BrainRequest {
  system: string;
  messages: ChatMessage[];
  tier: Tier;
  thinking: boolean;
  maxTokens: number;
  lang: Lang;
}

export type BrainName = "modal" | "workers-ai";

export interface BrainResult {
  stream: ReadableStream<string>;
  brain: BrainName;
  half_awake: boolean;
  /** Why Modal was skipped, when it was. */
  fallback_reason?: string;
}

// ---------- stream parsing ----------

/** Split an SSE byte stream into `data:` payloads. */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).replace(/\r$/, "");
        buf = buf.slice(i + 1);
        if (line.startsWith("data:")) yield line.slice(5).trim();
      }
    }
    if (buf.startsWith("data:")) yield buf.slice(5).trim();
  } finally {
    reader.releaseLock();
  }
}

/**
 * Visible text in one chunk. OpenAI-style `choices[0].delta.content`, or the
 * legacy Workers AI `{response}` shape. Reasoning fields
 * (`reasoning_content`, `reasoning`) are dropped on purpose.
 */
export function chunkText(payload: string): string {
  if (!payload || payload === "[DONE]") return "";
  try {
    const j = JSON.parse(payload) as {
      choices?: { delta?: { content?: unknown } }[];
      response?: unknown;
    };
    const c = j.choices?.[0]?.delta?.content;
    if (typeof c === "string") return c;
    if (typeof j.response === "string") return j.response;
  } catch {
    // not JSON: ignore
  }
  return "";
}

/**
 * Removes inline reasoning blocks that some templates leak into content:
 * <think>..</think>, <thought>..</thought>. Works across chunk boundaries.
 */
export class ThoughtStripper {
  private buf = "";
  private inside = false;
  private static OPEN = /<(think|thought)>/;
  private static CLOSE = /<\/(think|thought)>/;

  push(text: string): string {
    this.buf += text;
    let out = "";
    for (;;) {
      if (this.inside) {
        const m = ThoughtStripper.CLOSE.exec(this.buf);
        if (!m) {
          this.buf = this.buf.slice(-12); // keep a possible partial close tag
          return out;
        }
        this.buf = this.buf.slice(m.index + m[0].length);
        this.inside = false;
      } else {
        const m = ThoughtStripper.OPEN.exec(this.buf);
        if (m) {
          out += this.buf.slice(0, m.index);
          this.buf = this.buf.slice(m.index + m[0].length);
          this.inside = true;
          continue;
        }
        // Hold back a trailing "<..." that could be the start of a tag.
        const lt = this.buf.lastIndexOf("<");
        if (lt >= 0 && this.buf.length - lt < 10) {
          out += this.buf.slice(0, lt);
          this.buf = this.buf.slice(lt);
        } else {
          out += this.buf;
          this.buf = "";
        }
        return out;
      }
    }
  }

  flush(): string {
    const rest = this.inside ? "" : this.buf;
    this.buf = "";
    return rest;
  }
}

/** Visible text deltas from an OpenAI-compatible SSE byte stream. */
function textStream(payloads: AsyncGenerator<string>, first?: string): ReadableStream<string> {
  const strip = new ThoughtStripper();
  let pending = first;
  return new ReadableStream<string>({
    async pull(controller) {
      try {
        for (;;) {
          let payload: string;
          if (pending !== undefined) {
            payload = pending;
            pending = undefined;
          } else {
            const n = await payloads.next();
            if (n.done) {
              const tail = strip.flush();
              if (tail) controller.enqueue(tail);
              controller.close();
              return;
            }
            payload = n.value;
          }
          const t = strip.push(chunkText(payload));
          if (t) {
            controller.enqueue(t);
            return;
          }
        }
      } catch (e) {
        controller.error(e);
      }
    },
    async cancel() {
      await payloads.return(undefined);
    }
  });
}

// ---------- routing ----------

function timeoutMs(env: Env): number {
  const n = Number(env.BRAIN_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BRAIN_TIMEOUT_MS;
}

function tokenLimit(req: BrainRequest): number {
  return req.maxTokens + (req.thinking ? THINKING_BUDGET_TOKENS : 0);
}

function allMessages(req: BrainRequest) {
  return [{ role: "system" as const, content: req.system }, ...req.messages];
}

async function askModal(env: Env, req: BrainRequest, fetchFn: typeof fetch): Promise<BrainResult> {
  const url = env.MODAL_URL!.replace(/\/+$/, "") + "/v1/chat/completions";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("modal first-token timeout")), timeoutMs(env));
  try {
    const res = await fetchFn(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        ...(env.MODAL_TOKEN ? { authorization: `Bearer ${env.MODAL_TOKEN}` } : {})
      },
      body: JSON.stringify({
        model: "truffle",
        messages: allMessages(req),
        max_tokens: tokenLimit(req),
        stream: true,
        temperature: 1.0,
        top_p: 0.95,
        top_k: 64,
        chat_template_kwargs: { enable_thinking: req.thinking }
      })
    });
    if (!res.ok || !res.body) throw new Error(`modal http ${res.status}`);
    const payloads = sseData(res.body);
    // Any first event (content or reasoning) proves the brain is awake.
    const first = await payloads.next();
    clearTimeout(timer);
    if (first.done) throw new Error("modal empty stream");
    return { stream: textStream(payloads, first.value), brain: "modal", half_awake: false };
  } catch (e) {
    clearTimeout(timer);
    ctrl.abort();
    throw e;
  }
}

async function askWorkersAI(env: Env, req: BrainRequest): Promise<ReadableStream<string>> {
  const out = (await env.AI.run(FALLBACK_MODEL as Parameters<Ai["run"]>[0], {
    messages: allMessages(req),
    max_tokens: tokenLimit(req),
    stream: true,
    temperature: 1.0,
    top_p: 0.95,
    // Thinking is ON by default for this model; low and medium must turn it off.
    chat_template_kwargs: { enable_thinking: req.thinking }
  } as never)) as unknown;
  if (!(out instanceof ReadableStream)) throw new Error("workers-ai did not stream");
  return textStream(sseData(out as ReadableStream<Uint8Array>));
}

export async function askBrain(
  env: Env,
  req: BrainRequest,
  fetchFn: typeof fetch = fetch
): Promise<BrainResult> {
  let reason = "MODAL_URL unset";
  if (env.MODAL_URL) {
    try {
      return await askModal(env, req, fetchFn);
    } catch (e) {
      reason = e instanceof Error ? e.message : String(e);
    }
  }
  const stream = await askWorkersAI(env, req);
  return { stream, brain: "workers-ai", half_awake: true, fallback_reason: reason };
}

// ---------- fact extraction ----------

const FACT_SCHEMA = {
  type: "object",
  properties: { facts: { type: "array", items: { type: "string" }, maxItems: 3 } },
  required: ["facts"],
  additionalProperties: false
};

const FACT_PROMPT =
  "You read a short chat between a human and their pet Truffle. " +
  "Extract at most 3 short, lasting facts about the human (name, likes, places, people, plans). " +
  "Each fact under 12 words, third person. Skip small talk. " +
  "Never record anything about weight, body or health numbers. " +
  'Return JSON {"facts": [...]}. Empty list if nothing new.';

/** Up to 3 facts from a transcript. Never throws: facts are optional. */
export async function extractFacts(env: Env, transcript: string): Promise<string[]> {
  try {
    const out = (await env.AI.run(FALLBACK_MODEL as Parameters<Ai["run"]>[0], {
      messages: [
        { role: "system", content: FACT_PROMPT },
        { role: "user", content: transcript.slice(0, 4000) }
      ],
      max_tokens: 200,
      chat_template_kwargs: { enable_thinking: false },
      response_format: {
        type: "json_schema",
        json_schema: { name: "facts", strict: true, schema: FACT_SCHEMA }
      }
    } as never)) as { choices?: { message?: { content?: unknown } }[]; response?: unknown };
    let raw: unknown = out?.choices?.[0]?.message?.content ?? out?.response;
    if (typeof raw === "string") raw = JSON.parse(raw);
    const facts = (raw as { facts?: unknown })?.facts;
    if (!Array.isArray(facts)) return [];
    return facts
      .filter((f): f is string => typeof f === "string")
      .map((f) => f.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120))
      .filter((f) => f.length > 0)
      .slice(0, 3);
  } catch {
    return [];
  }
}
