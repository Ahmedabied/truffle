// UI copy in both languages. Short, warm, never shaming.
// Arabic never goes inside the ASCII grid. It lives in normal HTML elements.

import type { Mood } from "../../worker/src/engine";
import type { Stage, Tier } from "../../worker/src/config";
import type { MomentKind } from "./moments";

export type Lang = "ar" | "en";

const en = {
  title: "Truffle",
  offline: "offline demo",
  halfAwake: "half-awake (fallback brain)",
  langToggle: "عربي",
  settings: "Settings",
  placeholder: "Say something to Truffle",
  placeholderAsleep: "Truffle is asleep. A walk wakes it.",
  placeholderDead: "Plant a new spore to talk again.",
  send: "Send",
  thinking: "Truffle is listening...",
  yawning: "Truffle is waking up...",
  chatError: "Truffle could not answer right now. Nothing was charged.",
  networkError: "Could not reach Truffle. Check the API address in settings.",
  sporeButton: "Plant a new spore",
  memoryPrefix: "It remembered:",
  energy: "Energy",
  stepsToday: "steps today",
  effort: "effort",
  apiBase: "API address",
  save: "Save and reload",
  phrase: "Your phrase (type it into the feeder app)",
  copy: "Copy",
  copied: "Copied",
  fontSize: "Text size",
  smaller: "Smaller text",
  larger: "Larger text",
  motion: "Reduce motion",
  motionSystem: "Your system asks for less motion, so the sky stays still.",
  forget: "Forget this Truffle on this browser",
  judgeTitle: "Judge mode",
  judgeIntro: "A fresh demo Truffle, just for you. Real engine. Real brain. Gone in 24 hours.",
  sliderLabel: "Steps today",
  midnight: "Next midnight",
  heatOn: "Heat day: on",
  heatOff: "Heat day: off",
  reset: "Reset",
  askFor: "Ask for effort",
  auto: "auto",
  working: "Working...",
  loading: "Waking the world...",
  pairing: "Planting your spore...",
  stepsOnlyUp: "Steps only count up. A lower number adds nothing.",
  freshSpore: "A fresh spore. Walk to wake it.",
  heatExplainOn: "Heat day. Truffle burrows. No growth today and it cannot die today.",
  heatExplainOff: "The heat passed. Truffle can come up again.",
  newSporeDone: "A new spore is in the sand. The old stone stays.",
  pollNote: "Updates every 30 seconds.",
  partial: "The reply was cut short. Only the part you saw was charged.",
  moments: "Moments",
  momentsShow: "Show moments",
  momentsEmpty: "No moments yet. They come from walking.",
  share: "Share",
  shareMaking: "Making the card...",
  shareFailed: "Could not make the card on this browser.",
  shareTag: "truffle, a pet that eats steps",
  openApp: "Open in the Truffle app",
  getApp: "Get the Android app"
};

export type CopyKey = keyof typeof en;

