// The Worker's error contract (B06): JSON {error, hint?, retry_after_s?} with
// 400, 401, 409 and 429. This turns one into a calm line in the UI language,
// plus a wait in seconds when the Worker asks us to come back later.
// Pure module: no DOM, so it is unit tested in Node.

import { COPY, type Lang } from "./copy";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public hint?: string,
    public retry_after_s?: number
  ) {
    super(message);
  }
}

const MAX_WAIT_S = 7 * 24 * 3600;

/** A usable wait: a positive finite number of seconds, rounded up, at most 7 days. */
export function retrySeconds(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return undefined;
  return Math.min(MAX_WAIT_S, Math.ceil(v));
}

/** Build an ApiError from a non-OK response's status and body text. */
export function apiErrorFrom(status: number, statusText: string, bodyText: string): ApiError {
  let msg = statusText || "error";
  let hint: string | undefined;
  let retry: number | undefined;
  try {
    const j = JSON.parse(bodyText) as unknown;
    if (j && typeof j === "object" && !Array.isArray(j)) {
      const o = j as Record<string, unknown>;
      if (typeof o.error === "string" && o.error) msg = o.error;
      if (typeof o.hint === "string" && o.hint) hint = o.hint;
      retry = retrySeconds(o.retry_after_s);
    }
  } catch {
    /* not json */
  }
  return new ApiError(status, msg, hint, retry);
}

// Arabic counts: 1 and 2 have their own words, 3 to 10 take the plural, 11 and up the singular.
function arCount(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  return n <= 10 ? `${n} ${few}` : `${n} ${many}`;
}

/** "Try again in N s." Seconds up to 90 s, minutes up to 90 min, then hours. */
export function waitText(lang: Lang, seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (lang === "ar") {
    const w =
      s <= 90
        ? arCount(s, "ثانية", "ثانيتين", "ثواني", "ثانية")
        : s <= 5400
          ? arCount(Math.ceil(s / 60), "دقيقة", "دقيقتين", "دقايق", "دقيقة")
          : arCount(Math.ceil(s / 3600), "ساعة", "ساعتين", "ساعات", "ساعة");
    return `جرّب بعد ${w}.`;
  }
  const w = s <= 90 ? `${s} s` : s <= 5400 ? `${Math.ceil(s / 60)} min` : `${Math.ceil(s / 3600)} h`;
  return `Try again in ${w}.`;
}

/** Where the call came from. It changes what a status means (409 on spore vs chat). */
export type ErrorCtx = "chat" | "spore" | "demo" | "pair" | "state";

export type ErrorKind = "network" | "auth" | "alive" | "dead" | "bad" | "busy" | "rate" | "demoQuota" | "server";

export interface ErrorView {
  kind: ErrorKind;
  /** The line to show, already in the UI language. */
  text: string;
  /** Seconds until the button may be pressed again. */
  retryS?: number;
  /** 401: the phrase was not recognised, show Settings. */
  openSettings: boolean;
  /** Say it in Truffle's voice, not as an error. */
  voice: boolean;
}

const T = {
  en: {
    auth: "That phrase was not recognised. Check it in Settings.",
    bad: "Nothing changed. The request was not accepted.",
    busy: "Truffle is still answering your last message. One at a time, please.",
    rate: "Truffle needs a little break.",
    tooMany: "Too many new Truffles from here.",
    server: "Something went wrong. Nothing changed.",
    demoQuota: "I talked so much today that my voice is a whisper now. Let me rest a little, then come back."
  },
  ar: {
    auth: "ما تعرّفنا على هذي العبارة. شيّك عليها في الإعدادات.",
    alive: "ترافل هذا لسه حي. البذرة الجديدة تنزرع بس بعد ما يموت.",
    bad: "ما تغيّر شي. الطلب ما انقبل.",
    busy: "ترافل لسه يرد على رسالتك الأخيرة. وحدة وحدة.",
    rate: "ترافل يبي استراحة شوي.",
    tooMany: "واجد ترافلات جديدة من هنا.",
    server: "صار خطأ. ما تغيّر شي.",
    demoQuota: "سولفت واجد اليوم وصوتي صار همس. خلني أرتاح شوي، وبعدين ارجع."
  }
} as const;

