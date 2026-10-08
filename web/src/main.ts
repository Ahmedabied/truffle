// Boot, pairing, polling, language, settings and judge mode.

import "./style.css";
import { ApiError, DEFAULT_API, apiBase, connect, setApiBase } from "./api";
import { credentialKey, normalizeApiOrigin, verifyImportedPet } from "./credentials";
import { Chat } from "./chat";
import { MockBackend } from "./mock";
import { Cooldown, describeError, waitText, type ErrorCtx } from "./errors";
import { FpsMeter, fpsEnabled, fpsText } from "./fps";
import { COPY, MOOD_WORD, STAGE_WORD, TIER_WORD, explainGrew, explainMidnight, explainSteps, momentLine, type CopyKey, type Lang } from "./copy";
import { appLink, inApp, offerApp, takeCredsFromHash } from "./handoff";
import { MOMENT_SHOW_MS, lastIdKey, momentsOf, pickNew, recent, type Moment, type MomentKind } from "./moments";
import { cardHost, deliver, drawCard, fileName, readWorld, toBlob } from "./share";
import { makeFitter } from "./scene/grid";
import { World } from "./scene/world";
import { AWAY_MS, giftText, readShelf, returnToShelf, shelfKey, type Keepsake } from "./keepsakes";
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

// Credentials from the Truffle app arrive once as #creds=<phrase>.<secret>.
// Strip immediately; adoption happens only after consent and server validation.
const importedCreds = takeCredsFromHash(location, history, () => {});
const petKey = () => credentialKey(apiBase(), DEFAULT_API, DEMO);
const IN_APP = inApp(navigator.userAgent);
if (IN_APP) document.documentElement.classList.add("in-app");

// ---------- app state ----------

let backend: Backend;
let creds: Creds | null = null;
let summary: StateSummary | null = null;
const savedLang = store.get<unknown>(K.lang);
let lang: Lang = savedLang === "ar" || savedLang === "en" ? savedLang : (navigator.language?.toLowerCase().startsWith("ar") ? "ar" : "en");
let langChosen = savedLang === "ar" || savedLang === "en";
let halfAwake = false;
let lastWhy = "";

const world = new World($("world"));
const media = matchMedia("(prefers-reduced-motion: reduce)");
const motionBox = $<HTMLInputElement>("motion");
motionBox.checked = store.get<boolean>(K.motion) ?? false;
const reduced = () => media.matches || motionBox.checked || $<HTMLDialogElement>("pauseDialog").open;

const hourParam = params.get("hour");
world.set({ hourOverride: hourParam !== null && Number.isFinite(Number(hourParam)) ? Number(hourParam) % 24 : null });
const moonParam = new URLSearchParams(location.search).get("moon");
world.set({ moonOverride: moonParam !== null && Number.isFinite(Number(moonParam)) ? Number(moonParam) % 1 : null });

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
    onDetails: (text) => { $("chatDetails").textContent = text; },
    afterChat: () => void poll(),
    demo: DEMO,
    openSettings: () => openSettings(),
    blocked: () => actionBusy || sliderPending,
    onBusy: (busy) => {
      chatBusy = busy;
      setActDisabled(actCooldown.active());
    }
  }
);

// ---------- language ----------

const t = (k: CopyKey) => COPY[lang][k];

function applyLang(): void {
  const c = COPY[lang];
  document.documentElement.lang = lang;
  // UI flows RTL in Arabic. The world keeps dir="ltr" on its own element.
  $("app").dir = lang === "ar" ? "rtl" : "ltr";
  $("pocketDialog").dir = lang === "ar" ? "rtl" : "ltr";
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
  if (backend?.mock) $("judgeIntro").textContent = c.offlineIntro;
  $("demoMode").hidden = !DEMO || !!backend?.mock;
  $("tryDemo").hidden = DEMO || IN_APP;
}

$("langBtn").addEventListener("click", () => {
  lang = lang === "ar" ? "en" : "ar";
  langChosen = true;
  store.set(K.lang, lang);
  applyLang();
  if (summary) explain(t("energyNote"));
});

