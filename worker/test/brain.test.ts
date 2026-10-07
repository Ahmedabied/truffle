import { describe, expect, it, vi } from "vitest";
import { askBrain, chunkText, extractFacts, FALLBACK_MODEL, ThoughtStripper, type BrainRequest } from "../src/brain";
import type { Env } from "../src/types";

const enc = new TextEncoder();

/** A Workers-AI-shaped SSE byte stream, as measured on gemma-4-26b-a4b-it. */
function sse(parts: string[], reasoning: string[] = []): ReadableStream<Uint8Array> {
  const lines = [
    ...reasoning.map((r) => `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: r } }] })}\n\n`),
    ...parts.map((p) => `data: ${JSON.stringify({ choices: [{ delta: { content: p, reasoning_content: null } }] })}\n\n`),
    `data: ${JSON.stringify({ response: "", usage: {} })}\n\n`,
    "data: [DONE]\n\n"
  ];
  return new ReadableStream({
    start(c) {
      for (const l of lines) c.enqueue(enc.encode(l));
      c.close();
    }
  });
}

async function readAll(s: ReadableStream<string>): Promise<string> {
  let out = "";
  const r = s.getReader();
  for (;;) {
    const { value, done } = await r.read();
    if (done) return out;
    out += value;
  }
}

function mockEnv(over: Partial<Env> = {}) {
  const run = vi.fn(async (_model: string, _input: unknown) => sse(["sleepy ", "hello"], ["thinking hard"]));
  const env = { AI: { run } as unknown as Ai, TRUFFLE: {} as never, BRAIN_TIMEOUT_MS: "50", ...over } as Env;
  return { env, run };
}

const req: BrainRequest = {
  system: "sys",
  messages: [{ role: "user", content: "hi" }],
  tier: "low",
  thinking: false,
  maxTokens: 120,
  lang: "en"
};

/** fetch that never answers until aborted. */
const hangingFetch = ((_url: string, init?: RequestInit) =>
  new Promise((_res, rej) => {
    init?.signal?.addEventListener("abort", () => rej(new Error("aborted")));
  })) as unknown as typeof fetch;

describe("brain routing", () => {
  it("Modal timeout falls back to Workers AI, half awake", async () => {
    const { env, run } = mockEnv({ MODAL_URL: "https://modal.example", MODAL_TOKEN: "t" });
    const t0 = Date.now();
    const r = await askBrain(env, req, hangingFetch);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(r.brain).toBe("workers-ai");
    expect(r.half_awake).toBe(true);
    expect(r.fallback_reason).toMatch(/timeout|abort/);
    expect(await readAll(r.stream)).toBe("sleepy hello"); // reasoning dropped
    const [model, input] = run.mock.calls[0] as [string, Record<string, unknown>];
    expect(model).toBe(FALLBACK_MODEL);
    expect(input.stream).toBe(true);
    expect(input.max_tokens).toBe(120);
    expect(input.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect((input.messages as { role: string }[])[0]).toEqual({ role: "system", content: "sys" });
  });

  it("Modal 5xx falls back", async () => {
    const { env } = mockEnv({ MODAL_URL: "https://modal.example" });
    const f = (async () => new Response("boom", { status: 503 })) as unknown as typeof fetch;
    const r = await askBrain(env, req, f);
    expect(r.brain).toBe("workers-ai");
    expect(r.fallback_reason).toBe("modal http 503");
  });

  it("network error falls back", async () => {
    const { env } = mockEnv({ MODAL_URL: "https://modal.example" });
    const f = (async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;
    expect((await askBrain(env, req, f)).half_awake).toBe(true);
  });

  it("MODAL_URL unset goes straight to Workers AI without fetching", async () => {
    const { env } = mockEnv();
    const f = vi.fn();
    const r = await askBrain(env, req, f as unknown as typeof fetch);
    expect(f).not.toHaveBeenCalled();
    expect(r.brain).toBe("workers-ai");
    expect(r.fallback_reason).toBe("MODAL_URL unset");
  });

  it("healthy Modal answers, not half awake, with the right request", async () => {
    const { env, run } = mockEnv({ MODAL_URL: "https://modal.example/", MODAL_TOKEN: "tok" });
    let seen: { url: string; init: RequestInit } | undefined;
    const f = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(sse(["I am ", "awake"], ["hmm"]), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await askBrain(env, { ...req, tier: "high", thinking: true, maxTokens: 1200 }, f);
    expect(r.brain).toBe("modal");
    expect(r.half_awake).toBe(false);
    expect(await readAll(r.stream)).toBe("I am awake");
    expect(run).not.toHaveBeenCalled();
    expect(seen!.url).toBe("https://modal.example/v1/chat/completions");
    expect((seen!.init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    const b = JSON.parse(seen!.init.body as string);
    expect(b.model).toBe("truffle");
    expect(b.stream).toBe(true);
    expect(b.chat_template_kwargs).toEqual({ enable_thinking: true });
    expect(b.max_tokens).toBeGreaterThan(1200); // thinking budget on top
  });
});

describe("stream helpers", () => {
  it("chunkText reads delta.content and legacy response, drops reasoning", () => {
    expect(chunkText('{"choices":[{"delta":{"content":"hi"}}]}')).toBe("hi");
    expect(chunkText('{"choices":[{"delta":{"reasoning_content":"secret"}}]}')).toBe("");
    expect(chunkText('{"response":"yo"}')).toBe("yo");
    expect(chunkText("[DONE]")).toBe("");
    expect(chunkText("not json")).toBe("");
  });
  it("ThoughtStripper removes inline thought blocks across chunks", () => {
    const s = new ThoughtStripper();
    const out = ["Hel", "lo <tho", "ught>plan plan</th", "ought> world", " <b>ok"].map((c) => s.push(c)).join("") + s.flush();
    expect(out).toBe("Hello  world <b>ok");
  });
});

describe("extractFacts", () => {
  it("parses the json_schema reply, max 3", async () => {
    const run = vi.fn(async () => ({
      choices: [{ message: { content: '{"facts":["Name is Ahmed","Loves wadis","a","b"]}' } }]
    }));
    const env = { AI: { run } } as unknown as Env;
    expect(await extractFacts(env, "human: I am Ahmed")).toEqual(["Name is Ahmed", "Loves wadis", "a"]);
    const input = (run.mock.calls[0] as unknown as [string, Record<string, unknown>])[1];
    expect((input.response_format as { type: string }).type).toBe("json_schema");
  });
  it("swallows every error", async () => {
    const env = { AI: { run: async () => { throw new Error("x"); } } } as unknown as Env;
    expect(await extractFacts(env, "t")).toEqual([]);
    const env2 = { AI: { run: async () => ({ choices: [{ message: { content: "not json" } }] }) } } as unknown as Env;
    expect(await extractFacts(env2, "t")).toEqual([]);
  });
});
