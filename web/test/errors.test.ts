import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, Cooldown, apiErrorFrom, describeError, joinCalm, retrySeconds, waitText } from "../src/errors";

const HINT_FIX = "Nothing changed. Fix the request and send it again.";

describe("apiErrorFrom: the Worker error contract", () => {
  it("reads error, hint and retry_after_s", () => {
    const e = apiErrorFrom(400, "Bad Request", JSON.stringify({ error: "message must be 1 to 2048 characters.", hint: HINT_FIX, retry_after_s: 3 }));
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(400);
    expect(e.message).toBe("message must be 1 to 2048 characters.");
    expect(e.hint).toBe(HINT_FIX);
    expect(e.retry_after_s).toBe(3);
  });

  it("leaves hint and retry undefined when absent (uniform 401)", () => {
    const e = apiErrorFrom(401, "Unauthorized", JSON.stringify({ error: "That phrase and secret do not match a Truffle." }));
    expect(e.hint).toBeUndefined();
    expect(e.retry_after_s).toBeUndefined();
  });

  it("falls back to statusText for a body that is not JSON", () => {
    const e = apiErrorFrom(502, "Bad Gateway", "<html>oops</html>");
    expect(e.status).toBe(502);
    expect(e.message).toBe("Bad Gateway");
  });

  it("falls back to 'error' with no statusText and an empty body", () => {
    expect(apiErrorFrom(500, "", "").message).toBe("error");
  });

  it("ignores non-string error and hint fields", () => {
    const e = apiErrorFrom(400, "Bad Request", JSON.stringify({ error: 5, hint: { x: 1 } }));
    expect(e.message).toBe("Bad Request");
    expect(e.hint).toBeUndefined();
  });

  it("ignores a JSON body that is not an object", () => {
    expect(apiErrorFrom(429, "Too Many Requests", "[1,2]").message).toBe("Too Many Requests");
    expect(apiErrorFrom(429, "Too Many Requests", "null").message).toBe("Too Many Requests");
  });
});

describe("retrySeconds", () => {
  it("rounds up and keeps positive finite numbers", () => {
    expect(retrySeconds(2375)).toBe(2375);
    expect(retrySeconds(0.2)).toBe(1);
    expect(retrySeconds(86377)).toBe(86377);
  });
  it("rejects junk", () => {
    for (const v of [0, -5, NaN, Infinity, "30", null, undefined, true, {}]) expect(retrySeconds(v)).toBeUndefined();
  });
  it("caps at 7 days", () => {
    expect(retrySeconds(1e12)).toBe(7 * 24 * 3600);
  });
});

describe("waitText", () => {
  it("uses seconds up to 90 s", () => {
    expect(waitText("en", 1)).toBe("Try again in 1 s.");
    expect(waitText("en", 90)).toBe("Try again in 90 s.");
  });
  it("uses minutes up to 90 min, then hours", () => {
    expect(waitText("en", 91)).toBe("Try again in 2 min.");
    expect(waitText("en", 5400)).toBe("Try again in 90 min.");
    expect(waitText("en", 5401)).toBe("Try again in 2 h.");
    expect(waitText("en", 86377)).toBe("Try again in 24 h.");
  });
  it("has Arabic forms", () => {
    expect(waitText("ar", 12)).toBe("جرّب بعد 12 ثانية.");
    expect(waitText("ar", 600)).toBe("جرّب بعد 10 دقايق.");
    expect(waitText("ar", 3600)).toBe("جرّب بعد 60 دقيقة.");
    expect(waitText("ar", 7200)).toBe("جرّب بعد ساعتين.");
    expect(waitText("ar", 1)).toBe("جرّب بعد ثانية.");
    expect(waitText("ar", 5)).toBe("جرّب بعد 5 ثواني.");
    expect(waitText("ar", 86377)).toBe("جرّب بعد 24 ساعة.");
    expect(waitText("ar", 3 * 3600 + 1)).toBe("جرّب بعد 4 ساعات.");
  });
});