// Pocket keeps secondary controls out of the living world.
const pocketDialog = $<HTMLDialogElement>("pocketDialog");
function openPocket(): void {
  if (!pocketDialog.open) { $("pocketStatus").textContent = ""; pocketDialog.showModal(); }
}
function closePocket(): void { if (pocketDialog.open) pocketDialog.close(); }
$("pocketBtn").addEventListener("click", openPocket);
$("pocketClose").addEventListener("click", closePocket);

// ---------- rendering ----------

function explain(text: string): void {
  lastWhy = text;
  $("why").textContent = text;
  if (pocketDialog.open) $("pocketStatus").textContent = text;
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
    precipMm: s.weather?.precipitation_mm ?? 0,
    windKmh: s.weather?.wind_kmh ?? 8,
    weatherCode: s.weather?.weather_code ?? 1,
    apparentC: s.weather?.apparent_c ?? 30
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
  if (st.dead) {
    const days = st.gravestones[st.gravestones.length - 1]?.age_days ?? st.age_days;
    const steps = st.gravestones[st.gravestones.length - 1]?.lifetime_steps ?? st.lifetime_steps;
    hud.push(lang === "ar" ? `عاش ${days.toLocaleString("en-US")} يوم و ${steps.toLocaleString("en-US")} خطوة` : `lived ${days.toLocaleString("en-US")} days and ${steps.toLocaleString("en-US")} steps`);
  }
  $("hudText").textContent = `${st.steps_today.toLocaleString("en-US")} ${t("stepsToday")}`;
  $("hud").setAttribute("aria-label", `${$("hudText").textContent}. ${t("momentsShow")}`);
  $("worldDetails").textContent = hud.join(sep);
  $("energyValue").textContent = `${s.energy_pct}%`;
  $("energyTrack").setAttribute("aria-valuenow", String(s.energy_pct));
  $("energyFill").style.width = `${s.energy_pct}%`;
  $("worldTime").textContent = backend?.mock ? t("sampleWorld") : new Intl.DateTimeFormat(lang === "ar" ? "ar-OM" : "en-GB", { timeZone: s.tz, hour: "2-digit", minute: "2-digit" }).format(new Date());
  $("outingBtn").hidden = st.dead;
  $("outingBtn").classList.toggle("primary", !DEMO);
  refreshKeepsakes();
  resumeOuting();
  onMoments(s);
  $("world").setAttribute(
    "aria-label",
    hud.join(". ")
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
  $("chatHint").textContent = st.dead ? t("placeholderDead") : st.burrowed ? t("heatRest") : s.tier === "asleep" ? t(DEMO ? "demoStart" : "chatHint") : t("chatReady");
}

// A small local shelf. API and pet boundaries are also collection boundaries.
const collectionKey = () => creds ? shelfKey(apiBase(), creds.phrase, DEMO || !!backend?.mock) : null;
const outingKey = () => { const key = collectionKey(); return key ? `${key}/outing` : null; };
function finishOuting(): void { const key = outingKey(); if (key) store.del(key); }
function resumeOuting(): void {
  const key = outingKey();
  if (!key || document.hidden || $<HTMLDialogElement>("pauseDialog").open) return;
  const saved = store.get<{ version?: number; kind?: string; at?: number }>(key);
  if (!saved) return;
  finishOuting();
  if (saved.version === 1 && ["outingWalk", "outingErrand"].includes(saved.kind ?? "") && Number.isFinite(saved.at)) explain(t("returnNotice"));
}
let selectedGift: Keepsake | null = null;
let selectedCollection = "";
let giftListSignature = "";
let sceneGiftSignature = "uninitialized";
const giftWorld = world as unknown as { setKeepsakes?: (items: Array<{ id: string; art: string }>) => void; hitGift?: (x: number, y: number) => string | null };
function markGiftSeen(gift: Keepsake): void {
  const key = collectionKey();
  if (key) store.set(`${key}/read`, Math.max(store.get<number>(`${key}/read`) ?? 0, gift.at));
}
function showGift(gift: Keepsake): void {
  selectedGift = gift;
  markGiftSeen(gift);
  refreshKeepsakes();
  const card = $("chatGift");
  const g = giftText(gift, lang);
  const art = document.createElement("pre"); art.dir = "ltr"; art.setAttribute("aria-hidden", "true"); art.textContent = g.art;
  const words = document.createElement("div");
  const from = document.createElement("span"); from.className = "gift-from"; from.textContent = t("giftFrom");
  const name = document.createElement("h3"); name.textContent = g.name;
  const note = document.createElement("p"); note.textContent = g.note;
  words.append(from, name, note); card.replaceChildren(art, words); card.hidden = false;
  closePocket(); card.focus({ preventScroll: true }); card.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
}
$("scene").addEventListener("click", (event) => {
  const id = giftWorld.hitGift?.(event.clientX, event.clientY);
  const key = collectionKey();
  const gift = key && id ? readShelf(store.get(key)).gifts.find(g => String(g.at) === id) : null;
  if (gift) showGift(gift);
});
$("scene").addEventListener("pointermove", (event) => {
  $("scene").style.cursor = giftWorld.hitGift?.(event.clientX, event.clientY) ? "pointer" : "default";
});
$("chatForm").addEventListener("submit", () => { $("chatGift").hidden = true; });

function refreshKeepsakes(): void {
  const key = collectionKey();
  if (!key || !summary) return;
  if (key !== selectedCollection) { selectedGift = null; selectedCollection = key; giftListSignature = ""; sceneGiftSignature = "uninitialized"; $("chatGift").hidden = true; }
  const stored = readShelf(store.get(key));
  const result = document.hidden || $<HTMLDialogElement>("pauseDialog").open
    ? { shelf: stored, gift: undefined }
    : returnToShelf(stored, Date.now(), summary.local_day, key, !summary.state.dead);
  store.set(key, result.shelf);
  if (result.gift) selectedGift = result.gift;
  const gifts = result.shelf.gifts;
  const unread = (gifts.at(-1)?.at ?? 0) > (store.get<number>(`${key}/read`) ?? 0);
  $("giftWaiting").hidden = !unread;
  $("keepsakes").classList.toggle("has-new", unread);
  $("pocketBtn").classList.toggle("has-new", unread);
  $("pocketBtn").setAttribute("aria-label", unread ? `${t("pocket")}. ${t("giftWaiting")}` : t("pocket"));
  const sceneSignature = gifts.slice(-3).map(g => `${g.at}:${g.kind}`).join(",");
  if (sceneSignature !== sceneGiftSignature && giftWorld.setKeepsakes) {
    giftWorld.setKeepsakes(gifts.slice(-3).map(g => ({ id: String(g.at), art: giftText(g, lang).art })));
    sceneGiftSignature = sceneSignature;
  }
  if (!selectedGift || !gifts.some(g => g.at === selectedGift!.at)) selectedGift = gifts.at(-1) ?? null;
  $("giftCount").textContent = String(gifts.length);
  $("giftsEmpty").hidden = gifts.length > 0;
  $("giftCard").hidden = !selectedGift;
  $("previewGift").hidden = !DEMO;
  $<HTMLButtonElement>("previewGift").disabled = summary.state.dead || gifts.some(g => g.day >= summary!.local_day);
  if (selectedGift) {
    const g = giftText(selectedGift, lang);
    $("giftArt").textContent = g.art;
    $("giftName").textContent = g.name;
    $("giftNote").textContent = g.note;
    $("giftDate").textContent = selectedGift.day;
    $("giftDate").setAttribute("datetime", selectedGift.day);
  }
  const signature = `${lang}:${gifts.map(g => g.at + ":" + g.kind).join(",")}`;
  if (signature !== giftListSignature) {
    $("giftList").replaceChildren(...gifts.slice().reverse().map(g => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "gift-choice small"; b.dataset.gift = String(g.at);
      b.textContent = giftText(g, lang).name;
      b.addEventListener("click", () => showGift(g));
      return b;
    }));
    giftListSignature = signature;
  }
  $("giftList").querySelectorAll<HTMLButtonElement>("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.gift === String(selectedGift?.at))));
}

function markVisit(): void {
  const key = collectionKey();
  if (!key || $<HTMLDialogElement>("pauseDialog").open) return;
  const shelf = readShelf(store.get(key));
  shelf.seen = Math.max(shelf.seen, Date.now());
  store.set(key, shelf);
}

$("keepsakes").addEventListener("toggle", () => {
  if ($<HTMLDetailsElement>("keepsakes").open && selectedGift) { markGiftSeen(selectedGift); refreshKeepsakes(); }
});
$("previewGift").addEventListener("click", () => {
  const key = collectionKey();
  if (!DEMO || !key || !summary) return;
  const shelf = readShelf(store.get(key));
  shelf.seen = Date.now() - AWAY_MS;
  store.set(key, shelf);
  refreshKeepsakes();
});
addEventListener("pagehide", markVisit);
setInterval(() => { if (!document.hidden) markVisit(); }, 60_000);

// ---------- proud moments (decision 0017) ----------

let moments: Moment[] = [];
let momentQueue: Moment[] = [];
let showing: Moment | null = null;
let momentTimer = 0;

function onMoments(s: StateSummary): void {
  moments = momentsOf(s);
  if (creds) {
    const key = lastIdKey(creds.phrase);
    const r = pickNew(moments, store.get<number>(key), Date.now());
    if (r.lastId !== null) store.set(key, r.lastId);
    momentQueue.push(...r.show);
    if (!showing) nextMoment();
  }
  if (showing) $("moment").textContent = momentLine(lang, showing.kind, showing.value);
  renderMomentList();
}

function nextMoment(): void {
  clearTimeout(momentTimer);
  const el = $("moment");
  const m = momentQueue.shift() ?? null;
  showing = m;
  if (!m) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  // The world draws the celebration (B15). Guarded: it may not exist yet, and reduced motion skips it.
  const w = world as unknown as { celebrate?: (kind: MomentKind, value: number) => void };
  if (typeof w.celebrate === "function") {
    try {
      w.celebrate(m.kind, m.value);
    } catch {
      /* a celebration is never worth a broken page */
    }
  }
  el.textContent = momentLine(lang, m.kind, m.value);
  el.hidden = false;
  el.classList.remove("in");
  void el.offsetWidth; // restart the fade-in
  el.classList.add("in");
  momentTimer = window.setTimeout(nextMoment, MOMENT_SHOW_MS);
}

function renderMomentList(): void {
  const list = $("momentList");
  const items = recent(moments).map((m) => {
    const li = document.createElement("li");
    li.textContent = momentLine(lang, m.kind, m.value);
    return li;
  });
  list.replaceChildren(...items);
  $("momentsEmpty").hidden = items.length > 0;
}

function toggleMoments(): void {
  openPocket();
  const box = $("momentBox");
  box.hidden = false;
  $("hud").setAttribute("aria-expanded", String(!box.hidden));
}
$("hud").addEventListener("click", toggleMoments);
$("hud").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    toggleMoments();
  }
});

