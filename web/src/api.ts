// Typed client for the Truffle Worker. Chat is a POST that answers with SSE,
// so it is read with fetch + ReadableStream (EventSource only does GET).

import type { Backend, ChatEvent, Creds, Lang, PairResult, StateSummary, Tier } from "./types";
import { MockBackend } from "./mock";
import { ApiError, apiErrorFrom } from "./errors";
import { normalizeApiOrigin } from "./credentials";

const KEY_API = "truffle.api";
const REQUEST_TIMEOUT_MS = 12_000;
/** Max silence on the chat stream. A cold Modal brain plus fallback can take a while. */
const STREAM_IDLE_MS = 90_000;

export const DEFAULT_API: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ||
  (import.meta.env.DEV ? "http://localhost:8787" : "https://truffle.ahmed-abied.workers.dev");

export function apiBase(): string {
  try {
    return normalizeApiOrigin(localStorage.getItem(KEY_API) || "", import.meta.env.DEV) || DEFAULT_API;
  } catch {
    return DEFAULT_API;
  }
}

export function setApiBase(url: string): boolean {
  const origin = url.trim() ? normalizeApiOrigin(url, import.meta.env.DEV) : DEFAULT_API;
  if (!origin) return false;
  try {
    if (url.trim()) localStorage.setItem(KEY_API, origin);
    else localStorage.removeItem(KEY_API);
  } catch {
    /* storage blocked: the default stays */
  }
  return true;
}

export { ApiError };

async function withTimeout<T>(
  url: string,
  init: RequestInit,
  consume: (res: Response) => Promise<T>,
  ms = REQUEST_TIMEOUT_MS
): Promise<T> {
  const ctl = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const stop = () => ctl.abort(init.signal?.reason);
  init.signal?.throwIfAborted();
  init.signal?.addEventListener("abort", stop, { once: true });
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new ApiError(0, "timeout");
      ctl.abort(error);
      reject(error);
    }, ms);
  });
  try {
    // Keep the deadline alive through JSON/error-body consumption. Receiving
    // headers alone does not prove a health check or state request completed.
    return await Promise.race([fetch(url, { ...init, signal: ctl.signal }).then(consume), deadline]);
  } catch (e) {
    init.signal?.throwIfAborted();
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, ctl.signal.aborted ? "timeout" : "network");
  } finally {
    clearTimeout(timer!);
    init.signal?.removeEventListener("abort", stop);
  }
}

/** Read the Worker's {error, hint?, retry_after_s?} body (B06) into an ApiError. */
async function errorOf(res: Response): Promise<ApiError> {
  let text = "";
  try {
    text = await res.text();
  } catch {
    /* body unreadable: status only */
  }
  return apiErrorFrom(res.status, res.statusText, text);
}

/** Parse an SSE byte stream into {event, data} pairs. Handles \r\n and split chunks. */
export async function* parseSSE(
  body: ReadableStream<Uint8Array>,
  idleMs = STREAM_IDLE_MS,
  signal?: AbortSignal
): AsyncGenerator<{ event: string; data: string }> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  // Cancel the reader directly: generator.return() cannot interrupt a next()
  // that is already waiting on a silent network read.
  const stop = () => { void reader.cancel(signal?.reason).catch(() => {}); };
  signal?.addEventListener("abort", stop, { once: true });
  try {
    signal?.throwIfAborted();
    for (;;) {
      let timer: ReturnType<typeof setTimeout>;
      const idle = new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(new ApiError(0, "timeout")), idleMs);
      });
      const { value, done } = await Promise.race([reader.read(), idle]).finally(() => clearTimeout(timer!));
      signal?.throwIfAborted();
      if (value) buf += dec.decode(value, { stream: true });
      if (done) buf += dec.decode();
      // A trailing CR may be the first half of CRLF in the next byte chunk.
      const trailingCR = !done && buf.endsWith("\r");
      if (trailingCR) buf = buf.slice(0, -1);
      buf = buf.replace(/\r\n?/g, "\n") + (trailingCR ? "\r" : "");
      let cut: number;
      while ((cut = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        let event = "message";
        const data: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith(":")) continue;
          const i = line.indexOf(":");
          const field = i < 0 ? line : line.slice(0, i);
          const val = i < 0 ? "" : line.slice(i + 1).replace(/^ /, "");
          if (field === "event") event = val;
          else if (field === "data") data.push(val);
        }
        if (data.length) yield { event, data: data.join("\n") };
      }
      if (done) return;
    }
  } finally {
    signal?.removeEventListener("abort", stop);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Map one raw SSE message to a typed event. Accepts {t} (B02) and {text}. */
export function toChatEvent(event: string, data: string): ChatEvent | null {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return event === "token" ? { type: "token", text: data } : null;
  }
  if (!j || typeof j !== "object" || Array.isArray(j)) return null;
  switch (event) {
    case "brain":
      return { type: "brain", brain: String(j.brain ?? ""), half_awake: j.half_awake === true };
    case "token": {
      const t = j.t ?? j.text;
      return typeof t === "string" ? { type: "token", text: t } : null;
    }
    case "done":
      return {
        type: "done",
        tier: j.tier as Tier,
        brain: String(j.brain ?? ""),
        half_awake: j.half_awake === true,
        spent: typeof j.spent === "number" ? j.spent : 0,
        partial: j.partial === true,
        summary: (j.summary as StateSummary | undefined) ?? null
      };
    case "error":
      return { type: "error", error: String(j.error ?? "error") };
    default:
      return null;
  }
}

