// Boot, pairing, polling, language, settings and judge mode.

import "./style.css";
import { ApiError, DEFAULT_API, apiBase, connect, setApiBase } from "./api";
import { credentialKey, normalizeApiOrigin, verifyImportedPet } from "./credentials";
import { Chat } from "./chat";
import { CompanionController } from "./companion/controller";
import { companionText, type CompanionNote } from "./companion/copy";
import { MockBackend } from "./mock";
import { Cooldown, describeError, waitText, type ErrorCtx } from "./errors";
import { FpsMeter, fpsEnabled, fpsText } from "./fps";
import { COPY, MOOD_WORD, STAGE_WORD, TIER_WORD, explainGrew, explainMidnight, explainSteps, foodSummary, replyFoodEstimate, momentLine, type CopyKey, type Lang } from "./copy";
import { appLink, inApp, offerApp, takeCredsFromHash } from "./handoff";
import { MOMENT_SHOW_MS, lastIdKey, momentsOf, pickNew, recent, type Moment, type MomentKind } from "./moments";
import { cardHost, deliver, drawCard, fileName, readWorld, toBlob } from "./share";
import { makeFitter } from "./scene/grid";
import { World } from "./scene/world";
import { activeGifts, giftProvenance, mergeGifts, previewGift, readGiftDisplayState, readShelf, returnToShelf, shelfKey, updateGiftDisplayState, type DisplayGift } from "./keepsakes";
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
const receivedImport = /^#?creds=/.test(location.hash);
// Only this exact envelope can carry a native document nonce. Duplicate or
// malformed parameters fall through to the existing fail-closed parser.
const nativeFragment = /^#?creds=([^&]*)&native_scope=([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.exec(location.hash);
let importedNativeScope: string | null = nativeFragment?.[2] ?? null;
let importedCreds = takeCredsFromHash(nativeFragment
  ? { hash: `#creds=${nativeFragment[1]}`, pathname: location.pathname, search: location.search }
  : location, history, () => {});
const petKey = () => credentialKey(apiBase(), DEFAULT_API, DEMO);
const importMarkerKey = `${petKey()}.pending-import`;
// Only a boolean survives reload. The one-time secret stays in memory until
// verification succeeds; an interrupted import must never create another pet.
let importPending = !DEMO && (receivedImport || store.get<boolean>(importMarkerKey) === true);
if (importPending) store.set(importMarkerKey, true);
const IN_APP = inApp(navigator.userAgent);
if (IN_APP) document.documentElement.classList.add("in-app");
if (importPending || (IN_APP && !DEMO)) $("scene").hidden = true;

// ---------- app state ----------

let backend: Backend;
let creds: Creds | null = null;
let summary: StateSummary | null = null;
// Preserve the last real visit until a return has a current day/alive state.
// A failed refresh or a language change must not consume an eligible absence.
let awaitingFreshReturn = true;
const savedLang = store.get<unknown>(K.lang);
let lang: Lang = savedLang === "ar" || savedLang === "en" ? savedLang : (navigator.language?.toLowerCase().startsWith("ar") ? "ar" : "en");
let langChosen = savedLang === "ar" || savedLang === "en";
let halfAwake = false;
let lastWhy = "";
let importRecovery: CopyKey | null = null;
let nativeImport: { nonce: string; origin: string; pet: string; generation: number } | null = null;
let renderedOwner = "";

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