// ---------- share card ----------

function makeCard(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const body = getComputedStyle(document.body);
  const newest = moments[moments.length - 1];
  drawCard(canvas, readWorld($("world"), world), {
    lang,
    bg: body.backgroundColor,
    fg: body.color,
    muted: getComputedStyle($("hud")).color,
    hud: $("hudText").textContent ?? "",
    moment: newest ? momentLine(lang, newest.kind, newest.value) : "",
    tag: t("shareTag"),
    host: cardHost(location.host),
    provenance: backend.mock || summary?.demo || DEMO ? t("shareDemo") : ""
  });
  return canvas;
}

$("shareBtn").addEventListener("click", async () => {
  if (!summary) return;
  const btn = $<HTMLButtonElement>("shareBtn");
  btn.disabled = true;
  btn.textContent = t("shareMaking");
  try {
    const blob = await toBlob(makeCard());
    const result = await deliver(blob, fileName(new Date()), t("title"));
    if (result === "downloaded") explain(t("shareSaved"));
  } catch {
    explain(t("shareFailed"));
  } finally {
    btn.disabled = false;
    btn.textContent = t("share");
  }
});

// ---------- the Truffle app (decision 0016) ----------

$("appBtn").addEventListener("click", () => {
  // The custom scheme opens the app on this phone. It never reaches a server.
  if (creds) location.href = appLink(creds);
});

