// Offline demo: a tiny in-browser Truffle. It runs the real engine module
// (worker/src/engine.ts) so tiers, moods, feeding and midnight follow the same
// rules as the Worker. Only the brain is canned. Marked "offline demo" in the UI.

import * as engine from "../../worker/src/engine";
import { TIERS, type Tier } from "../../worker/src/config";
import type { TruffleState } from "../../worker/src/engine";
import type { Backend, ChatEvent, Creds, Lang, PairResult, StateSummary, WeatherSummary } from "./types";

const PHRASE = "sand-moon-fig";
const SECRET = "offline-demo";

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
    low: ["mm. hi. low on juice. a short walk?", "I'm here. just a little sleepy."],
    medium: [
      "Hello you. The sand is warm today. I counted your steps like little drums.",
      "I feel steady. Not bouncy, not sleepy. A walk after sunset would be lovely."
    ],
    high: [
      "You came back! I have so much energy I could crack the crust and peek at the sky. Tell me where you walked. Was there wind? I like the wind. It tells me stories about other dunes.",
      "I'm wide awake and thinking clearly. Your steps this week look strong. Let's keep it gentle tonight, maybe a slow loop when it cools down."
    ]
  },
  ar: {
    low: ["امم. هلا. طاقتي قليلة. مشية قصيرة؟", "أنا هنا. بس نعسان شوي."],
    medium: [
      "هلا فيك. الرمل دافي اليوم. عدّيت خطواتك مثل طبول صغيرة.",
      "أحس إني مرتاح. لا نشيط واجد ولا نعسان. مشية بعد المغرب بتكون حلوة."
    ],
    high: [
      "رجعت! عندي طاقة واجد، أقدر أشق الرمل وأطالع السما. قول لي وين مشيت؟ كان فيه هوا؟ أحب الهوا، يحكي لي عن كثبان ثانية.",
      "أنا صاحي وأفكر بوضوح. خطواتك هالأسبوع قوية. خلنا نخليها خفيفة الليلة، يمكن لفة هادية لين يبرد الجو."
    ]
  }
};

const SLEEPY: Record<Lang, string[]> = {
  en: ["zzz... (Truffle is asleep under the sand. A walk would wake it.)", "(a tiny snore comes from the sand)"],
  ar: ["خخخ... (ترافل نايم تحت الرمل. مشية بسيطة تصحّيه.)", "(شخير صغير يطلع من الرمل)"]
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockBackend implements Backend {
  readonly mock = true;
  private s: TruffleState;
  private lang: Lang = "ar";
  private turn = 0;
  private key: string;
  private weather: WeatherSummary;
  private cold: boolean;
  private country: string;

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
    this.s = saved ?? seed(scene ?? (demo ? "fresh" : null));
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
  }

  private save(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.s));
    } catch {
      /* fine, memory only */
    }
  }

  private summary(): StateSummary {
    const { energy_max } = engine.stageConfig(this.s.stage);
    return {
      state: structuredClone(this.s),
      mood: engine.moodOf(this.s),
      tier: engine.decideTier(this.s).tier,
      energy_max,
      energy_pct: Math.round((100 * this.s.energy) / energy_max),
      tz: "Asia/Muscat",
      country: this.country,
      lang: this.lang,
      city: "Muscat",
      demo: this.key.endsWith("demo"),
      local_day: new Date().toISOString().slice(0, 10),
      next_midnight_ms: null,
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
    return { phrase: PHRASE, secret: SECRET, ...this.summary() };
  }
  spawn(lang?: Lang) {
    return this.pair(lang);
  }
  async state(_c: Creds) {
    return this.summary();
  }
  spore(_c: Creds) {
    return this.update(this.s.dead ? engine.newSpore(this.s) : this.s);
  }
  slider(_c: Creds, steps: number) {
    return this.update(engine.feed(this.s, steps));
  }
  midnight(_c: Creds) {
    return this.update(engine.midnight(this.s, false, "You walked me to the sea once."));
  }
  heat(_c: Creds, on: boolean) {
    return this.update({ ...this.s, burrowed: on });
  }
  reset(_c: Creds) {
    return this.update(structuredClone(engine.DEFAULT_STATE));
  }

  async *chat(_c: Creds, message: string, lang: Lang, requested?: Tier): AsyncGenerator<ChatEvent> {
    this.lang = lang;
    if (this.s.dead) throw Object.assign(new Error("truffle is dead; POST /spore to plant a new one"), { status: 409 });
    const decision = engine.decideTier(this.s, requested);
    const half = this.cold || (decision.model_call && ++this.turn % 5 === 0);
    await wait(decision.model_call ? (half ? 3400 : 700) : 150);
    const brain = decision.model_call ? (half ? "workers-ai" : "modal") : "none";
    yield { type: "brain", brain, half_awake: half };
    const pool = decision.tier === "asleep" ? SLEEPY[lang] : REPLIES[lang][decision.tier];
    const text = pool[(message.length + this.turn) % pool.length];
    if (decision.tier === "asleep") yield { type: "token", text };
    else for (const chunk of text.match(/.{1,6}/gsu) ?? []) {
      await wait(45);
      yield { type: "token", text: chunk };
    }
    this.s = engine.chargeChat(this.s, decision);
    this.save();
    yield { type: "done", tier: decision.tier, brain, half_awake: half, spent: TIERS[decision.tier].cost, partial: false, summary: this.summary() };
  }
}
