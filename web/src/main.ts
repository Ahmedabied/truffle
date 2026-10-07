// Boot, pairing, polling, language, settings and judge mode.

import "./style.css";
import { ApiError, apiBase, connect, setApiBase } from "./api";
import { Chat } from "./chat";
import { COPY, MOOD_WORD, STAGE_WORD, TIER_WORD, explainGrew, explainMidnight, explainSteps, type CopyKey, type Lang } from "./copy";
import { makeFitter } from "./scene/grid";
import { World } from "./scene/world";
import type { Backend, Creds, StateSummary, Tier } from "./types";

const POLL_MS = 30_000;
const SLIDER_DEBOUNCE_MS = 350;
const K = {
  creds: "truffle.creds",
  demo: "truffle.demo",
  lang: "truffle.lang",
  font: "truffle.font",
  motion: "truffle.motion"
};

const params = new URLSearchParams(location.search);
const DEMO = /\/demo\/?$/.test(location.pathname) || params.get("demo") === "1";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const store = {
  get<T>(k: string): T | null {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown): void {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode: fine */
    }
  },
  del(k: string): void {
    try {
      localStorage.removeItem(k);
    } catch {
      /* fine */
    }
  }
};

// ---------- app state ----------

let backend: Backend;
let creds: Creds | null = null;
let summary: StateSummary | null = null;
let lang: Lang = store.get<Lang>(K.lang) ?? (navigator.language?.toLowerCase().startsWith("ar") ? "ar" : "en");
let langChosen = store.get<Lang>(K.lang) !== null;
let halfAwake = false;
let lastWhy = "";

const world = new World($("world"));
const media = matchMedia("(prefers-reduced-motion: reduce)");
const motionBox = $<HTMLInputElement>("motion");
motionBox.checked = store.get<boolean>(K.motion) ?? false;
const reduced = () => media.matches || motionBox.checked;

const hourParam = params.get("hour");
world.set({ hourOverride: hourParam !== null && Number.isFinite(Number(hourParam)) ? Number(hourParam) % 24 : null });

makeFitter($("scene"), $("world"), $("probe"), () => world.draw());

const chat = new Chat(
  $<HTMLFormElement>("chatForm"),
  $<HTMLInputElement>("msg"),
  $("reply"),
  $("replySr"),
  $("status"),
  {
    backend: () => backend,
    creds: () => creds,
    lang: () => lang,
    summary: () => summary,
    reduced,
    requested: () => (($<HTMLSelectElement>("ask").value || undefined) as Tier | undefined),
    onYawn: (on) => world.set({ yawn: on }),
    onHalfAwake: (on) => {
      halfAwake = on;
      $("half").hidden = !on;
    },
    onSummary: (s) => render(s),
    onExplain: (t) => explain(t),
    afterChat: () => void poll()
  }
);

// ---------- language ----------

const t = (k: CopyKey) => COPY[lang][k];

function applyLang(): void {
  const c = COPY[lang];
  document.documentElement.lang = lang;
  // UI flows RTL in Arabic. The world keeps dir="ltr" on its own element.
  $("app").dir = lang === "ar" ? "rtl" : "ltr";
  document.querySelectorAll<HTMLElement>("[data-c]").forEach((el) => {
    el.textContent = c[el.dataset.c as CopyKey];
  });
  document.querySelectorAll<HTMLElement>("[data-c-aria]").forEach((el) => {
    el.setAttribute("aria-label", c[el.dataset.cAria as CopyKey]);
  });
  $("langBtn").lang = lang === "ar" ? "en" : "ar";
  $("msg").setAttribute("aria-label", c.placeholder);
  const ask = $<HTMLSelectElement>("ask");
  for (const o of Array.from(ask.options)) if (o.value) o.textContent = TIER_WORD[lang][o.value as Tier];
  document.title = DEMO ? `${c.title} | ${c.judgeTitle}` : c.title;
  if (summary) render(summary);
  chat.refresh();
}

$("langBtn").addEventListener("click", () => {
  lang = lang === "ar" ? "en" : "ar";
  langChosen = true;
  store.set(K.lang, lang);
  applyLang();
});

// ---------- rendering ----------

function explain(text: string): void {
  lastWhy = text;
  $("why").textContent = text;
}

