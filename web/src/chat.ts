// One input line under the world. Replies type out at the tier's speed.
// The tier for the speed comes from the same engine rule the Worker uses.

import { decideTier } from "../../worker/src/engine";
import { TIERS, type Tier } from "../../worker/src/config";
import { COPY, explainChat, type Lang } from "./copy";
import { Cooldown, describeError, waitText, type ErrorView } from "./errors";
import type { Backend, Creds, StateSummary } from "./types";

/** ms per grapheme by tier (asleep shows its one line at once). */
export const TIER_SPEED: Record<Tier, number> = { asleep: 0, low: 40, medium: 25, high: 12 };
const YAWN_AFTER_MS = 3000;
const YAWN_MIN_MS = 1500;

export interface ChatDeps {
  backend: () => Backend;
  creds: () => Creds | null;
  lang: () => Lang;
  summary: () => StateSummary | null;
  reduced: () => boolean;
  requested: () => Tier | undefined;
  onYawn: (on: boolean) => void;
  onHalfAwake: (on: boolean) => void;
  onSummary: (s: StateSummary) => void;
  onExplain: (text: string) => void;
  afterChat: () => void;
  /** The judge page: the demo reply cap is said in Truffle's voice. */
  demo: boolean;
  /** 401: the phrase was not recognised. */
  openSettings: () => void;
}

function graphemes(text: string, lang: Lang): string[] {
  if (typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter(lang, { granularity: "grapheme" }).segment(text), (p) => p.segment);
  }
  return Array.from(text).reduce<string[]>((parts, ch) => {
    if (/[̀-ًͯ-ٰٟ]/.test(ch) && parts.length) parts[parts.length - 1] += ch;
    else parts.push(ch);
    return parts;
  }, []);
}

/** Typewriter. Tokens are appended as they stream; the reveal runs on its own timer. */
class Typer {
  private target = "";
  private shown: string[] = [];
  private all: string[] = [];
  private timer = 0;
  private ended = false;
  private resolve: (() => void) | null = null;
  delay = 25;

  constructor(private el: HTMLElement, private sr: HTMLElement, private lang: Lang, private reduced: () => boolean) {}

  push(text: string): void {
    this.target += text;
    this.all = graphemes(this.target, this.lang);
    if (this.reduced() || this.delay <= 0) this.flush();
    else if (!this.timer) this.tick();
  }

  private tick = (): void => {
    this.timer = 0;
    if (this.reduced()) return this.flush();
    if (this.shown.length < this.all.length) {
      this.shown = this.all.slice(0, this.shown.length + 1);
      this.el.textContent = this.shown.join("");
      this.timer = window.setTimeout(this.tick, this.delay);
    } else if (this.ended) this.done();
  };

  private flush(): void {
    clearTimeout(this.timer);
    this.timer = 0;
    this.shown = this.all.slice();
    this.el.textContent = this.target;
    if (this.ended) this.done();
  }

  private done(): void {
    this.sr.textContent = this.target; // one announcement, not one per character
    this.resolve?.();
    this.resolve = null;
  }

  /** Resolves once everything streamed so far is on screen. */
  end(): Promise<void> {
    this.ended = true;
    return new Promise((r) => {
      this.resolve = r;
      if (this.reduced() || this.shown.length >= this.all.length) this.flush();
      else if (!this.timer) this.tick();
    });
  }

  stop(): void {
    clearTimeout(this.timer);
    this.timer = 0;
  }

  text(): string {
    return this.target;
  }
}

export class Chat {
  private busy = false;
  private typer: Typer | null = null;
  private sendBtn: HTMLButtonElement | null;
  /** Set after a 429 or a 400 with retry_after_s: input and Send stay off until it ends. */
  private cooldown: Cooldown;