const ar: Record<CopyKey, string> = {
  title: "ترافل",
  offline: "عرض بدون اتصال",
  halfAwake: "نص صاحي (عقل احتياطي)",
  langToggle: "English",
  settings: "الإعدادات",
  placeholder: "قل شي لترافل",
  placeholderAsleep: "ترافل نايم. مشية بسيطة تصحّيه.",
  placeholderDead: "ازرع بذرة جديدة عشان تسولف من جديد.",
  send: "أرسل",
  thinking: "ترافل يسمعك...",
  yawning: "ترافل يصحى...",
  chatError: "ترافل ما قدر يرد الحين. ما انخصم شي.",
  networkError: "ما قدرنا نوصل لترافل. شيّك على عنوان الخادم في الإعدادات.",
  sporeButton: "ازرع بذرة جديدة",
  memoryPrefix: "كان يتذكر:",
  energy: "الطاقة",
  stepsToday: "خطوة اليوم",
  effort: "الجهد",
  apiBase: "عنوان الخادم",
  save: "احفظ وأعد التحميل",
  phrase: "عبارتك (اكتبها في تطبيق المغذّي)",
  copy: "انسخ",
  copied: "تم النسخ",
  fontSize: "حجم النص",
  smaller: "نص أصغر",
  larger: "نص أكبر",
  motion: "قلّل الحركة",
  motionSystem: "جهازك يطلب حركة أقل، فالسماء ثابتة.",
  forget: "انسَ ترافل هذا على هذا المتصفح",
  judgeTitle: "وضع الحكّام",
  judgeIntro: "ترافل تجريبي جديد لك. المحرك حقيقي. العقل حقيقي. يختفي بعد 24 ساعة.",
  sliderLabel: "خطوات اليوم",
  midnight: "منتصف الليل التالي",
  heatOn: "يوم حر: شغّال",
  heatOff: "يوم حر: طافي",
  reset: "ابدأ من جديد",
  askFor: "اطلب جهد",
  auto: "تلقائي",
  working: "لحظة...",
  loading: "العالم يصحى...",
  pairing: "نزرع بذرتك...",
  stepsOnlyUp: "الخطوات تنحسب للأعلى بس. الرقم الأقل ما يضيف شي.",
  freshSpore: "بذرة جديدة. امشِ عشان تصحّيها.",
  heatExplainOn: "يوم حر. ترافل يختبئ تحت الرمل. ما يكبر اليوم وما يموت اليوم.",
  heatExplainOff: "راح الحر. ترافل يقدر يطلع من جديد.",
  newSporeDone: "بذرة جديدة في الرمل. الحجر القديم باقي.",
  pollNote: "يتحدّث كل 30 ثانية.",
  partial: "الرد انقطع. انحسب بس الجزء اللي شفته.",
  moments: "لحظات",
  momentsShow: "اعرض اللحظات",
  momentsEmpty: "ما فيه لحظات للحين. تجي من المشي.",
  share: "شارك",
  shareMaking: "نسوي البطاقة...",
  shareFailed: "ما قدرنا نسوي البطاقة على هذا المتصفح.",
  shareTag: "ترافل، حيوان أليف ياكل خطوات",
  openApp: "افتح في تطبيق ترافل",
  getApp: "نزّل تطبيق أندرويد"
};

export const COPY: Record<Lang, Record<CopyKey, string>> = { en, ar };

export const STAGE_WORD: Record<Lang, Record<Stage, string>> = {
  en: { Spore: "Spore", Sprout: "Sprout", Truffle: "Truffle", Elder: "Elder" },
  ar: { Spore: "بذرة", Sprout: "برعم", Truffle: "فقعة", Elder: "معمّرة" }
};

export const TIER_WORD: Record<Lang, Record<Tier, string>> = {
  en: { asleep: "asleep", low: "low", medium: "medium", high: "high" },
  ar: { asleep: "نايم", low: "منخفض", medium: "متوسط", high: "عالي" }
};

export const MOOD_WORD: Record<Lang, Record<Mood, string>> = {
  en: {
    dead: "resting in the soil",
    burrowed: "burrowed from the heat",
    wilting: "wilting",
    tired: "tired",
    asleep: "asleep",
    affectionate: "affectionate",
    content: "content"
  },
  ar: {
    dead: "راقد في التراب",
    burrowed: "مختبئ من الحر",
    wilting: "ذابل",
    tired: "تعبان",
    asleep: "نايم",
    affectionate: "حنون",
    content: "مرتاح"
  }
};

const num = (lang: Lang, n: number) => (void lang, Math.round(n).toLocaleString("en-US"));

/** "What's happening" after a chat reply, from the done event. */
export function explainChat(
  lang: Lang,
  o: { pct: number; tier: Tier; spent: number; thinking: boolean; requested?: Tier; brain: string }
): string {
  const t = TIER_WORD[lang][o.tier];
  const asked = o.requested && o.requested !== o.tier ? o.requested : undefined;
  if (lang === "ar") {
    const pre = asked ? `طلبت جهد ${TIER_WORD.ar[asked]}. ` : "";
    if (o.tier === "asleep") return `${pre}الطاقة ${num(lang, o.pct)}٪ فترافل نايم. ما فيه نداء للنموذج. التكلفة 0.`;
    return `${pre}الطاقة ${num(lang, o.pct)}٪ لذلك جهد ${t}. التفكير ${o.thinking ? "شغّال" : "طافي"}. التكلفة ${num(lang, o.spent)}.`;
  }
  const pre = asked ? `You asked for ${asked}. ` : "";
  if (o.tier === "asleep") return `${pre}Energy ${o.pct}% so Truffle is asleep. No model call. Cost 0.`;
  return `${pre}Energy ${o.pct}% so ${t} effort. Thinking ${o.thinking ? "on" : "off"}. Cost ${o.spent}.`;
}

