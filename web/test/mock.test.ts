import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockBackend } from "../src/mock";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
});
afterEach(() => vi.unstubAllGlobals());

describe("offline demo follows the real reward engine", () => {
  it("awards a first best day at 2000 steps with an empty history", async () => {
    const b = new MockBackend(new URLSearchParams("scene=fresh"), true);
    const c = await b.spawn("en");
    const s = await b.slider(c, 2000);
    expect(s.moments?.map(m => m.kind)).toContain("best_day");
  });
  it("reset clears prior moments and starts a fresh pet", async () => {
    const b = new MockBackend(new URLSearchParams("scene=fresh"), true);
    const c = await b.spawn("en");
    await b.slider(c, 10000);
    const s = await b.reset(c);
    expect(s.moments).toEqual([]);
    expect(s.state.lifetime_steps).toBe(0);
  });
  it("uses completed days to reach the 14 day streak", async () => {
    const b = new MockBackend(new URLSearchParams("scene=fresh"), true);
    const c = await b.spawn("en");
    for (let d = 0; d < 14; d++) { await b.slider(c, 10000); await b.midnight(c); }
    expect((await b.state(c)).moments?.some(m => m.kind === "streak" && m.value === 14)).toBe(true);
  });
});