describe("describeError", () => {
  const e400 = new ApiError(400, "That is 10 new steps since the last sync, more than 20 a second. Nothing changed. Sync again in 1 s.", undefined, 1);
  const e400hint = new ApiError(400, "message must be 1 to 2048 characters.", HINT_FIX);
  const e401 = new ApiError(401, "That phrase and secret do not match a Truffle.");
  const e409alive = new ApiError(409, "This Truffle is still alive. A new spore can only be planted after it dies.");
  const e409dead = new ApiError(409, "truffle is dead; POST /spore to plant a new one");
  const e429busy = new ApiError(429, "Truffle is still answering your last message. One at a time, please.");
  const e429hour = new ApiError(429, "Truffle needs a break: 20 messages per hour. Try again in 12 min.", undefined, 700);
  const e429demo = new ApiError(429, "This demo Truffle has used its 30 replies for today. Try again in 24 h.", undefined, 86377);
  const e429spawn = new ApiError(429, "Too many demo Truffles from here. Try again in 42 min.");

  it("network and timeout use the calm network line", () => {
    expect(describeError(new ApiError(0, "network"), "en", "chat", false)).toMatchObject({ kind: "network", openSettings: false });
    expect(describeError(new ApiError(0, "timeout"), "ar", "spore", false).text).toContain("ما قدرنا نوصل");
    expect(describeError(new TypeError("x"), "en", "chat", false).kind).toBe("network");
  });

  it("401 says the phrase was not recognised and opens Settings, in both languages", () => {
    const en = describeError(e401, "en", "chat", false);
    expect(en).toMatchObject({ kind: "auth", openSettings: true, voice: false });
    expect(en.text).toBe("That phrase was not recognised. Check it in Settings.");
    const ar = describeError(e401, "ar", "spore", false);
    expect(ar.openSettings).toBe(true);
    expect(ar.text).toContain("الإعدادات");
  });

  it("409 on spore says the Truffle is alive", () => {
    expect(describeError(e409alive, "en", "spore", false)).toMatchObject({
      kind: "alive",
      text: "This Truffle is still alive. A new spore can only be planted after it dies."
    });
    expect(describeError(e409alive, "ar", "spore", false).text).toBe("ترافل هذا لسه حي. البذرة الجديدة تنزرع بس بعد ما يموت.");
  });

  it("409 on chat means it is dead: point at the spore", () => {
    expect(describeError(e409dead, "en", "chat", false)).toMatchObject({ kind: "dead", text: "Plant a new spore to talk again." });
  });

  it("400 shows the Worker text and hint in English, a calm Arabic line in Arabic", () => {
    expect(describeError(e400hint, "en", "chat", false)).toMatchObject({ kind: "bad", text: `message must be 1 to 2048 characters. ${HINT_FIX}` });
    const ar = describeError(e400hint, "ar", "chat", false);
    expect(ar.kind).toBe("bad");
    expect(ar.text).toBe("ما تغيّر شي. الطلب ما انقبل.");
  });

  it("400 with retry_after_s carries the wait", () => {
    expect(describeError(e400, "en", "demo", true)).toMatchObject({ kind: "bad", retryS: 1 });
  });

  it("with a countdown, the Worker's own wait sentence and repeats are dropped", () => {
    const e = new ApiError(400, "That is 9000 new steps since the last sync, more than 20 a second. Nothing changed. Sync again in 5 s.",
      "Nothing changed. Your steps are still on your phone. Fix the request and sync again.", 5);
    expect(describeError(e, "en", "demo", true).text).toBe(
      "That is 9000 new steps since the last sync, more than 20 a second. Nothing changed. Your steps are still on your phone. Fix the request and sync again."
    );
  });

  it("429 with retry carries the wait and the Worker text", () => {
    expect(describeError(e429hour, "en", "chat", false)).toMatchObject({ kind: "rate", retryS: 700, text: "Truffle needs a break: 20 messages per hour." });
    expect(describeError(e429hour, "ar", "chat", false)).toMatchObject({ kind: "rate", retryS: 700, text: "ترافل يبي استراحة شوي." });
  });

  it("429 without retry_after_s reads the wait from the Worker text", () => {
    expect(describeError(e429spawn, "en", "pair", true)).toMatchObject({ kind: "rate", retryS: 42 * 60 });
  });

  it("429 one at a time is busy, no countdown", () => {
    const v = describeError(e429busy, "ar", "chat", false);
    expect(v.kind).toBe("busy");
    expect(v.retryS).toBeUndefined();
    expect(v.text).toBe("ترافل لسه يرد على رسالتك الأخيرة. وحدة وحدة.");
  });

  it("demo reply cap on the demo page is Truffle's voice, not an error", () => {
    const en = describeError(e429demo, "en", "chat", true);
    expect(en).toMatchObject({ kind: "demoQuota", voice: true, retryS: 86377 });
    expect(en.text).not.toMatch(/error|429|limit/i);
    expect(describeError(e429demo, "ar", "chat", true).voice).toBe(true);
  });

  it("the same 429 off the demo page is a plain rate message", () => {
    expect(describeError(e429demo, "en", "chat", false).kind).toBe("rate");
  });

  it("anything else is a calm generic line, not a raw server string", () => {
    const v = describeError(new ApiError(500, "internal error"), "en", "demo", true);
    expect(v.kind).toBe("server");
    expect(v.text).not.toContain("internal error");
    expect(describeError(new ApiError(500, "internal error"), "en", "chat", false).text).toBe("Truffle could not finish the reply. Try again in a little while.");
  });

  it("no copy contains an em or en dash", () => {
    const all = [e400, e400hint, e401, e409alive, e409dead, e429busy, e429hour, e429demo, e429spawn, new ApiError(500, "x"), new ApiError(0, "network")];
    for (const lang of ["en", "ar"] as const)
      for (const ctx of ["chat", "spore", "demo", "pair", "state"] as const)
        for (const e of all) for (const demo of [true, false]) expect(describeError(e, lang, ctx, demo).text).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("Cooldown: the retry countdown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ticks down once a second and ends", () => {
    const ticks: number[] = [];
    let ended = 0;
    const c = new Cooldown((left) => ticks.push(left), () => ended++);
    c.start(3);
    expect(c.active()).toBe(true);
    expect(ticks).toEqual([3]);
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(1000);
    expect(ticks).toEqual([3, 2, 1]);
    expect(ended).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(ended).toBe(1);
    expect(c.active()).toBe(false);
    expect(c.left()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(ended).toBe(1);
  });

  it("follows the wall clock, so a throttled tab still ends on time", () => {
    let ended = 0;
    const c = new Cooldown(() => {}, () => ended++);
    c.start(10);
    vi.setSystemTime(Date.now() + 9500);
    vi.advanceTimersByTime(1000);
    expect(ended).toBe(1);
  });

  it("a new start replaces the old one; stop ends quietly", () => {
    const ticks: number[] = [];
    let ended = 0;
    const c = new Cooldown((l) => ticks.push(l), () => ended++);
    c.start(5);
    c.start(2);
    expect(c.left()).toBe(2);
    c.stop();
    expect(c.active()).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(ended).toBe(0);
    expect(ticks).toEqual([5, 2]);
  });

  it("ignores zero or junk", () => {
    const c = new Cooldown(() => {}, () => {});
    c.start(0);
    expect(c.active()).toBe(false);
    c.start(NaN);
    expect(c.active()).toBe(false);
  });
});

describe("joinCalm", () => {
  it("keeps everything when there is no countdown", () => {
    expect(joinCalm("Too many. Try again in 42 min.", undefined, false)).toBe("Too many. Try again in 42 min.");
  });
  it("handles a missing hint and an empty message", () => {
    expect(joinCalm("", undefined, true)).toBe("");
    expect(joinCalm("One line", undefined, true)).toBe("One line");
  });
});