function setupHandoff(): void {
  const on = offerApp(navigator.userAgent, { demo: DEMO, mock: backend.mock, paired: !!creds });
  $("appBtn").hidden = !on;
  $("getApp").hidden = !on;
}

// ---------- backend calls ----------

function isAuthLoss(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 401 || e.status === 404);
}

function openSettings(): void {
  openPocket();
  $("pocketStatus").textContent = lastWhy;
  const d = $<HTMLDetailsElement>("settings");
  d.open = true;
  d.querySelector<HTMLDetailsElement>(".connection")!.open = true;
  d.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
}

// Judge controls and the spore buttons share one countdown after a 429 or a 400 with retry_after_s.
const ACT_BUTTONS = "#judge button, #judge input, #walkBtn, #sporeBtn, #sporeBtn2";
let actFailText = "";
const actCooldown = new Cooldown(
  (left) => explain(`${actFailText} ${waitText(lang, left)}`),
  () => {
    explain(actFailText);
    setActDisabled(false);
  }
);
function setActDisabled(on: boolean): void {
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement>(ACT_BUTTONS).forEach((b) => {
    b.disabled = on || actionBusy || (chatBusy && b.id !== "resetBtn");
  });
}

/** Show a failed call as the Worker's calm text in the UI language. Returns the view for callers that need it. */
function failed(e: unknown, ctx: ErrorCtx) {
  const v = describeError(e, lang, ctx, DEMO);
  actFailText = v.text;
  explain(v.text);
  if (v.retryS && ctx !== "pair" && ctx !== "state") {
    setActDisabled(true);
    actCooldown.start(v.retryS);
  }
  if (v.openSettings) openSettings();
  return v;
}