const companionNote = document.createElement("div");
companionNote.id = "companionNote";
companionNote.className = "companion-note";
companionNote.hidden = true;
const companionWords = document.createElement("p");
companionWords.setAttribute("role", "status");
companionWords.setAttribute("aria-live", "polite");
const companionDismiss = document.createElement("button");
companionDismiss.type = "button";
companionDismiss.className = "small";
companionNote.append(companionWords, companionDismiss);
$("chatForm").insertAdjacentElement("afterend", companionNote);
let currentCompanionNote: CompanionNote | null = null;
function showCompanionNote(note: CompanionNote | null): void {
  currentCompanionNote = note;
  companionNote.hidden = !note;
  companionWords.textContent = note ? companionText(note, lang) : "";
  companionWords.lang = lang;
  companionDismiss.textContent = lang === "ar" ? "إخفاء" : "Dismiss";
}
companionDismiss.addEventListener("click", () => showCompanionNote(null));
const companion = new CompanionController({
  visible: !document.hidden,
  load: key => store.get(key), save: (key, value) => store.set(key, value),
  setReaction: reaction => { world.set({ reaction }); world.draw(); },
  showNote: showCompanionNote,
  requestState: () => void poll(),
  onServerSummary: s => render(s),
});
function clearCompanion(): void {
  nativeImport = null;
  importedNativeScope = null;
  companion.clear();
}
function syncCompanion(s: StateSummary, fresh: boolean): void {
  if (!creds || importPending || authLost || importRecovery) { companion.clear(); return; }
  const origin = apiBase();
  if (nativeImport && (nativeImport.origin !== origin || nativeImport.pet !== creds.phrase
    || nativeImport.generation !== s.generation || s.state.dead || backend.mock || DEMO)) nativeImport = null;
  const b = backend, c = creds, epoch = stateEpoch;
  const current = () => backend === b && creds === c && apiBase() === origin && stateEpoch === epoch && !importPending && !authLost;
  companion.snapshot({ origin, pet: c.phrase, demo: DEMO || b.mock,
    nativeScope: nativeImport?.nonce,
    request: !b.mock && s.companion !== undefined && b.companion ? async (action, intent, requestId, keepalive, generation, jobId) => {
      if (!current()) throw new Error("Companion owner changed");
      try {
        const result = await b.companion!(c, action, intent, requestId, keepalive, generation, jobId);
        if (!current()) throw new Error("Companion owner changed");
        if (action === "away" && summary?.generation === generation) giftScheduleFailed = false;
        return result;
      } catch (e) {
        if (current() && action === "away" && summary?.generation === generation && !isAuthLoss(e)) {
          giftScheduleFailed = true;
          refreshKeepsakes();
          explain(t("giftScheduleFailed"));
        }
        if (current() && isAuthLoss(e)) {
          authLost = true;
          clearCompanion();
          failed(e, "state");
          $("syncNote").textContent = t("syncPaused");
          $("recovery").hidden = false;
          chat.refresh();
        }
        throw e;
      }
    } : undefined,
  }, s, fresh);
}
addEventListener("truffle:native-movement", event => {
  if (!importPending && !importRecovery && !authLost && nativeImport && !document.hidden) companion.movement((event as CustomEvent).detail);
});

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
    onAcceptedMessage: message => companion.acceptedMessage(message),
    onMessage: message => {
      $("sentMessage").textContent = message ?? "";
      $("sentMessage").hidden = !message;
    },
    onExplain: (t) => explain(t),
    onDetails: (text) => { $("chatDetails").textContent = text; },
    afterChat: () => void poll(),
    demo: DEMO,
    openSettings: () => openSettings(),
    blocked: () => actionBusy || sliderPending || authLost || importPending || !!importRecovery,
    onBusy: (busy) => {
      chatBusy = busy;
      if (busy) {
        stateEpoch++; // A pre-chat refresh cannot overwrite the charged result.
        if (summary) syncCompanion(summary, false);
      }
      $<HTMLSelectElement>("ask").disabled = busy;
      setActDisabled(actCooldown.active());
    }
  }
);