export function explainSteps(lang: Lang, steps: number, pct: number, tier: Tier, burrowed: boolean): string {
  const t = TIER_WORD[lang][tier];
  if (lang === "ar") {
    return `${num(lang, steps)} خطوة اليوم. الطاقة ${num(lang, pct)}٪. ${tier === "asleep" ? "ترافل نايم، فالرد الجاي سطر نعسان." : `الرد الجاي بجهد ${t}.`}${burrowed ? " يوم حر، فالخطوات تطعمه بس ما تكبّره." : ""}`;
  }
  return `${num(lang, steps)} steps today. Energy ${pct}%. ${tier === "asleep" ? "Truffle is asleep, so the next reply is one sleepy line." : `Next reply: ${t} effort.`}${burrowed ? " Heat day, so steps feed it but do not grow it." : ""}`;
}

export function explainMidnight(
  lang: Lang,
  o: { burned: number; pct: number; zero_days: number; dead: boolean; wasBurrowed: boolean; affectionUp: boolean; grew?: Stage }
): string {
  const ar = lang === "ar";
  if (o.dead) {
    return ar
      ? "أربع ليالٍ والطاقة صفر. ترافل رجع للتراب. صار له حجر صغير."
      : "Four empty midnights in a row. Truffle went back to the soil. It has a small stone now.";
  }
  if (o.wasBurrowed) {
    return ar
      ? "منتصف الليل مرّ. كان يوم حر، فما فيه حرق وما ينحسب يوم فاضي."
      : "Midnight passed. It was a heat day, so no burn and no empty day counted.";
  }
  const parts: string[] = [];
  parts.push(ar ? `منتصف الليل مرّ. حرق ${num(lang, o.burned)}. الطاقة ${num(lang, o.pct)}٪.` : `Midnight passed. Burned ${o.burned}. Energy ${o.pct}%.`);
  if (o.zero_days > 0) parts.push(ar ? `ليالي فاضية: ${o.zero_days} من 4.` : `Empty midnights: ${o.zero_days} of 4.`);
  parts.push(
    o.affectionUp
      ? ar ? "تفوّقت على معدّلك، فزادت المودة." : "You beat your average, so affection went up."
      : ar ? "المودة نزلت درجة." : "Affection eased down one."
  );
  return parts.join(" ");
}

export function explainGrew(lang: Lang, stage: Stage): string {
  return lang === "ar" ? `كبر وصار ${STAGE_WORD.ar[stage]}.` : `It grew into a ${stage}.`;
}

const STAGE_BY_INDEX: readonly Stage[] = ["Spore", "Sprout", "Truffle", "Elder"];

/** Numbers in moment lines: Latin digits in English, Arabic-Indic digits in Arabic. */
export function momentNum(lang: Lang, n: number): string {
  return Math.round(n).toLocaleString(lang === "ar" ? "ar-u-nu-arab" : "en-US");
}

/**
 * One fixed line per proud moment (decision 0017). Truffle's quiet voice:
 * lowercase, no exclamation marks, no emoji, the number in the line.
 * The model never writes these.
 */
export function momentLine(lang: Lang, kind: MomentKind, value: number): string {
  const n = momentNum(lang, value);
  if (lang === "ar") {
    switch (kind) {
      case "stage_up":
        return `كبر. صار ${STAGE_WORD.ar[STAGE_BY_INDEX[value] ?? "Sprout"]}.`;
      case "best_day":
        return `أفضل يوم هالأسبوع. ${n} خطوة.`;
      case "beat_avg7":
        return `فوق يومك المعتاد. ${n} خطوة.`;
      case "day_10k":
        return `عشرة آلاف اليوم. ${n} خطوة.`;
      case "streak":
        return `${n} ${value >= 3 && value <= 10 ? "أيام" : "يوم"} مشي ورا بعض.`;
      case "lifetime":
        return `${n} خطوة مع بعض لين الحين.`;
      case "heat_day_indoor":
        return `يوم حر، وبعدك تحركت. ${n} خطوة.`;
    }
  }
  switch (kind) {
    case "stage_up":
      return `it grew. ${(STAGE_BY_INDEX[value] ?? "Sprout").toLowerCase()} now.`;
    case "best_day":
      return `best day this week. ${n} steps.`;
    case "beat_avg7":
      return `past your usual day. ${n} steps.`;
    case "day_10k":
      return `ten thousand today. ${n} steps.`;
    case "streak":
      return `${n} walking days in a row.`;
    case "lifetime":
      return `${n} steps together so far.`;
    case "heat_day_indoor":
      return `a hot day, and you still moved. ${n} steps.`;
  }
}