let authLost = false;

async function poll(): Promise<void> {
  if (!creds || document.hidden || authLost || actionBusy || sliderPending || chatBusy) return;
  const epoch = stateEpoch;
  try {
    const next = await backend.state(creds);
    if (epoch === stateEpoch && !actionBusy && !sliderPending && !chatBusy) {
      render(next);
      $("recovery").hidden = true;
    }
  } catch (e) {
    if (isAuthLoss(e) && !backend.mock) {
      if (DEMO) {
        // Demo Truffles expire after 24 hours. Plant a fresh one.
        store.del(petKey());
        creds = null;
        await ensurePaired();
      } else {
        // A real Truffle is never replaced behind your back. Say so and show Settings.
        authLost = true;
        failed(e, "state");
        $("syncNote").textContent = t("syncPaused");
        $("recovery").hidden = false;
        openSettings();
      }
    } else {
      $("syncNote").textContent = t("syncPaused");
      $("recovery").hidden = false;
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
  const key = petKey();
  const saved = store.get<Creds & { expires_ms?: number }>(key);
  if (importedCreds && !DEMO && (importedCreds.phrase !== saved?.phrase || importedCreds.secret !== saved?.secret)) {
    if (confirm(`${t("importPet")}\n${importedCreds.phrase}`)) {
      try {
        const s = await verifyImportedPet(importedCreds, c => backend.state(c));
        creds = importedCreds;
        store.set(key, creds);
        document.documentElement.classList.add("returning");
        if (!langChosen) lang = s.lang;
        render(s);
        return;
      } catch {
        explain(t("importFailed"));
      }
    }
  }
  if (saved?.phrase && saved.secret && !(saved.expires_ms && saved.expires_ms < Date.now())) {
    try {
      creds = { phrase: saved.phrase, secret: saved.secret };
      const s = await backend.state(creds);
      if (s.demo !== DEMO) throw new ApiError(404, "wrong pet mode");
      if (!langChosen) lang = s.lang;
      if (!DEMO) document.documentElement.classList.add("returning");
      render(s);
      return;
    } catch (e) {
      if (!isAuthLoss(e)) throw e;
      // Demo: expired, plant a fresh one. Real: keep the saved phrase and let the person decide in Settings.
      if (!DEMO && isAuthLoss(e)) {
        authLost = true;
        throw e;
      }
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

async function act(
  fn: () => Promise<StateSummary>,
  why: (before: StateSummary, after: StateSummary) => string,
  ctx: ErrorCtx = "demo",
  resetConversation = false
): Promise<void> {
  if (!creds || !summary || actionBusy || actCooldown.active()) return;
  clearTimeout(sliderTimer);
  sliderPending = false;
  stateEpoch++;
  actionBusy = true;
  if (resetConversation) chat.clear();
  chat.refresh();
  const before = summary;
  const buttons = document.querySelectorAll<HTMLInputElement | HTMLButtonElement>(ACT_BUTTONS);
  buttons.forEach((b) => (b.disabled = true));
  try {
    const after = await fn();
    if (resetConversation) {
      clearTimeout(momentTimer);
      momentQueue = [];
      showing = null;
      $("moment").hidden = true;
      store.del(lastIdKey(creds.phrase));
      const key = collectionKey();
      if (key) { store.del(key); store.del(`${key}/read`); store.del(`${key}/outing`); }
      $("chatGift").hidden = true;
      selectedGift = null;
      $("giftWaiting").hidden = true;
      $("keepsakes").classList.remove("has-new");
    }
    render(after);
    let text = why(before, after);
    if (after.state.stage !== before.state.stage && !after.state.dead && after.state.lifetime_steps > before.state.lifetime_steps) {
      text += " " + explainGrew(lang, after.state.stage);
    }
    explain(text);
  } catch (e) {
    failed(e, ctx);
  } finally {
    actionBusy = false;
    setActDisabled(actCooldown.active());
    chat.refresh();
  }
}

// ---------- spore, settings ----------

const plantSpore = () =>
  act(
    () => backend.spore(creds!),
    () => t("newSporeDone"),
    "spore",
    true
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

const savedScale = store.get<unknown>(K.font);
let scale = typeof savedScale === "number" && Number.isFinite(savedScale) ? Math.min(1.5, Math.max(0.85, savedScale)) : 1;
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
  world.draw();
  document.documentElement.classList.toggle("reduced", reduced());
  $("motionNote").hidden = !media.matches;
  motionBox.disabled = media.matches;
  chat.skip();
}
motionBox.addEventListener("change", () => {
  store.set(K.motion, motionBox.checked);
  syncMotion();
});
media.addEventListener?.("change", syncMotion);

// A brief invitation to leave the screen. No target, timer, location or note is recorded.
const pauseDialog = $<HTMLDialogElement>("pauseDialog");
$("pauseBtn").addEventListener("click", () => {
  closePocket();
  markVisit();
  $("pauseTitle").textContent = t("pause");
  $("pauseText").textContent = summary?.state.burrowed ? t("pauseHeat") : t("pauseNotice");
  pauseDialog.dir = lang === "ar" ? "rtl" : "ltr";
  pauseDialog.showModal();
  syncMotion();
});
$("outingBtn").addEventListener("click", () => {
  const open = $("outing").hidden;
  $("outing").hidden = !open;
  $("outingBtn").setAttribute("aria-expanded", String(open));
});
for (const kind of ["outingWalk", "outingErrand"] as const) {
  $(kind).addEventListener("click", () => {
    closePocket();
    markVisit();
    const key = outingKey();
    if (key) store.set(key, { version: 1, kind, at: Date.now() });
    $("pauseTitle").textContent = t("outingTitle");
    $("pauseText").textContent = summary?.state.burrowed ? t("pauseHeat") : t(kind === "outingWalk" ? "outingWalkNote" : "outingErrandNote");
    pauseDialog.dir = lang === "ar" ? "rtl" : "ltr";
    $("outing").hidden = true;
    $("outingBtn").setAttribute("aria-expanded", "false");
    pauseDialog.showModal();
    syncMotion();
  });
}
$("backBtn").addEventListener("click", () => pauseDialog.close());
pauseDialog.addEventListener("close", () => {
  syncMotion();
  finishOuting();
  explain(t("returnNotice"));
  void poll();
  if (!$<HTMLInputElement>("msg").disabled) $("msg").focus();
});

$<HTMLInputElement>("api").value = apiBase();
$("apiSave").addEventListener("click", () => {
  const value = $<HTMLInputElement>("api").value;
  const next = value.trim() ? normalizeApiOrigin(value, import.meta.env.DEV) : DEFAULT_API;
  if (!next) { explain(t("apiInvalid")); return; }
  if (next !== apiBase() && !confirm(t("apiChange"))) return;
  if (!setApiBase(value)) return;
  location.reload();
});
$("forgetBtn").addEventListener("click", () => {
  if (!confirm(t("forgetConfirm"))) return;
  const key = collectionKey();
  if (key) { store.del(key); store.del(`${key}/read`); store.del(`${key}/outing`); }
  store.del(petKey());
  location.reload();
});

// ---------- judge mode ----------

let sliderPending = false;
let sliderTimer = 0;
let actionBusy = false;
let chatBusy = false;
let stateEpoch = 0;

function setupJudge(): void {
  const judge = $("judge");
  judge.hidden = false;
  $("walkBtn").hidden = false;
  $("walkBtn").addEventListener("click", () => void act(
    () => backend.slider(creds!, Math.max(4000, summary?.state.steps_today ?? 0)),
    (_b, a) => explainSteps(lang, a.state.steps_today, a.energy_pct, a.tier, a.state.burrowed)
  ));
  const slider = $<HTMLInputElement>("steps");
  slider.addEventListener("input", () => {
    const steps = Number(slider.value);
    $("stepsOut").textContent = steps.toLocaleString("en-US");
    sliderPending = true;
    chat.refresh();
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
      () => t("freshSpore"),
      "demo",
      true
    )
  );
}

// ---------- boot ----------

$("retryBtn").addEventListener("click", () => {
  if (!summary || authLost) location.reload();
  else void poll();
});

// ---------- phone prep: ?fps=1 ----------

function setupFps(): void {
  if (!fpsEnabled(params)) return;
  const meter = new FpsMeter();
  const out = $("fps");
  out.hidden = false;
  world.timing = (compose, paint) => meter.add(compose, paint);
  setInterval(() => {
    const r = meter.flush();
    if (r) out.textContent = fpsText(r);
  }, 1000);
}

async function boot(): Promise<void> {
  setupFps();
  applyLang();
  syncMotion();
  world.start();
  $("hudText").textContent = t("loading");
  if (DEMO) setupJudge();

  backend = await connect(params, DEMO);
  $("offline").hidden = !backend.mock;
  if (backend.mock) $("judgeIntro").textContent = t("offlineIntro");
  try {
    await ensurePaired();
    if (backend.mock && creds) render(await backend.state(creds));
  } catch (e) {
    // A busy public judge pool should still let visitors explore a clearly
    // labelled sample. Never substitute a simulated pet for a real owner.
    if (DEMO && e instanceof ApiError && e.status === 429) {
      backend = new MockBackend(new URLSearchParams(), true);
      $("offline").hidden = false;
      await ensurePaired();
      render(await backend.state(creds!));
      $("status").textContent = "";
      explain(t("demoBusy"));
    } else {
    const v = failed(e, "pair");
    $("status").textContent = "";
    $("hudText").textContent = v.kind === "network" ? t("networkError") : v.text;
    $("syncNote").textContent = "";
    $("recovery").hidden = false;
    return;
    }
  }
  $("phrase").textContent = creds?.phrase ?? "";
  setupHandoff();
  applyLang();
  if (!lastWhy && summary) explain(t("energyNote"));
  $("half").hidden = !halfAwake;

  setInterval(() => void poll(), POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void poll();
    else markVisit();
  });
}

void boot();

// Read-only hooks for the screenshot harness and a remote phone console.
(window as unknown as { truffle: unknown }).truffle = {
  summary: () => summary,
  frames: () => world.frames,
  mock: () => backend?.mock ?? null,
  card: () => makeCard().toDataURL("image/png"),
  demo: DEMO
};