export class RealBackend implements Backend {
  readonly mock = false;
  constructor(private base: string) {}

  private async call<T>(method: "GET" | "POST", path: string, creds?: Creds, body?: unknown, keepalive = false): Promise<T> {
    const headers: Record<string, string> = {};
    if (creds) headers["x-truffle-secret"] = creds.secret;
    if (body !== undefined) headers["content-type"] = "application/json";
    return withTimeout(this.base + path, {
      method,
      headers,
      keepalive,
      body: body === undefined ? undefined : JSON.stringify(body)
    }, async (res) => {
      if (!res.ok) throw await errorOf(res);
      return (await res.json()) as T;
    });
  }

  private tz(): string | undefined {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return undefined;
    }
  }

  pair(lang?: Lang) {
    return this.call<PairResult>("POST", "/pair", undefined, { tz: this.tz(), lang });
  }
  spawn(lang?: Lang) {
    return this.call<PairResult>("POST", "/demo/spawn", undefined, { tz: this.tz(), lang });
  }
  state(c: Creds) {
    return this.call<StateSummary>("GET", `/state?phrase=${encodeURIComponent(c.phrase)}`, c);
  }
  companion(c: Creds, action: "away" | "return" | "cancel", intent?: "walk" | "errand" | "rest", requestId?: string, keepalive = false, generation?: number, jobId?: string) {
    return this.call<StateSummary>("POST", "/companion", c, {
      phrase: c.phrase, action, generation, ...(intent ? { intent } : {}),
      ...(jobId ? { job_id: jobId } : {}),
      ...(requestId ? { client_request_id: requestId } : {})
    }, keepalive);
  }
  spore(c: Creds) {
    return this.call<StateSummary>("POST", "/spore", c, { phrase: c.phrase });
  }
  slider(c: Creds, steps: number) {
    return this.call<StateSummary>("POST", "/demo/slider", c, { phrase: c.phrase, steps });
  }
  midnight(c: Creds) {
    return this.call<StateSummary>("POST", "/demo/midnight", c, { phrase: c.phrase });
  }
  heat(c: Creds, on: boolean) {
    return this.call<StateSummary>("POST", "/demo/heat", c, { phrase: c.phrase, on });
  }
  reset(c: Creds) {
    return this.call<StateSummary>("POST", "/demo/reset", c, { phrase: c.phrase });
  }

  async *chat(c: Creds, message: string, lang: Lang, requested?: Tier, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
    const res = await withTimeout(
      this.base + "/chat",
      {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", "x-truffle-secret": c.secret },
        body: JSON.stringify({ phrase: c.phrase, message, lang, ...(requested ? { requested_tier: requested } : {}) })
      },
      async (res) => {
        if (!res.ok) throw await errorOf(res);
        if (!res.body) throw new ApiError(0, "no stream");
        return res;
      },
      STREAM_IDLE_MS
    );
    for await (const m of parseSSE(res.body!, STREAM_IDLE_MS, signal)) {
      const ev = toChatEvent(m.event, m.data);
      if (ev) {
        yield ev;
        if (ev.type === "done" || ev.type === "error") return;
      }
    }
  }
}

/** True when GET /health answers ok within the timeout. */
export async function reachable(base: string, ms = 3000): Promise<boolean> {
  try {
    return await withTimeout(base + "/health", { method: "GET" }, async (res) => {
      if (!res.ok) {
        await res.body?.cancel();
        return false;
      }
      const j = (await res.json()) as { ok?: boolean };
      return j?.ok === true;
    }, ms);
  } catch {
    return false;
  }
}

/** Real backend if reachable, else the in-browser simulation. ?mock=1 forces the mock. */
export async function connect(params: URLSearchParams, demo: boolean): Promise<Backend> {
  if (params.get("mock") === "1") return new MockBackend(params, demo);
  const base = apiBase();
  if (await reachable(base)) return new RealBackend(base);
  return new MockBackend(params, demo);
}