$("ask").addEventListener("change", () => {
  if (summary) refreshReplyPrice(summary);
});
function refreshReplyPrice(s: StateSummary): void {
  $("effortPrice").textContent = replyFoodEstimate(lang, s.state.dead ? "asleep" : s.tier, ($<HTMLSelectElement>("ask").value || undefined) as Tier | undefined);
}

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
  document.title = DEMO ? `${c.title} | ${c.judgeTitle}` : c.title;
  showCompanionNote(currentCompanionNote);
  if (summary) render(summary, false);
  chat.refresh();
  if (backend?.mock) $("judgeIntro").textContent = c.offlineIntro;
  $("demoMode").hidden = !DEMO || !!backend?.mock;
  $("tryDemo").hidden = DEMO || IN_APP;
  if (importRecovery) showImportRecovery(importRecovery);
}

$("langBtn").addEventListener("click", () => {
  lang = lang === "ar" ? "en" : "ar";
  langChosen = true;
  store.set(K.lang, lang);
  applyLang();
  if (summary) explain(t("foodChatNote"));
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

function render(s: StateSummary, fresh = true): void {
  const owner = `${apiBase()}/${creds?.phrase ?? ""}/${DEMO || !!backend?.mock}`;
  if (owner === renderedOwner && summary?.generation !== undefined && s.generation !== undefined && s.generation < summary.generation) return;
  if (owner !== renderedOwner || (summary?.generation !== undefined && s.generation !== undefined && summary.generation !== s.generation)) chat.clear();
  if (owner !== renderedOwner) { clearCompanion(); renderedOwner = owner; }
  if (fresh) awaitingFreshReturn = false;
  summary = s;
  const st = s.state;
  $("firstWalk").hidden = !DEMO || st.steps_today > 0 || st.dead;
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
  syncCompanion(s, fresh);

  const sep = " · ";
  const hud = [
    foodSummary(lang, st.energy, s.energy_max).amount,
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
  $("energyValue").textContent = st.energy.toLocaleString(lang === "ar" ? "ar-u-nu-arab" : "en-US");
  const food = foodSummary(lang, st.energy, s.energy_max);
  $("foodAmount").textContent = food.amount;
  $("foodReserve").textContent = food.reserve;
  refreshReplyPrice(s);
  $("energyTrack").setAttribute("aria-valuenow", String(s.energy_pct));
  $("energyTrack").setAttribute("aria-valuetext", food.amount);
  $("energyFill").style.width = `${s.energy_pct}%`;
  $("worldTime").textContent = backend?.mock ? t("sampleWorld") : new Intl.DateTimeFormat(lang === "ar" ? "ar-OM" : "en-GB", { timeZone: s.tz, hour: "2-digit", minute: "2-digit" }).format(new Date());
  $("outingBtn").hidden = st.dead;
  $("outingBtn").classList.toggle("primary", !DEMO);
  refreshKeepsakes();
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

// Server gifts belong to one life. Older device shelves stay readable as an archive.
const collectionKey = () => creds ? shelfKey(apiBase(), creds.phrase, DEMO || !!backend?.mock) : null;
let selectedGift: DisplayGift | null = null;
let displayedGifts: DisplayGift[] = [];
let demoGift: DisplayGift | null = null;
let selectedCollection = "";
let giftListSignature = "";
let sceneGiftSignature = "uninitialized";
let chatGiftSignature = "";
let giftScheduleFailed = false;
const giftWorld = world as unknown as { setKeepsakes?: (items: Array<{ id: string; art: string }>) => void; hitGift?: (x: number, y: number) => string | null };
function giftReadKey(): string { return `${selectedCollection}/read-ids`; }
function readGiftIds(): string[] {
  const ids = store.get<unknown>(giftReadKey());
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string").slice(-48) : [];
}
function markGiftSeen(gift: DisplayGift): void {
  if (gift.source === "preview") return;
  store.set(giftReadKey(), [...new Set([...readGiftIds(), gift.id])].slice(-48));
}
function renderChatGift(gift: DisplayGift): void {
  const signature = JSON.stringify([gift.id, lang, gift.art, gift.text[lang], gift.archived]);
  if (signature === chatGiftSignature) return;
  chatGiftSignature = signature;
  const card = $("chatGift");
  const g = gift.text[lang];
  const art = document.createElement("pre"); art.dir = "ltr"; art.setAttribute("aria-hidden", "true"); art.textContent = gift.art;
  const words = document.createElement("div"); words.lang = lang; words.dir = lang === "ar" ? "rtl" : "ltr";
  const from = document.createElement("span"); from.className = "gift-from";
  from.textContent = gift.source === "preview" ? t("giftPreview") : gift.archived ? t("giftArchive") : t("giftFrom");
  const name = document.createElement("h3"); name.textContent = g.name;
  const note = document.createElement("p"); note.textContent = g.note;
  const provenance = document.createElement("p"); provenance.className = "gift-provenance"; provenance.textContent = giftProvenance(gift, lang);
  words.append(from, name, note, provenance); card.replaceChildren(art, words);
}
function showGift(gift: DisplayGift): void {
  selectedGift = gift;
  markGiftSeen(gift);
  refreshKeepsakes();
  const card = $("chatGift");
  renderChatGift(gift); card.hidden = false;
  closePocket(); card.focus({ preventScroll: true }); card.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
}
$("scene").addEventListener("click", (event) => {
  const id = giftWorld.hitGift?.(event.clientX, event.clientY);
  const gift = displayedGifts.find(g => g.id === id);
  if (gift) showGift(gift);
});
$("scene").addEventListener("pointermove", (event) => {
  $("scene").style.cursor = giftWorld.hitGift?.(event.clientX, event.clientY) ? "pointer" : "default";
});
$("chatForm").addEventListener("submit", () => { $("chatGift").hidden = true; });

function refreshKeepsakes(): void {
  const key = collectionKey();
  if (!key || !summary) return;
  const generation = summary.generation;
  const stored = readShelf(store.get(key));
  const archiveThrough = Math.max(Date.now(), ...stored.gifts.map(gift => gift.at));
  const display = updateGiftDisplayState(store.get(`${key}/display`), generation, summary.companion !== undefined, archiveThrough);
  store.set(`${key}/display`, display);
  const scope = `${key}/life:${generation ?? "legacy"}`;
  if (scope !== selectedCollection) {
    selectedGift = null; demoGift = null; displayedGifts = []; selectedCollection = scope;
    giftListSignature = ""; sceneGiftSignature = "uninitialized"; giftScheduleFailed = false;
    $("chatGift").hidden = true;
  }
  const result = display.serverCapable || awaitingFreshReturn || document.hidden || $<HTMLDialogElement>("pauseDialog").open
    ? { shelf: stored, gift: undefined }
    : returnToShelf(stored, Date.now(), summary.local_day, key, !summary.state.dead);
  store.set(key, result.shelf);
  const gifts = mergeGifts(result.shelf, summary.companion?.gifts ?? [], display);
  const previousIds = new Set(displayedGifts.map(gift => gift.id));
  displayedGifts = demoGift ? [...gifts, demoGift] : gifts;
  const newest = gifts.filter(gift => !gift.archived).at(-1);
  if (newest && !previousIds.has(newest.id) && $("chatGift").hidden) selectedGift = newest;
  selectedGift = displayedGifts.find(gift => gift.id === selectedGift?.id) ?? newest ?? null;
  if (!selectedGift) $("chatGift").hidden = true;
  const readIds = new Set(readGiftIds());
  const legacyReadAt = store.get<number>(`${key}/read`) ?? 0;
  const unread = gifts.some(gift => !gift.archived && !readIds.has(gift.id) && (gift.source !== "legacy" || gift.at > legacyReadAt));
  $("giftWaiting").hidden = !unread;
  $("giftPending").hidden = !summary.companion?.pending && !giftScheduleFailed;
  $("giftPending").textContent = t(summary.companion?.pending ? "giftPending" : "giftScheduleFailed");
  $("keepsakes").classList.toggle("has-new", unread);
  $("pocketBtn").classList.toggle("has-new", unread);
  $("pocketBtn").setAttribute("aria-label", unread ? `${t("pocket")}. ${t("giftWaiting")}` : t("pocket"));
  const sceneGifts = activeGifts(displayedGifts);
  const sceneSignature = sceneGifts.map(gift => `${gift.id}:${gift.art}`).join("|");
  if (sceneSignature !== sceneGiftSignature && giftWorld.setKeepsakes) {
    giftWorld.setKeepsakes(sceneGifts.map(gift => ({ id: gift.id, art: gift.art })));
    sceneGiftSignature = sceneSignature;
  }
  $("giftCount").textContent = String(gifts.length);
  $("giftsEmpty").hidden = gifts.length > 0 || !!demoGift;
  $("giftCard").hidden = !selectedGift;
  $("previewGift").hidden = !DEMO;
  $("giftPreviewNote").hidden = !DEMO;
  $<HTMLButtonElement>("previewGift").disabled = summary.state.dead;
  if (selectedGift) {
    const g = selectedGift.text[lang];
    $("giftArt").textContent = selectedGift.art;
    $("giftName").textContent = g.name;
    $("giftNote").textContent = g.note;
    $("giftProvenance").textContent = giftProvenance(selectedGift, lang);
    $("giftCard").querySelector<HTMLElement>(".gift-from")!.textContent = selectedGift.source === "preview" ? t("giftPreview") : selectedGift.archived ? t("giftArchive") : t("giftFrom");
    $("giftDate").textContent = selectedGift.day;
    $("giftDate").setAttribute("datetime", selectedGift.day);
    if (!$("chatGift").hidden) renderChatGift(selectedGift);
  }
  const signature = `${lang}:${displayedGifts.map(g => `${g.id}:${g.archived}`).join(",")}`;
  if (signature !== giftListSignature) {
    $("giftList").replaceChildren(...displayedGifts.slice().reverse().map(gift => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "gift-choice small"; button.dataset.gift = gift.id;
      button.textContent = gift.text[lang].name;
      button.setAttribute("aria-label", `${gift.text[lang].name}. ${gift.day}. ${gift.source === "preview" ? t("giftPreview") : gift.archived ? t("giftArchive") : t("giftOpen")}`);
      button.addEventListener("click", () => showGift(gift));
      return button;
    }));
    giftListSignature = signature;
  }
  $("giftList").querySelectorAll<HTMLButtonElement>("button").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.gift === selectedGift?.id)));
}

