// Offline demo: a tiny in-browser Truffle. It runs the real engine module
// (worker/src/engine.ts) so food, tiers, moods and feeding follow v2 rules.
// Time advances naturally, plus the demo's explicit 24-hour advance control.
// Replies are authored samples, never provider output or native step evidence.

import * as engine from "../../worker/src/engine";
import { TIERS, type Tier } from "../../worker/src/config";
import type { TruffleState } from "../../worker/src/engine";
import type { Backend, ChatEvent, Creds, Lang, PairResult, StateSummary, WeatherSummary } from "./types";
import { ApiError } from "./errors";
import { MOMENT_KINDS, type Moment, type MomentKind } from "./moments";
import { momentsFor, nextStreak, ONCE_PER_DAY, trailingStreak } from "../../worker/src/moments";
import { conversationEffort } from "../../worker/src/effort";
import { localDayKey, nextLocalMidnight } from "../../worker/src/time";

const PHRASE = "sand-moon-fig";
const SECRET = "offline-demo";
const DAY_MS = 86_400_000;
const TZ = "Asia/Muscat";

/** Seeds for ?scene= so every mood can be shown without walking. */
function seed(scene: string | null): TruffleState {
  const s = structuredClone(engine.DEFAULT_STATE);
  const truffle = { ...s, stage: "Truffle" as const, lifetime_steps: 42_310, age_days: 9, avg7: 5400, steps_today: 4120 };
  switch (scene) {
    case "spore":
      return { ...s, energy: 2400, lifetime_steps: 2400, steps_today: 2400 };
    case "sprout":
      return { ...s, stage: "Sprout", energy: 6100, lifetime_steps: 12_400, steps_today: 3100, age_days: 3 };
    case "elder":
      return { ...truffle, stage: "Elder", lifetime_steps: 121_000, energy: 21_000, age_days: 30 };
    case "affectionate":
      return { ...truffle, energy: 15_000, affection: 4, steps_today: 9800 };
    case "asleep":
      return { ...truffle, energy: 0, steps_today: 0 };
    case "tired":
      return { ...truffle, energy: 0, zero_days: 1, steps_today: 0 };
    case "wilting":
      return { ...truffle, energy: 0, zero_days: 2, steps_today: 0 };
    case "burrowed":
      return { ...truffle, energy: 8200, burrowed: true };
    case "dead": {
      const d = { ...truffle, energy: 0, zero_days: 4, dead: true, age_days: 12, lifetime_steps: 34_120 };
      d.gravestones = [
        { age_days: 4, lifetime_steps: 3900, stage: "Spore", memory: null },
        engine.gravestoneOf(d, "You showed me the wadi after the rain.")
      ];
      return d;
    }
    case "fresh":
      return s;
    default:
      return { ...truffle, energy: 9000, affection: 1 };
  }
}

const REPLIES: Record<Lang, Record<Exclude<Tier, "asleep">, string[]>> = {
  en: {
    low: ["Hello, you. I'm here.", "A little hello from under the sand."],
    medium: [
      "Hello, you. There is room for a quiet conversation under this little cap.",
      "I'm here with you. Tell me what is on your mind."
    ],
    high: [
      "Here is a small thought from under the sand: a big question can start with one small piece. We can name what matters, look at a few possibilities, and leave room to change our minds.",
      "My cap has room for a longer conversation. We can take a question slowly, untangle its parts, and find a useful next step together."
    ]
  },
  ar: {
    low: ["هلا فيك. أنا هنا.", "سلام صغير من تحت الرمل."],
    medium: [
      "هلا فيك. تحت قبعتي الصغيرة مكان لسالفة هادية.",
      "أنا هنا معك. قول لي وش في بالك."
    ],
    high: [
      "فكرة صغيرة من تحت الرمل: السؤال الكبير يقدر يبدأ بجزء صغير. نحدد اللي يهمك، نشوف كم احتمال، ونترك مجال نغير رأينا.",
      "تحت قبعتي مكان لسالفة أطول. نقدر ناخذ السؤال بهدوء، نفهم أجزاؤه، ونلقى خطوة مفيدة سوا."
    ]
  }
};

