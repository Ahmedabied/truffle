// Offline harness for TruffleDO and LimiterDO. Real source, fake platform:
// SQLite from node:sqlite, a controllable clock, a fake Workers AI binding that
// speaks the measured SSE shape, and a stubbed global fetch for Open-Meteo.
// No network, no real model, no credentials outside memory.

import { DatabaseSync } from "node:sqlite";
import { vi } from "vitest";
import * as engine from "../../src/engine";
import type { TruffleState } from "../../src/engine";
import { TruffleDO } from "../../src/do";
import { LimiterDO } from "../../src/limiter";
import { generateSecret, hashSecret } from "../../src/pairing";
import type { Env, Meta } from "../../src/types";

const enc = new TextEncoder();

// ---------- clock ----------

export const clock = { now: Date.parse("2026-10-08T08:00:00Z") };

export function useClock(iso: string): void {
  clock.now = Date.parse(iso);
  vi.spyOn(Date, "now").mockImplementation(() => clock.now);
}

export function advance(ms: number): void {
  clock.now += ms;
}

// ---------- SQLite ----------

export interface Cursor<T> {
  toArray(): T[];
  one(): T;
}

export function fakeSql(db: DatabaseSync) {
  return {
    exec<T = Record<string, unknown>>(query: string, ...args: unknown[]): Cursor<T> {
      if (args.length === 0 && /CREATE TABLE/i.test(query)) {
        db.exec(query);
        return { toArray: () => [], one: () => { throw new Error("no rows"); } };
      }
      const stmt = db.prepare(query);
      const rows = (stmt.columns().length ? stmt.all(...(args as never[])) : (stmt.run(...(args as never[])), [])) as T[];
      return {
        toArray: () => rows,
        one: () => {
          if (rows.length !== 1) throw new Error(`expected one row, got ${rows.length}`);
          return rows[0];
        }
      };
    }
  };
}

// ---------- fake Workers AI ----------

export type Step =
  | { kind: "text"; parts: string[]; errorAfter?: boolean }
  | { kind: "throw" }
  | { kind: "held"; held: Held };

