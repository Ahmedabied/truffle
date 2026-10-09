import { afterEach, describe, expect, it, vi } from "vitest";
import { askBrain, type BrainRequest } from "../src/brain";
import type { Env } from "../src/types";

afterEach(() => vi.useRealTimers());

describe("bounded cold-provider wait", () => {
  it.each([["low", 4000], ["medium", 4000], ["high", 8000]] as const)("%s releases a cold provider at its deadline", async (tier, deadline) => {
    vi.useFakeTimers();
    const encoder = new TextEncoder();
    const fallback = vi.fn(async () => new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello."}}]}\n\ndata: [DONE]\n\n'));
        c.close();
      }
    }));
    let modalAborted = false;
    const fetchCold = ((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        modalAborted = true;
        reject(new Error("cold provider timeout"));
      }, { once: true });
    })) as typeof fetch;
    const env = { AI: { run: fallback }, MODAL_URL: "https://cold.example", BRAIN_TIMEOUT_MS: "25000" } as unknown as Env;
    const req: BrainRequest = { system: "test", messages: [{ role: "user", content: "Hello" }], tier,
      thinking: tier === "high", maxTokens: 120, lang: "en" };
    const pending = askBrain(env, req, fetchCold);
    await vi.advanceTimersByTimeAsync(deadline - 1);
    expect(fallback).not.toHaveBeenCalled();
    expect(modalAborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const answer = await pending;
    expect(modalAborted).toBe(true);
    expect(fallback).toHaveBeenCalledOnce();
    expect(answer).toMatchObject({ brain: "workers-ai", half_awake: true });
    const reader = answer.stream.getReader();
    let text = "";
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      text += next.value;
    }
    expect(text).toBe("Hello.");
  });
});