const SLEEPY: Record<Lang, string> = {
  en: "I'm here, just resting quietly. Take your time.",
  ar: "أنا هنا، أرتاح بهدوء. خذ راحتك."
};

const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve) => {
  const done = () => { clearTimeout(timer); signal?.removeEventListener("abort", done); resolve(); };
  const timer = setTimeout(done, ms);
  if (signal?.aborted) done();
  else signal?.addEventListener("abort", done, { once: true });
});

export class MockBackend implements Backend {
  readonly mock = true;
  private s: TruffleState;
  private lang: Lang = "ar";
  private turn = 0;
  private key: string;
  private weather: WeatherSummary;
  private cold: boolean;
  private country: string;
  private moments: Moment[] = [];
  private firedToday = new Set<MomentKind>();
  private streak = 0;
  private generation = 0;
  private offsetMs = 0;
  private reservations = new Map<symbol, number>();

  constructor(params: URLSearchParams, demo: boolean) {
    this.key = demo ? "truffle.mock.demo" : "truffle.mock.main";
    const scene = params.get("scene");
    let saved: TruffleState | null = null;
    try {
      const raw = scene ? null : localStorage.getItem(this.key);
      saved = raw ? (JSON.parse(raw) as TruffleState) : null;
    } catch {
      saved = null;
    }
    try {
      const meta = scene ? null : JSON.parse(localStorage.getItem(this.key + ".meta") || "null");
      if (Number.isSafeInteger(meta?.generation) && meta.generation >= 0) this.generation = meta.generation;
      if (Number.isSafeInteger(meta?.offsetMs) && meta.offsetMs >= 0 && meta.offsetMs < 100 * 366 * DAY_MS) this.offsetMs = meta.offsetMs;
      if (meta?.lang === "en" || meta?.lang === "ar") this.lang = meta.lang;
    } catch { /* Old demos have no clock or life metadata. */ }
    const at = Date.now() + this.offsetMs;
    try {
      this.s = engine.initializeV2(saved ?? seed(scene ?? (demo ? "fresh" : null)), at);
    } catch {
      this.s = engine.initializeV2(seed(scene ?? (demo ? "fresh" : null)), at);
    }
    // Migration deliberately clears an unknowable v1 empty duration. Debug
    // scenes have a known duration and must keep their requested expression.
    if (scene === "tired" || scene === "wilting") {
      this.s.empty_ms = scene === "tired" ? DAY_MS : 2 * DAY_MS;
      this.s.zero_days = scene === "tired" ? 1 : 2;
    }
    const rain = params.get("rain") === "1";
    // Debug knobs for screenshots: ?wx=<open-meteo code> ?temp=<apparent C> ?mm=<precipitation>
    const code = Number(params.get("wx") ?? (rain ? 61 : 1));
    const temp = Number(params.get("temp") ?? (rain ? 27 : 34));
    const mm = Number(params.get("mm") ?? (rain ? 1.2 : 0));
    this.weather = {
      text: rain ? "light rain, Muscat" : `${Math.round(temp)}C clear, Muscat`,
      apparent_c: temp,
      daytime_max_c: this.s.burrowed ? 44 : 36,
      precipitation_mm: mm,
      wind_kmh: Number(params.get("wind") ?? 14) || 0,
      is_day: true,
      weather_code: code
    };
    this.cold = params.get("cold") === "1";
    this.country = (params.get("country") ?? "OM").toUpperCase().slice(0, 2);
    try {
      const raw = scene ? null : localStorage.getItem(this.key + ".moments");
      this.moments = raw ? (JSON.parse(raw) as Moment[]) : [];
    } catch {
      this.moments = [];
    }
    try {
      const meta = scene ? null : JSON.parse(localStorage.getItem(this.key + ".rewardState") || "null");
      this.streak = Number.isSafeInteger(meta?.streak) ? meta.streak : trailingStreak(this.s.history7);
      this.firedToday = new Set((meta?.firedToday || []).filter((k: MomentKind) => MOMENT_KINDS.includes(k)));
    } catch { this.streak = trailingStreak(this.s.history7); }
    // Debug knob for screenshots: ?moment=<kind>[&mv=<value>] adds one fresh moment.
    const mk = params.get("moment");
    if (mk && (MOMENT_KINDS as readonly string[]).includes(mk)) {
      const fallback: Record<MomentKind, number> = {
        stage_up: 2, best_day: 7420, beat_avg7: 6100, day_10k: 10_240, streak: 7, lifetime: 50_000, heat_day_indoor: 2300
      };
      this.addMoments([{ kind: mk as MomentKind, value: Number(params.get("mv")) || fallback[mk as MomentKind] }]);
    }
    this.settle();
  }

