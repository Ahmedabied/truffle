import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, parseSSE, reachable, RealBackend, toChatEvent } from "../src/api";

const enc = new TextEncoder();
const creds = { phrase: "quiet moss", secret: "test-secret" };

function bytes(parts: string[]) {
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const part of parts) c.enqueue(enc.encode(part));
      c.close();
    }
  });
}

async function events(body: ReadableStream<Uint8Array>) {
  const out = [];
  for await (const event of parseSSE(body)) out.push(event);
  return out;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("chat event decoding", () => {
  it("keeps an event intact when CRLF is split between byte chunks", async () => {
    vi.stubGlobal("window", globalThis);
    expect(await events(bytes(['event: token\r', '\ndata: {"t":"hello"}\r', '\n\r', '\n']))).toEqual([
      { event: "token", data: '{"t":"hello"}' }
    ]);
  });

  it("decodes split UTF-8 and joins data lines", async () => {
    vi.stubGlobal("window", globalThis);
    const encoded = enc.encode("event: token\ndata: أهلاً\ndata: world\n\n");
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (const byte of encoded) c.enqueue(new Uint8Array([byte]));
        c.close();
      }
    });
    expect(await events(body)).toEqual([{ event: "token", data: "أهلاً\nworld" }]);
  });

  it("does not fabricate a terminal event from an interrupted SSE frame", async () => {
    vi.stubGlobal("window", globalThis);
    expect(await events(bytes(['event: done\ndata: {"tier":"low"}']))).toEqual([]);
  });

  it.each(["null", "[]", "42", "true"])("ignores a non-object JSON event: %s", (payload) => {
    expect(toChatEvent("done", payload)).toBeNull();
  });
});

describe("request lifecycle", () => {
  it("health timeout covers a stalled response body, not just headers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream())));
    const result = reachable("https://api.example", 50);
    await vi.advanceTimersByTimeAsync(51);
    expect(await Promise.race([result, Promise.resolve("still waiting")])).toBe(false);
  });

  it("state timeout covers a stalled JSON body", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream())));
    const outcome = new RealBackend("https://api.example").state(creds).catch((e) => e);
    await vi.advanceTimersByTimeAsync(12_001);
    expect(await Promise.race([outcome, Promise.resolve("still waiting")])).toMatchObject({ status: 0, message: "timeout" });
  });

  it("chat abort immediately cancels a silent response body", async () => {
    vi.stubGlobal("window", globalThis);
    const cancelled = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ cancel: cancelled }))));
    const ctrl = new AbortController();
    const chat = new RealBackend("https://api.example").chat(creds, "hello", "en", undefined, ctrl.signal);
    const pending = chat.next().catch((e) => e);
    await new Promise((resolve) => setTimeout(resolve, 0));
    ctrl.abort(new Error("conversation changed"));
    const result = await Promise.race([pending, new Promise((resolve) => setTimeout(() => resolve("still waiting"), 50))]);
    expect(result).toBeInstanceOf(Error);
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it("terminal chat events release a provider connection that stays open", async () => {
    vi.stubGlobal("window", globalThis);
    const cancelled = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({
      start(c) { c.enqueue(enc.encode('event: done\ndata: {"tier":"low","spent":20}\n\n')); },
      cancel: cancelled
    }))));
    const chat = new RealBackend("https://api.example").chat(creds, "hello", "en");
    expect((await chat.next()).value).toMatchObject({ type: "done", tier: "low", spent: 20 });
    const end = await Promise.race([chat.next(), new Promise((resolve) => setTimeout(() => resolve("still waiting"), 50))]);
    expect(end).toMatchObject({ done: true });
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it("preserves a structured API error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":"rest","retry_after_s":4}', { status: 429 })));
    await expect(new RealBackend("https://api.example").state(creds)).rejects.toMatchObject({
      status: 429, message: "rest", retry_after_s: 4
    } satisfies Partial<ApiError>);
  });
});