function markVisit(): void {
  const key = collectionKey();
  if (!key || awaitingFreshReturn || $<HTMLDialogElement>("pauseDialog").open) return;
  const shelf = readShelf(store.get(key));
  shelf.seen = Math.max(shelf.seen, Date.now());
  store.set(key, shelf);
}

$("keepsakes").addEventListener("toggle", () => {
  if ($<HTMLDetailsElement>("keepsakes").open && selectedGift) { markGiftSeen(selectedGift); refreshKeepsakes(); }
});
$("previewGift").addEventListener("click", () => {
  if (!DEMO || !collectionKey() || !summary || summary.state.dead) return;
  demoGift = previewGift(crypto.randomUUID(), summary.local_day, summary.generation ?? 0, summary.state.stage, Date.now());
  selectedGift = demoGift;
  refreshKeepsakes();
});
addEventListener("pagehide", () => { markVisit(); companion.hidden(true); });
addEventListener("pageshow", event => { if (event.persisted && !document.hidden) void companion.returned(); });
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
const ACT_BUTTONS = "#judge button, #judge input, #walkBtn, #firstWalk, #sporeBtn, #sporeBtn2";
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

class PairingPaused extends Error {
  constructor(readonly reason: CopyKey) { super(reason); }
}

function showImportRecovery(reason: CopyKey): void {
  clearCompanion();
  importRecovery = reason;
  $("scene").hidden = true;
  $("offline").hidden = true;
  $("hudText").textContent = t("importPaused");
  $("syncNote").textContent = t(reason);
  $("recovery").hidden = false;
  $("status").textContent = "";
  explain(t(reason));
  chat.refresh();
}

