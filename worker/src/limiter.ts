// LimiterDO: one small object per client IP, for limits that must hold
// before we allocate or touch anything (spawns, failed owner lookups).
// Fixed windows, pure helpers.
import { DurableObject } from "cloudflare:workers";
import { checkRate, peekRate } from "./ratelimit";
import type { Env, RateWindow } from "./types";

export interface LimitRule {
  name: string;
  limit: number;
  windowMs: number;
}

export class LimiterDO extends DurableObject<Env> {
  // A real object serialises calls through its input gate. This queue keeps
  // read-then-write pairs atomic in any harness too, so a concurrent burst
  // can never read the same count twice.
  private queue: Promise<unknown> = Promise.resolve();

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  /** Counts one hit only if every rule allows it. */
  hit(rules: LimitRule[]): Promise<{ allowed: boolean; retry_after_s: number; rule?: string }> {
    return this.serial(() => this.hitNow(rules));
  }

  private async hitNow(rules: LimitRule[]): Promise<{ allowed: boolean; retry_after_s: number; rule?: string }> {
    const now = Date.now();
    const next: Record<string, RateWindow> = {};
    for (const r of rules) {
      const w = await this.ctx.storage.get<RateWindow>(r.name);
      const c = checkRate(w, now, r.limit, r.windowMs);
      if (!c.allowed) return { allowed: false, retry_after_s: c.retry_after_s, rule: r.name };
      next[r.name] = c.window;
    }
    await this.ctx.storage.put(next);
    // Clean up after the longest window so idle IPs cost nothing.
    await this.ctx.storage.setAlarm(now + Math.max(...rules.map((r) => r.windowMs)));
    return { allowed: true, retry_after_s: 0 };
  }

  /** Would a hit be allowed now? Counts nothing. */
  async peek(rules: LimitRule[]): Promise<{ allowed: boolean; retry_after_s: number; rule?: string }> {
    const now = Date.now();
    for (const r of rules) {
      const p = peekRate(await this.ctx.storage.get<RateWindow>(r.name), now, r.limit, r.windowMs);
      if (!p.allowed) return { allowed: false, retry_after_s: p.retry_after_s, rule: r.name };
    }
    return { allowed: true, retry_after_s: 0 };
  }

  /** Give back one counted hit in the current window (a reserved try that succeeded). */
  release(rules: LimitRule[]): Promise<void> {
    return this.serial(() => this.releaseNow(rules));
  }

  private async releaseNow(rules: LimitRule[]): Promise<void> {
    const now = Date.now();
    const next: Record<string, RateWindow> = {};
    for (const r of rules) {
      const w = await this.ctx.storage.get<RateWindow>(r.name);
      if (!w || w.count <= 0 || now - w.start_ms >= r.windowMs || now < w.start_ms) continue;
      next[r.name] = { start_ms: w.start_ms, count: w.count - 1 };
    }
    if (Object.keys(next).length) await this.ctx.storage.put(next);
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