/** An SSE line with one visible delta, as gemma-4-26b-a4b-it sends it. */
const line = (t: string) => enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: t, reasoning_content: null } }] })}\n\n`);

/** One chunk per pull, then [DONE] and close, or an error before [DONE]. */
function sseStream(parts: string[], errorAfter = false): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (i < parts.length) {
        c.enqueue(line(parts[i++]));
        return;
      }
      if (errorAfter) {
        c.error(new Error("stream broke"));
        return;
      }
      c.enqueue(enc.encode("data: [DONE]\n\n"));
      c.close();
    }
  });
}

/** A provider stream the test drives: push text, end it, or let an abort kill it. */
export class Held {
  private c!: ReadableStreamDefaultController<Uint8Array>;
  closed = false;
  aborted = false;
  readonly stream = new ReadableStream<Uint8Array>({
    start: (c) => {
      this.c = c;
    },
    cancel: () => {
      this.closed = true;
      this.aborted = true;
    }
  });
  push(t: string): void {
    if (this.closed) return;
    try {
      this.c.enqueue(line(t));
    } catch {
      // stream already gone
    }
  }
  end(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.c.enqueue(enc.encode("data: [DONE]\n\n"));
      this.c.close();
    } catch {
      // stream already gone
    }
  }
  abort(reason: unknown): void {
    if (this.closed) return;
    this.closed = true;
    this.aborted = true;
    try {
      this.c.error(reason);
    } catch {
      // stream already gone
    }
  }
}

export interface AiCall {
  input: {
    messages: { role: string; content: string }[];
    max_tokens: number;
    chat_template_kwargs: { enable_thinking: boolean };
  };
  options?: { signal?: AbortSignal };
}

export class FakeAI {
  calls: AiCall[] = [];
  extractions = 0;
  script: Step[] = [];
  /** What fact extraction returns. */
  facts: string[] = [];

  run = async (_model: string, input: Record<string, unknown>, options?: { signal?: AbortSignal }) => {
    if (input.response_format) {
      this.extractions++;
      return { response: { facts: this.facts } };
    }
    this.calls.push({ input: input as unknown as AiCall["input"], options });
    if (options?.signal?.aborted) throw options.signal.reason;
    const step = this.script.shift() ?? { kind: "text", parts: ["Hello from the sand."] };
    if (step.kind === "throw") throw new Error("provider down");
    if (step.kind === "held") {
      options?.signal?.addEventListener("abort", () => step.held.abort(options.signal!.reason));
      return step.held.stream;
    }
    return sseStream(step.parts, step.errorAfter);
  };

  /** Hold the next model call until the test pushes and ends it. */
  hold(): Held {
    const held = new Held();
    this.script.push({ kind: "held", held });
    return held;
  }
}

// ---------- fake fetch (Open-Meteo) ----------

export class FakeFetch {
  urls: string[] = [];
  /** Responses in order. Each is a JSON body, a status code, or a deferred response. */
  queue: (unknown | number | Deferred<unknown>)[] = [];
  fallback: unknown | number = 503;

  fn = vi.fn(async (url: string | URL | Request) => {
    this.urls.push(String(url));
    let next = this.queue.length ? this.queue.shift() : this.fallback;
    if (next instanceof Deferred) next = await next.promise;
    if (typeof next === "number") return new Response("down", { status: next });
    return new Response(JSON.stringify(next), { status: 200, headers: { "content-type": "application/json" } });
  });

  install(): void {
    vi.stubGlobal("fetch", this.fn);
  }

  get count(): number {
    return this.urls.length;
  }
}

export class Deferred<T> {
  resolve!: (v: T) => void;
  readonly promise = new Promise<T>((r) => {
    this.resolve = r;
  });
}

// ---------- Durable Object fixtures ----------

export interface Fixture {
  obj: TruffleDO;
  db: DatabaseSync;
  ai: FakeAI;
  secret: string;
  alarms: number[];
  drain(): Promise<void>;
  /** Private members, for seeding and reading storage. */
  priv: {
    load(): { s: TruffleState; m: Meta } | null;
    save(s: TruffleState, m: Meta): void;
    addFacts(texts: string[], day: string, affection: number): number;
    ensureSchema(): void;
  };
  meta(): Meta;
  state(): TruffleState;
  facts(): { text: string; day_written: string }[];
  turns(): { role: string; content: string }[];
  logs(kind: string): Record<string, unknown>[];
}

export function makeObject(ai = new FakeAI()): Omit<Fixture, "secret"> {
  const db = new DatabaseSync(":memory:");
  const pending: Promise<unknown>[] = [];
  const alarms: number[] = [];
  const sql = fakeSql(db);
  const ctx = {
    storage: {
      sql,
      setAlarm: async (t: number) => {
        alarms.push(t);
      },
      deleteAlarm: async () => {},
      getAlarm: async () => alarms.at(-1) ?? null,
      deleteAll: async () => {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
        for (const t of tables) db.exec(`DROP TABLE ${t.name}`);
      }
    },
    waitUntil: (p: Promise<unknown>) => {
      pending.push(p);
    }
  } as unknown as DurableObjectState;
  const env = { AI: { run: ai.run } as unknown as Ai, TRUFFLE: {} as never, LIMITER: {} as never } as Env;
  const obj = new TruffleDO(ctx, env);
  const priv = obj as unknown as Fixture["priv"];
  const rows = <T>(q: string, ...a: unknown[]) => sql.exec<T>(q, ...a).toArray();
  return {
    obj,
    db,
    ai,
    alarms,
    priv,
    async drain() {
      for (let i = 0; i < pending.length; i++) await pending[i];
    },
    meta: () => priv.load()!.m,
    state: () => priv.load()!.s,
    facts: () => rows("SELECT text, day_written FROM facts ORDER BY id"),
    turns: () => rows("SELECT role, content FROM turns ORDER BY id"),
    logs: (kind) =>
      rows<{ detail: string }>("SELECT detail FROM log WHERE kind = ? ORDER BY id", kind).map((r) => JSON.parse(r.detail))
  };
}

/** A paired Truffle seeded straight into storage (no network). */
export async function truffle(
  over: { state?: Partial<TruffleState>; meta?: Partial<Meta> } = {},
  ai = new FakeAI()
): Promise<Fixture> {
  const f = makeObject(ai);
  const secret = generateSecret();
  const meta: Meta = {
    tz: "Asia/Muscat",
    country: "OM",
    lang: "en",
    lat: 23.59,
    lon: 58.41,
    city: "Muscat",
    secret_hash: await hashSecret(secret),
    demo: false,
    created_ms: clock.now,
    last_tick_ms: clock.now,
    last_midnight_key: new Date(clock.now + 4 * 3_600_000).toISOString().slice(0, 10),
    weather_days: {},
    weather_now: null,
    feed_window: { start_ms: clock.now, count: 0 },
    ...over.meta
  };
  f.priv.ensureSchema();
  f.priv.save({ ...structuredClone(engine.DEFAULT_STATE), ...over.state }, meta);
  return { ...f, secret };
}

// ---------- SSE ----------

export interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

/** Read a chat stream to the end. Start it right away: the DO waits for reads. */
export async function readEvents(stream: ReadableStream<Uint8Array>): Promise<SseEvent[]> {
  const text = await new Response(stream).text();
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((block) => {
      const ev = /^event: (.*)$/m.exec(block)?.[1] ?? "";
      const data = /^data: (.*)$/m.exec(block)?.[1] ?? "{}";
      return { event: ev, data: JSON.parse(data) };
    });
}

/** Start a chat. Returns the result and, when admitted, a promise of its events. */
export async function startChat(
  f: Fixture,
  requested?: "asleep" | "low" | "medium" | "high",
  message = "Hello Truffle."
): Promise<{ status: number; error?: string; events?: Promise<SseEvent[]> }> {
  const r = await f.obj.chat(f.secret, message, requested, undefined);
  if (!r.ok) return { status: r.status, error: r.error };
  return { status: 200, events: readEvents(r.value) };
}

/** Wait (real time, at most 2 s) until a condition holds. For work that leaves the event loop, like crypto.subtle. */
export async function until(cond: () => boolean, what = "condition"): Promise<void> {
  const t0 = performance.now();
  while (!cond()) {
    if (performance.now() - t0 > 2000) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 1));
  }
}

/** Let queued microtasks and stream pulls run. */
export async function settle(rounds = 20): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setImmediate(r));
}

// ---------- LimiterDO and namespaces for route tests ----------

export function makeLimiter(): LimiterDO {
  const store = new Map<string, unknown>();
  const ctx = {
    storage: {
      get: async (k: string) => store.get(k),
      put: async (entries: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(entries)) store.set(k, v);
      },
      setAlarm: async () => {},
      deleteAll: async () => store.clear()
    }
  } as unknown as DurableObjectState;
  return new LimiterDO(ctx, {} as Env);
}

/** A DurableObjectNamespace over plain objects, counting every get(). */
export function namespace<T>(make: (name: string) => T) {
  const objects = new Map<string, T>();
  const ns = {
    gets: 0,
    idFromName: (name: string) => name,
    get(id: string) {
      ns.gets++;
      if (!objects.has(id)) objects.set(id, make(id));
      return objects.get(id)!;
    },
    objects
  };
  return ns;
}