function render(s: StateSummary): void {
  summary = s;
  const st = s.state;
  world.set({
    stage: st.stage,
    mood: s.mood,
    tier: s.tier,
    energyPct: s.energy_pct,
    stepsToday: st.steps_today,
    gravestones: st.gravestones,
    ageDays: st.gravestones.length && st.dead ? st.gravestones[st.gravestones.length - 1].age_days : st.age_days,
    lifetimeSteps: st.gravestones.length && st.dead ? st.gravestones[st.gravestones.length - 1].lifetime_steps : st.lifetime_steps,
    country: s.country,
    tz: s.tz,
    rain: (s.weather?.precipitation_mm ?? 0) > 0,
    windKmh: s.weather?.wind_kmh ?? 8,
    weatherCode: s.weather?.weather_code ?? 1
  });
  world.draw(); // show a state change at once, not on the next tick

  const sep = " · ";
  const hud = [
    `${t("energy")} ${s.energy_pct}%`,
    STAGE_WORD[lang][st.stage],
    `${st.steps_today.toLocaleString("en-US")} ${t("stepsToday")}`,
    `${t("effort")} ${TIER_WORD[lang][s.tier]}`,
    MOOD_WORD[lang][s.mood]
  ];
  if (s.weather?.text) hud.push(s.weather.text);
  $("hud").textContent = hud.join(sep);
  $("world").setAttribute(
    "aria-label",
    `${MOOD_WORD.en[s.mood]} ${st.stage}. Energy ${s.energy_pct} percent. ${st.steps_today} steps today. Effort ${s.tier}.` +
      (s.weather?.text ? ` Weather: ${s.weather.text}.` : "")
  );

  const last = st.gravestones[st.gravestones.length - 1];
  const mem = st.dead && last?.memory;
  $("memory").hidden = !mem;
  if (mem) $("memory").textContent = `${t("memoryPrefix")} ${last.memory}`;
  $("sporeBtn").hidden = !st.dead;
  $("sporeBtn2").hidden = !st.dead;

  if (DEMO) {
    const slider = $<HTMLInputElement>("steps");
    if (document.activeElement !== slider && !sliderPending) {
      slider.value = String(st.steps_today);
      $("stepsOut").textContent = st.steps_today.toLocaleString("en-US");
    }
    const heat = $("heatBtn");
    heat.setAttribute("aria-pressed", String(st.burrowed));
    heat.textContent = st.burrowed ? t("heatOn") : t("heatOff");
  }
  chat.refresh();
}

// ---------- backend calls ----------

function isAuthLoss(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 401 || e.status === 404);
}

function failed(e: unknown): void {
  const status = (e as { status?: number }).status ?? 0;
  // 429 carries a readable server message (demo spawn limits). Others get the calm generic line.
  explain(status === 0 ? t("networkError") : status === 429 ? (e as Error).message : `${t("chatError").split(".")[0]}. (${(e as Error).message})`);
}

async function poll(): Promise<void> {
  if (!creds || document.hidden) return;
  try {
    render(await backend.state(creds));
  } catch (e) {
    if (isAuthLoss(e) && !backend.mock) {
      // The Truffle is gone (demo expired, or storage from another server). Start again.
      store.del(DEMO ? K.demo : K.creds);
      creds = null;
      await ensurePaired();
    }
  }
}

async function ensurePaired(): Promise<void> {
  if (backend.mock) {
    const r = DEMO ? await backend.spawn(lang) : await backend.pair(lang);
    creds = { phrase: r.phrase, secret: r.secret };
    if (!langChosen) lang = r.lang;
    return;
  }
  const key = DEMO ? K.demo : K.creds;
  const saved = store.get<Creds & { expires_ms?: number }>(key);
  if (saved?.phrase && saved.secret && !(saved.expires_ms && saved.expires_ms < Date.now())) {
    try {
      creds = { phrase: saved.phrase, secret: saved.secret };
      const s = await backend.state(creds);
      if (!langChosen) lang = s.lang;
      render(s);
      return;
    } catch (e) {
      if (!isAuthLoss(e)) throw e;
      store.del(key);
    }
  }
  $("status").textContent = t("pairing");
  const r = DEMO ? await backend.spawn(lang) : await backend.pair(langChosen ? lang : undefined);
  creds = { phrase: r.phrase, secret: r.secret };
  store.set(key, { ...creds, ...(r.expires_ms ? { expires_ms: r.expires_ms } : {}) });
  if (!langChosen) lang = r.lang;
  $("status").textContent = "";
  render(r);
}