const ALIVE_EN = "This Truffle is still alive. A new spore can only be planted after it dies.";

/** "Try again in 42 min." / "in 2 h" / "in 30 s" inside a Worker message without retry_after_s. */
function waitFromText(msg: string): number | undefined {
  const m = /try again in (\d+)\s*(s|sec|min|h)\b/i.exec(msg);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  return retrySeconds(unit === "h" ? n * 3600 : unit === "min" ? n * 60 : n);
}

/**
 * Worker message plus hint as one calm line: repeated sentences dropped, and when
 * a countdown will be shown, the Worker's own "try again in" sentence is left out.
 */
export function joinCalm(msg: string, hint: string | undefined, counting: boolean): string {
  const out: string[] = [];
  for (const part of [msg, hint ?? ""]) {
    for (const raw of part.match(/[^.!?]+[.!?]*/g) ?? []) {
      const sentence = raw.trim();
      if (!sentence || out.includes(sentence)) continue;
      if (counting && /^(try|sync) again in \d+/i.test(sentence)) continue;
      out.push(sentence);
    }
  }
  return out.join(" ");
}

export function describeError(e: unknown, lang: Lang, ctx: ErrorCtx, demo: boolean): ErrorView {
  const c = COPY[lang];
  const ar = lang === "ar";
  const view = (kind: ErrorKind, text: string, extra: Partial<ErrorView> = {}): ErrorView => ({
    kind,
    text,
    openSettings: false,
    voice: false,
    ...extra
  });
  if (!(e instanceof ApiError) || e.status === 0) return view("network", c.networkError);
  const msg = e.message;
  const wait = e.retry_after_s ?? waitFromText(msg);
  const withWait = wait !== undefined ? { retryS: wait } : {};

  switch (e.status) {
    case 401:
      return view("auth", T[lang].auth, { openSettings: true });
    case 409:
      if (ctx === "spore") return view("alive", ar ? T.ar.alive : msg === ALIVE_EN || /alive/i.test(msg) ? msg : ALIVE_EN);
      if (ctx === "chat") return view("dead", c.placeholderDead);
      break;
    case 400:
      return view("bad", ar ? T.ar.bad : joinCalm(msg, e.hint, wait !== undefined), withWait);
    case 429:
      if (demo && ctx === "chat" && (/replies/i.test(msg) || (wait ?? 0) >= 3600)) {
        return view("demoQuota", T[lang].demoQuota, { ...withWait, voice: true });
      }
      if (/one at a time|still answering/i.test(msg)) return view("busy", T[lang].busy);
      if (ctx === "pair") return view("rate", ar ? T.ar.tooMany : msg, withWait);
      return view("rate", ar ? T.ar.rate : joinCalm(msg, e.hint, wait !== undefined), withWait);
  }
  return view("server", ctx === "chat" ? c.chatError : T[lang].server);
}

/**
 * A wall-clock countdown. onTick(left) fires at start and once a second;
 * onEnd fires once when it runs out. A throttled background tab still ends on time.
 */
export class Cooldown {
  private until = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private shown = -1;

  constructor(
    private onTick: (left: number) => void,
    private onEnd: () => void
  ) {}

  left(): number {
    return Math.max(0, Math.ceil((this.until - Date.now()) / 1000));
  }

  active(): boolean {
    return this.timer !== null;
  }

  start(seconds: number): void {
    this.stop();
    const s = retrySeconds(seconds);
    if (s === undefined) return;
    this.until = Date.now() + s * 1000;
    this.shown = -1;
    this.timer = setInterval(() => this.step(), 1000);
    this.step();
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.until = 0;
  }

  private step(): void {
    const left = this.left();
    if (left <= 0) {
      this.stop();
      this.onEnd();
      return;
    }
    if (left !== this.shown) {
      this.shown = left;
      this.onTick(left);
    }
  }
}