async function poll(): Promise<void> {
  if (!creds || document.hidden || authLost || actionBusy || sliderPending || chatBusy) return;
  const epoch = stateEpoch;
  const sequence = ++pollSequence;
  const b = backend, c = creds, origin = apiBase();
  const current = () => sequence === pollSequence && epoch === stateEpoch && b === backend && c === creds && origin === apiBase();
  try {
    const next = await b.state(c);
    if (current() && !actionBusy && !sliderPending && !chatBusy) {
      render(next);
      $("recovery").hidden = true;
    }
  } catch (e) {
    if (!current()) return;
    if (isAuthLoss(e) && !backend.mock) {
      if (DEMO) {
        // Demo Truffles expire after 24 hours. Plant a fresh one.
        store.del(petKey());
        clearCompanion();
        creds = null;
        await ensurePaired();
      } else {
        // A real Truffle is never replaced behind your back. Say so and show Settings.
        authLost = true;
        clearCompanion();
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
  const key = petKey();
  const saved = store.get<Creds & { expires_ms?: number }>(key);
  if (importPending) {
    if (!importedCreds) throw new PairingPaused("importReopen");
    if (backend.mock) throw new PairingPaused("importFailed");
    const alreadySaved = importedCreds.phrase === saved?.phrase && importedCreds.secret === saved?.secret;
    if (!alreadySaved && !confirm(`${t("importPet")}\n${importedCreds.phrase}`)) throw new PairingPaused("importDeclined");
    let s: StateSummary;
    const candidate = importedCreds, candidateBackend = backend, candidateOrigin = apiBase();
    const candidateNonce = importedNativeScope;
    try {
      s = await verifyImportedPet(candidate, c => candidateBackend.state(c));
      if (candidate !== importedCreds || candidateBackend !== backend || candidateOrigin !== apiBase()) throw new Error("Import changed");
    } catch {
      throw new PairingPaused("importFailed");
    }
    creds = importedCreds;
    store.set(key, creds);
    store.del(importMarkerKey);
    importPending = false;
    importedCreds = null;
    document.documentElement.classList.add("returning");
    if (!langChosen) lang = s.lang;
    // Clear prior document authority before granting the exact verified import.
    clearCompanion();
    renderedOwner = `${apiBase()}/${creds.phrase}/${DEMO || backend.mock}`;
    if (IN_APP && !DEMO && candidateNonce && Number.isSafeInteger(s.generation) && s.generation! >= 0 && !s.state.dead) {
      nativeImport = { nonce: candidateNonce, origin: candidateOrigin, pet: creds.phrase, generation: s.generation! };
    }
    importRecovery = null;
    authLost = false;
    render(s);
    return;
  }
  if (backend.mock) {
    if (IN_APP && !DEMO) throw new PairingPaused(saved?.phrase && saved.secret ? "importFailed" : "appPetRequired");
    const r = DEMO ? await backend.spawn(lang) : await backend.pair(lang);
    creds = { phrase: r.phrase, secret: r.secret };
    if (!langChosen) lang = r.lang;
    return;
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
  if (IN_APP && !DEMO) throw new PairingPaused("appPetRequired");
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
  if (resetConversation) { chat.clear(); clearCompanion(); }
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
      if (key) {
        const display = readGiftDisplayState(store.get(`${key}/display`));
        const shelf = readShelf(store.get(key));
        display.legacyAfter = Math.max(display.legacyAfter, Date.now(), ...shelf.gifts.map(gift => gift.at));
        store.set(`${key}/display`, display);
        shelf.seen = Math.max(shelf.seen, Date.now());
        store.set(key, shelf);
        store.del(`${key}/outing`);
      }
      demoGift = null;
      displayedGifts = [];
      sceneGiftSignature = "uninitialized";
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

// A brief invitation to leave the screen.
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
    companion.intent({ type: "plan", kind: kind === "outingWalk" ? "walk" : "errand" });
    $("outing").hidden = true;
    $("outingBtn").setAttribute("aria-expanded", "false");
  });
}
$("backBtn").addEventListener("click", () => pauseDialog.close());
pauseDialog.addEventListener("close", () => {
  syncMotion();
  void companion.returned();
  if (!$<HTMLInputElement>("msg").disabled) $("msg").focus();
});

$<HTMLInputElement>("api").value = apiBase();
$("apiSave").addEventListener("click", () => {
  const value = $<HTMLInputElement>("api").value;
  const next = value.trim() ? normalizeApiOrigin(value, import.meta.env.DEV) : DEFAULT_API;
  if (!next) { explain(t("apiInvalid")); return; }
  if (next !== apiBase() && !confirm(t("apiChange"))) return;
  if (!setApiBase(value)) return;
  clearCompanion();
  location.reload();
});
$("forgetBtn").addEventListener("click", () => {
  if (!confirm(t("forgetConfirm"))) return;
  clearCompanion();
  const key = collectionKey();
  if (key) { store.del(key); store.del(`${key}/display`); store.del(`${key}/read`); store.del(giftReadKey()); store.del(`${key}/outing`); }
  store.del(importMarkerKey);
  store.del(petKey());
  location.reload();
});

// ---------- judge mode ----------

let sliderPending = false;
let sliderTimer = 0;
let actionBusy = false;
let chatBusy = false;
let stateEpoch = 0;
let pollSequence = 0;

function setupJudge(): void {
  const judge = $("judge");
  judge.hidden = false;
  $("walkBtn").hidden = false;
  const tryDemoWalk = () => void act(
    () => backend.slider(creds!, Math.max(4000, summary?.state.steps_today ?? 0)),
    (_b, a) => explainSteps(lang, a.state.steps_today, a.energy_pct, a.tier, a.state.burrowed)
  );
  $("walkBtn").addEventListener("click", tryDemoWalk);
  $("firstWalk").addEventListener("click", tryDemoWalk);
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
          affectionUp: a.state.affection > b.state.affection,
          continuous: a.state.energy_version === 2
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
  if (importPending || (IN_APP && !DEMO && !summary)) void startSession();
  else if (!summary || authLost) location.reload();
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

  await startSession();
}

let sessionBusy = false;
let pollingStarted = false;
async function startSession(): Promise<void> {
  if (sessionBusy) return;
  sessionBusy = true;
  $<HTMLButtonElement>("retryBtn").disabled = true;
  try {
    backend = await connect(params, DEMO);
    $("offline").hidden = !backend.mock;
    if (backend.mock) $("judgeIntro").textContent = t("offlineIntro");
    try {
      await ensurePaired();
      if (backend.mock && creds) render(await backend.state(creds));
    } catch (e) {
      if (e instanceof PairingPaused) {
        showImportRecovery(e.reason);
        return;
      }
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
    if (importRecovery) lastWhy = "";
    importRecovery = null;
    authLost = false;
    $("scene").hidden = false;
    $("recovery").hidden = true;
    $("phrase").textContent = creds?.phrase ?? "";
    setupHandoff();
    applyLang();
    if (!lastWhy && summary) explain(t("foodChatNote"));
    $("half").hidden = !halfAwake;
    if (document.hidden) companion.hidden();
    else void companion.returned();

    if (!pollingStarted) {
      pollingStarted = true;
      setInterval(() => void poll(), POLL_MS);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) { awaitingFreshReturn = true; void companion.returned(); }
        else { markVisit(); companion.hidden(); }
      });
    }
  } finally {
    sessionBusy = false;
    $<HTMLButtonElement>("retryBtn").disabled = false;
  }
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