async function act(fn: () => Promise<StateSummary>, why: (before: StateSummary, after: StateSummary) => string): Promise<void> {
  if (!creds || !summary) return;
  const before = summary;
  const buttons = document.querySelectorAll<HTMLButtonElement>("#judge button, #sporeBtn, #sporeBtn2");
  buttons.forEach((b) => (b.disabled = true));
  try {
    const after = await fn();
    render(after);
    let text = why(before, after);
    if (after.state.stage !== before.state.stage && !after.state.dead && after.state.lifetime_steps > before.state.lifetime_steps) {
      text += " " + explainGrew(lang, after.state.stage);
    }
    explain(text);
  } catch (e) {
    failed(e);
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

// ---------- spore, settings ----------

const plantSpore = () =>
  act(
    () => backend.spore(creds!),
    () => t("newSporeDone")
  );
$("sporeBtn").addEventListener("click", plantSpore);
$("sporeBtn2").addEventListener("click", plantSpore);

$("copyBtn").addEventListener("click", async () => {
  const text = creds?.phrase ?? "";
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const r = document.createRange();
    r.selectNodeContents($("phrase"));
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(r);
  }
  $("copyBtn").textContent = t("copied");
  setTimeout(() => ($("copyBtn").textContent = t("copy")), 1500);
});

let scale = store.get<number>(K.font) ?? 1;
const applyScale = () => document.documentElement.style.setProperty("--ui-scale", String(scale));
applyScale();
$("fontDown").addEventListener("click", () => {
  scale = Math.max(0.85, Math.round((scale - 0.1) * 100) / 100);
  store.set(K.font, scale);
  applyScale();
});
$("fontUp").addEventListener("click", () => {
  scale = Math.min(1.5, Math.round((scale + 0.1) * 100) / 100);
  store.set(K.font, scale);
  applyScale();
});

function syncMotion(): void {
  world.setReduced(reduced());
  $("motionNote").hidden = !media.matches;
  motionBox.disabled = media.matches;
  chat.skip();
}
motionBox.addEventListener("change", () => {
  store.set(K.motion, motionBox.checked);
  syncMotion();
});
media.addEventListener?.("change", syncMotion);

$<HTMLInputElement>("api").value = apiBase();
$("apiSave").addEventListener("click", () => {
  setApiBase($<HTMLInputElement>("api").value);
  location.reload();
});
$("forgetBtn").addEventListener("click", () => {
  store.del(DEMO ? K.demo : K.creds);
  location.reload();
});

// ---------- judge mode ----------

let sliderPending = false;
let sliderTimer = 0;

function setupJudge(): void {
  const judge = $("judge");
  judge.hidden = false;
  // Judges come for the controls: put them right under the world, with the explanation line.
  $("sporeBtn").after(judge);
  judge.append($("why"));
  const slider = $<HTMLInputElement>("steps");
  slider.addEventListener("input", () => {
    const steps = Number(slider.value);
    $("stepsOut").textContent = steps.toLocaleString("en-US");
    sliderPending = true;
    clearTimeout(sliderTimer);
    sliderTimer = window.setTimeout(() => {
      sliderPending = false;
      void act(
        () => backend.slider(creds!, steps),
        (b, a) =>
          steps < b.state.steps_today
            ? t("stepsOnlyUp")
            : explainSteps(lang, a.state.steps_today, a.energy_pct, a.tier, a.state.burrowed)
      );
    }, SLIDER_DEBOUNCE_MS);
  });
  $("midBtn").addEventListener("click", () =>
    act(
      () => backend.midnight(creds!),
      (b, a) =>
        explainMidnight(lang, {
          burned: Math.max(0, b.state.energy - a.state.energy),
          pct: a.energy_pct,
          zero_days: a.state.zero_days,
          dead: a.state.dead && !b.state.dead,
          wasBurrowed: b.state.burrowed,
          affectionUp: a.state.affection > b.state.affection
        })
    )
  );
  $("heatBtn").addEventListener("click", () => {
    const on = !(summary?.state.burrowed ?? false);
    void act(
      () => backend.heat(creds!, on),
      () => (on ? t("heatExplainOn") : t("heatExplainOff"))
    );
  });
  $("resetBtn").addEventListener("click", () =>
    act(
      () => backend.reset(creds!),
      () => t("freshSpore")
    )
  );
}

// ---------- boot ----------

async function boot(): Promise<void> {
  applyLang();
  syncMotion();
  world.start();
  $("hud").textContent = t("loading");
  if (DEMO) setupJudge();

  backend = await connect(params, DEMO);
  $("offline").hidden = !backend.mock;
  try {
    await ensurePaired();
    if (backend.mock && creds) render(await backend.state(creds));
  } catch (e) {
    failed(e);
    $("hud").textContent = t("networkError");
    return;
  }
  $("phrase").textContent = creds?.phrase ?? "";
  applyLang();
  if (!lastWhy && summary) explain(explainSteps(lang, summary.state.steps_today, summary.energy_pct, summary.tier, summary.state.burrowed));
  $("half").hidden = !halfAwake;

  setInterval(() => void poll(), POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void poll();
  });
}

void boot();

// Read-only hooks for the screenshot harness and a remote phone console.
(window as unknown as { truffle: unknown }).truffle = {
  summary: () => summary,
  frames: () => world.frames,
  mock: () => backend?.mock ?? null,
  demo: DEMO
};
