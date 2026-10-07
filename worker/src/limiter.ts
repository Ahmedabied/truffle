// LimiterDO: one small object per client IP, for limits that must hold
// before we allocate anything (demo spawns). Fixed windows, pure helper.
import { DurableObject } from "cloudflare:workers";
import { checkRate } from "./ratelimit";
import type { Env, RateWindow } from "./types";

export interface LimitRule {
  name: string;
  limit: number;
  windowMs: number;
}

export class LimiterDO extends DurableObject<Env> {
  /** Counts one hit only if every rule allows it. */
  async hit(rules: LimitRule[]): Promise<{ allowed: boolean; retry_after_s: number; rule?: string }> {
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

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