  private now(): number {
    return Math.max(Date.now() + this.offsetMs, this.s.energy_settled_ms!);
  }

  private heldCost(): number {
    return [...this.reservations.values()].reduce((sum, cost) => sum + cost, 0);
  }

  private settle(): void {
    const to = this.now();
    const wasDead = this.s.dead;
    let boundary = nextLocalMidnight(this.s.energy_settled_ms!, TZ);
    while (!this.s.dead && boundary <= to) {
      this.s = engine.settleV2(this.s, boundary, this.heldCost());
      if (this.s.dead) break;
      const after = engine.midnight(this.s, this.s.burrowed);
      this.reward(after, "midnight");
      this.streak = nextStreak(this.streak, this.s.steps_today);
      this.firedToday.clear();
      this.s = after;
      boundary = nextLocalMidnight(boundary, TZ);
    }
    this.s = engine.settleV2(this.s, to, this.heldCost());
    if (!wasDead && this.s.dead) {
      this.generation++;
      this.reservations.clear();
    }
    this.save();
  }

  private addMoments(list: { kind: MomentKind; value: number }[]): void {
    let id = this.moments.length ? this.moments[this.moments.length - 1].id : 0;
    for (const m of list) this.moments.push({ id: ++id, kind: m.kind, at_ms: this.now(), value: m.value });
    this.moments = this.moments.slice(-20);
    try {
      localStorage.setItem(this.key + ".moments", JSON.stringify(this.moments));
    } catch {
      /* fine */
    }
  }