  constructor(
    private form: HTMLFormElement,
    private input: HTMLInputElement,
    private reply: HTMLElement,
    private replySr: HTMLElement,
    private status: HTMLElement,
    private d: ChatDeps
  ) {
    this.sendBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    this.cooldown = new Cooldown(
      (left) => {
        this.status.textContent = waitText(this.d.lang(), left);
      },
      () => {
        this.status.textContent = "";
        this.refresh();
      }
    );
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const msg = input.value.trim();
      if (msg && !this.busy && !this.cooldown.active()) void this.send(msg);
    });
  }

  /** Placeholder and lang hints follow the current state and UI language. */
  refresh(): void {
    const lang = this.d.lang();
    const s = this.d.summary();
    const c = COPY[lang];
    this.input.placeholder = s?.state.dead ? c.placeholderDead : s?.tier === "asleep" ? c.placeholderAsleep : c.placeholder;
    this.input.lang = lang;
    this.input.disabled = this.busy || !s || s.state.dead || this.cooldown.active();
    if (this.sendBtn) this.sendBtn.disabled = this.input.disabled;
  }

  /** Finish any running reveal at once (reduced motion switched on). */
  skip(): void {
    if (this.typer && this.d.reduced()) this.typer.push("");
  }

  async send(message: string): Promise<void> {
    const creds = this.d.creds();
    const pre = this.d.summary();
    if (!creds || !pre) return;
    const lang = this.d.lang();
    const c = COPY[lang];
    const requested = this.d.requested();
    // Same rule as the Worker: this is the tier that will answer.
    const tier = decideTier(pre.state, requested).tier;
    const slow = pre.mood === "tired" || pre.mood === "wilting" ? 1.5 : 1;

    this.busy = true;
    this.refresh();
    this.input.value = "";
    this.reply.classList.remove("asleep", "error");
    this.reply.textContent = "";
    this.replySr.textContent = "";
    this.reply.lang = lang;
    this.status.textContent = c.thinking;

    const typer = new Typer(this.reply, this.replySr, lang, this.d.reduced);
    typer.delay = TIER_SPEED[tier] * slow;
    this.typer = typer;

    let failure: ErrorView | null = null;
    let finished = false;
    let yawnUntil = 0;
    let gotToken = false;
    const yawnTimer = window.setTimeout(() => {
      if (!gotToken) {
        this.d.onYawn(true);
        this.status.textContent = c.yawning;
      }
    }, YAWN_AFTER_MS);
    const stopYawn = () => {
      const left = yawnUntil - Date.now();
      if (left > 0) window.setTimeout(() => this.d.onYawn(false), left);
      else this.d.onYawn(false);
    };

    try {
      for await (const ev of this.d.backend().chat(creds, message, lang, requested)) {
        if (ev.type === "brain") {
          this.d.onHalfAwake(ev.half_awake);
          if (ev.half_awake) {
            this.d.onYawn(true);
            this.status.textContent = c.yawning;
            yawnUntil = Date.now() + YAWN_MIN_MS;
          }
          if (ev.brain === "none") {
            typer.delay = 0;
            this.reply.classList.add("asleep");
          }
        } else if (ev.type === "token") {
          if (!gotToken) {
            gotToken = true;
            clearTimeout(yawnTimer);
            stopYawn();
            this.status.textContent = "";
          }
          typer.push(ev.text);
        } else if (ev.type === "done") {
          finished = true;
          await typer.end();
          if (ev.tier === "asleep") {
            this.reply.classList.add("asleep");
            this.input.blur();
          }
          const thinking = TIERS[ev.tier]?.thinking ?? false;
          this.d.onExplain(
            explainChat(lang, { pct: pre.energy_pct, tier: ev.tier, spent: ev.spent, thinking, requested, brain: ev.brain }) +
              (ev.partial ? " " + c.partial : "")
          );
          if (ev.summary) this.d.onSummary(ev.summary);
        } else if (ev.type === "error") {
          finished = true;
          typer.stop();
          this.reply.classList.add("error");
          this.reply.textContent = typer.text() ? `${typer.text()}\n${c.chatError}` : c.chatError;
          this.replySr.textContent = c.chatError;
        }
      }
      if (!finished) {
        // The stream closed without done or error: say so instead of hanging.
        typer.stop();
        this.reply.classList.add("error");
        this.reply.textContent = typer.text() ? `${typer.text()}\n${c.chatError}` : c.chatError;
        this.replySr.textContent = c.chatError;
      }
    } catch (e) {
      typer.stop();
      // The Worker's calm text, in the UI language. The demo reply cap is Truffle talking, not an error box.
      failure = describeError(e, lang, "chat", this.d.demo);
      if (failure.voice) {
        this.reply.classList.add("asleep");
        this.reply.textContent = failure.text;
      } else {
        this.reply.classList.add("error");
        this.reply.textContent = failure.text;
      }
      this.replySr.textContent = failure.text;
    } finally {
      clearTimeout(yawnTimer);
      this.d.onYawn(false);
      this.status.textContent = "";
      this.busy = false;
      this.typer = null;
      if (failure?.retryS) this.cooldown.start(failure.retryS); // status shows the countdown
      if (failure?.openSettings) this.d.openSettings();
      this.refresh();
      this.d.afterChat();
    }
  }
}