  private save(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.s));
      localStorage.setItem(this.key + ".rewardState", JSON.stringify({ streak: this.streak, firedToday: [...this.firedToday] }));
      localStorage.setItem(this.key + ".meta", JSON.stringify({ generation: this.generation, offsetMs: this.offsetMs, lang: this.lang }));
    } catch {
      /* fine, memory only */
    }
  }

  private summary(): StateSummary & { moments: Moment[] } {
    const energy_max = engine.energyCapacity(this.s);
    return {
      generation: this.generation,
      moments: structuredClone(this.moments),
      state: structuredClone(this.s),
      mood: engine.moodOf(this.s),
      tier: engine.decideTier(this.s, undefined, this.heldCost()).tier,
      energy_max,
      energy_pct: Math.round((100 * this.s.energy) / energy_max),
      tz: TZ,
      country: this.country,
      lang: this.lang,
      city: "Muscat",
      demo: this.key.endsWith("demo"),
      local_day: localDayKey(this.now(), TZ),
      next_midnight_ms: nextLocalMidnight(this.now(), TZ),
      weather: { ...this.weather, daytime_max_c: this.s.burrowed ? 44 : 36 }
    };
  }

  private update(s: TruffleState): Promise<StateSummary> {
    this.s = s;
    this.save();
    return Promise.resolve(this.summary());
  }

  async pair(lang?: Lang): Promise<PairResult> {
    if (lang) this.lang = lang;
    this.settle();
    return { phrase: PHRASE, secret: SECRET, ...this.summary() };
  }
  spawn(lang?: Lang) {
    return this.pair(lang);
  }
  async state(_c: Creds) {
    this.settle();
    return this.summary();
  }
  spore(_c: Creds) {
    this.settle();
    if (this.s.dead) { this.generation++; this.reservations.clear(); this.streak = 0; this.firedToday.clear(); }
    return this.update(this.s.dead ? engine.newSpore(this.s, this.now()) : this.s);
  }
  private reward(after: TruffleState, event: "feed" | "midnight"): void {
    const list = momentsFor(this.s, after, { event, now_ms: this.now(), next_id: 1, already_today: [...this.firedToday], streak_before: this.streak });
    this.addMoments(list);
    for (const m of list) if (ONCE_PER_DAY.includes(m.kind)) this.firedToday.add(m.kind);
  }
  slider(_c: Creds, steps: number) {
    this.settle();
    const after = engine.feed(this.s, steps);
    this.reward(after, "feed");
    return this.update(after);
  }
  midnight(_c: Creds) {
    this.settle();
    this.offsetMs = this.now() + DAY_MS - Date.now();
    this.settle();
    return Promise.resolve(this.summary());
  }
  heat(_c: Creds, on: boolean) {
    this.settle();
    return this.update({ ...this.s, burrowed: on });
  }
  reset(_c: Creds) {
    this.generation++;
    this.reservations.clear();
    this.offsetMs = 0;
    this.moments = [];
    this.addMoments([]);
    this.streak = 0;
    this.firedToday.clear();
    return this.update(engine.initializeV2(engine.DEFAULT_STATE, Date.now()));
  }

  async *chat(_c: Creds, message: string, lang: Lang, requested?: Tier, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
    if (signal?.aborted) return;
    this.lang = lang;
    this.settle();
    const generation = this.generation;
    if (this.s.dead) throw new ApiError(409, "truffle is dead; POST /spore to plant a new one");
    const decision = engine.decideTier(this.s, conversationEffort(this.s, message, requested), this.heldCost());
    const reservation = Symbol("sample reply");
    this.reservations.set(reservation, decision.cost);
    const current = () => generation === this.generation && !signal?.aborted;
    const brain = decision.model_call ? "sample" : "none";
    const pool = decision.tier === "asleep" ? null : REPLIES[lang][decision.tier];
    const text = this.s.burrowed
      ? lang === "ar" ? "أنا تحت الرمل بعيد عن الحر. خذ راحتك في مكان بارد." : "I'm under the sand, out of the heat. Stay comfortable somewhere cool."
      : pool ? pool[(message.length + ++this.turn) % pool.length] : SLEEPY[lang];
    try {
      await wait(decision.model_call ? (this.cold ? 3400 : 700) : 150, signal);
      this.settle();
      if (!current()) return;
      yield { type: "brain", brain, half_awake: false };
      let charged = false;
      for (const chunk of decision.model_call ? text.match(/.{1,6}/gsu) ?? [] : [text]) {
        if (decision.model_call) await wait(45, signal);
        this.settle();
        if (!current()) return;
        if (!charged) {
          this.s = engine.commitReservedChatV2(this.s, decision.cost, this.heldCost() - decision.cost);
          this.reservations.delete(reservation);
          charged = true;
          this.save();
        }
        yield { type: "token", text: chunk };
      }
      if (!current()) return;
      this.settle();
      yield { type: "done", tier: decision.tier, brain, half_awake: false, spent: TIERS[decision.tier].cost, partial: false, summary: this.summary() };
    } finally {
      this.reservations.delete(reservation);
      if (generation === this.generation) this.settle();
    }
  }
}
