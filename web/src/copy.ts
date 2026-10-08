// UI copy in both languages. Short, warm, never shaming.
// Arabic never goes inside the ASCII grid. It lives in normal HTML elements.

import type { Mood } from "../../worker/src/engine";
import type { Stage, Tier } from "../../worker/src/config";
import type { MomentKind } from "./moments";

export type Lang = "ar" | "en";

const en = {
  title: "Truffle",
  pause: "Take a moment",
  back: "I'm back",
  pauseNotice: "Wherever you are, notice one small thing: a sound, a shadow, a change in the air. No need to keep this screen open.",
  pauseHeat: "No rescue mission today. Stay comfortable indoors. Notice the light, or a sound around you. Truffle can wait.",
  returnNotice: "Welcome back. What did you notice? Share it if you like.",
  retry: "Try again",
  syncPaused: "Updates paused. This is your last saved world.",
  welcomeTitle: "Your steps wake a little world.",
  welcomeBody: "An AI companion with energy to spend. Walk when it suits you, come back, and tell it what you noticed.",
  tryDemo: "Try it without a phone",
  tryWalk: "Try a 4,000-step walk",
  chatHint: "A little quiet for now. Steps give Truffle energy for a conversation.",
  chatReady: "There you are. Tell Truffle about your day.",
  heatRest: "Rest is part of the story. Truffle stays sheltered from the heat.",
  footerNote: "A small world. Your own pace.",
  sourceCode: "How it works",
  offline: "offline demo",
  halfAwake: "half-awake (fallback brain)",
  langToggle: "عربي",
  settings: "Settings",
  placeholder: "Say something to Truffle",
  placeholderAsleep: "Truffle is asleep. Steps wake it.",
  placeholderDead: "Plant a new spore to talk again.",
  send: "Send",
  thinking: "Truffle is listening...",
  yawning: "Truffle is waking up...",
  chatError: "Truffle could not finish the reply. Try again in a little while.",
  networkError: "Could not reach Truffle. Try again shortly. If this keeps happening, check the API address in Settings.",
  sporeButton: "Plant a new spore",
  memoryPrefix: "It remembered:",
  energy: "Energy",
  stepsToday: "steps today",
  effort: "effort",
  apiBase: "API address",
  save: "Save and reload",
  phrase: "Pairing phrase",
  copy: "Copy",
  copied: "Copied",
  fontSize: "Text size",
  smaller: "Smaller text",
  larger: "Larger text",
  motion: "Reduce motion",
  motionSystem: "Your system asks for less motion, so the sky stays still.",
  forget: "Forget this Truffle on this browser",
  judgeTitle: "Judge mode",
  judgeIntro: "A demo Truffle for trying steps, midnight and heat. Online demos last 24 hours.",
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
  stepsOnlyUp: "Today's total keeps the highest count. A lower number adds no steps.",
  freshSpore: "A fresh spore. Steps will wake it.",
  heatExplainOn: "Heat day. Truffle burrows. No growth today and it cannot die today.",
  heatExplainOff: "Heat mode is off. Truffle can come up again.",
  newSporeDone: "A new spore is in the sand. The old stone stays.",
  pollNote: "Updates every 30 seconds.",
  partial: "The reply ended early. Some text arrived, so the reply's energy cost was used.",
  moments: "Moments",
  momentsShow: "Show moments",
  momentsEmpty: "Your moments will appear here.",
  share: "Share",
  shareMaking: "Making the card...",
  shareFailed: "Could not make the card on this browser.",
  shareTag: "truffle, a pet that eats steps",
  openApp: "Open in the Truffle app",
  getApp: "Get the Android app",
  shareDemo: "simulated steps · demo Truffle",
  demoBusy: "The live demo is busy. Try this sample world with simulated steps and replies.",
  offlineIntro: "Simulated steps and sample replies. The same energy rules run here without a connection.",
  importPet: "Use this Truffle in this browser? This changes the pet shown here.",
  importFailed: "That Truffle could not be verified. Your saved pet is unchanged.",
  apiInvalid: "Use an HTTPS server address without a path, query or password.",
  apiChange: "Change server? Each server has a separate pet. Your current pet stays saved for this server.",
  forgetConfirm: "Forget this pet in this browser? Save its app pairing first if you want to return."
};

export type CopyKey = keyof typeof en;

const ar: Record<CopyKey, string> = {
  title: "ترافل",
  pause: "خذ لك لحظة",
  back: "رجعت",
  pauseNotice: "وين ما كنت، لاحظ شي صغير: صوت، ظل، أو تغيّر في الهوا. ما تحتاج تخلي الشاشة مفتوحة.",
  pauseHeat: "ما فيه مهمة إنقاذ اليوم. خلك مرتاح داخل. لاحظ النور أو صوت حولك. ترافل ينتظرك على راحته.",
  returnNotice: "هلا برجعتك. وش لاحظت؟ سولف عنه إذا ودك.",
  retry: "جرّب مرة ثانية",
  syncPaused: "التحديثات متوقفة. هذا آخر عالم محفوظ لك.",
  welcomeTitle: "خطواتك تصحّي عالم صغير.",
  welcomeBody: "رفيق ذكي طاقته من خطواتك. تحرّك على راحتك، وارجع سولف له عن اللي لاحظته.",
  tryDemo: "جرّبه بدون هاتف",
  tryWalk: "جرّب مشية من ٤٬٠٠٠ خطوة",
  chatHint: "هدوء شوي الحين. الخطوات تعطي ترافل طاقة للسوالف.",
  chatReady: "هلا فيك. سولف لترافل عن يومك.",
  heatRest: "الراحة جزء من الحكاية. ترافل يحتمي من الحر.",
  footerNote: "عالم صغير. وعلى راحتك.",
  sourceCode: "كيف يشتغل",
  offline: "عرض بدون اتصال",
  halfAwake: "نص صاحي (عقل احتياطي)",
  langToggle: "English",
  settings: "الإعدادات",
  placeholder: "قل شي لترافل",
  placeholderAsleep: "ترافل نايم. الخطوات تصحّيه.",
  placeholderDead: "ازرع بذرة جديدة عشان تسولف من جديد.",
  send: "أرسل",
  thinking: "ترافل يسمعك...",
  yawning: "ترافل يصحى...",
  chatError: "ترافل ما قدر يكمّل الرد. جرّب بعد شوي.",
  networkError: "ما قدرنا نوصل لترافل. جرّب بعد شوي. إذا استمر هالشي، شيّك على عنوان الخادم في الإعدادات.",
  sporeButton: "ازرع بذرة جديدة",
  memoryPrefix: "كان يتذكر:",
  energy: "الطاقة",
  stepsToday: "خطوة اليوم",
  effort: "الجهد",
  apiBase: "عنوان الخادم",
  save: "احفظ وأعد التحميل",
  phrase: "عبارة الربط",
  copy: "انسخ",
  copied: "تم النسخ",
  fontSize: "حجم النص",
  smaller: "نص أصغر",
  larger: "نص أكبر",
  motion: "قلّل الحركة",
  motionSystem: "جهازك يطلب حركة أقل، فالسماء ثابتة.",
  forget: "انسَ ترافل هذا على هذا المتصفح",
  judgeTitle: "وضع الحكّام",
  judgeIntro: "ترافل تجريبي عشان تجرّب الخطوات ومنتصف الليل والحر. نسخة التجربة على الخادم تنتهي بعد 24 ساعة.",
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
  stepsOnlyUp: "نحتفظ بأعلى عدد خطوات اليوم. الرقم الأقل ما يضيف خطوات.",
  freshSpore: "بذرة جديدة. الخطوات تصحّيها.",
  heatExplainOn: "يوم حر. ترافل يختبئ تحت الرمل. ما يكبر اليوم وما يموت اليوم.",
  heatExplainOff: "طفّينا وضع الحر. ترافل يقدر يطلع من جديد.",
  newSporeDone: "بذرة جديدة في الرمل. الحجر القديم باقي.",
  pollNote: "يتحدّث كل 30 ثانية.",
  partial: "الرد انقطع. وصل جزء منه، فانحسبت طاقة الرد.",
  moments: "لحظات",
  momentsShow: "اعرض اللحظات",
  momentsEmpty: "لحظاتك بتطلع هنا.",
  share: "شارك",
  shareMaking: "نسوي البطاقة...",
  shareFailed: "ما قدرنا نسوي البطاقة على هذا المتصفح.",
  shareTag: "ترافل، حيوان أليف ياكل خطوات",
  openApp: "افتح في تطبيق ترافل",
  getApp: "نزّل تطبيق أندرويد",
  shareDemo: "خطوات محاكاة · ترافل تجريبي",
  demoBusy: "التجربة الحية مشغولة. جرّب هذا العالم بخطوات وردود تجريبية.",
  offlineIntro: "خطوات محاكاة وردود تجريبية. نفس قواعد الطاقة تعمل هنا بدون اتصال.",
  importPet: "تستخدم ترافل هذا في المتصفح؟ بيتغيّر الرفيق المعروض هنا.",
  importFailed: "ما قدرنا نتحقق من ترافل هذا. رفيقك المحفوظ ما تغيّر.",
  apiInvalid: "استخدم عنوان خادم HTTPS بدون مسار أو معاملات أو كلمة مرور.",
  apiChange: "تغيّر الخادم؟ لكل خادم رفيق مستقل. رفيقك الحالي بيبقى محفوظ لهذا الخادم.",
  forgetConfirm: "تنسى هذا الرفيق في المتصفح؟ اربطه بالتطبيق أول إذا تبي ترجع له."
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
  return lang === "ar" ? `كبر وصار ${STAGE_WORD.ar[stage]}.` : `It grew into a ${stage}. A bigger body has more room for energy.`;
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
        return `وصلت خطواتك. ${n} اليوم. ما نحتاج مهمة إنقاذ.`;
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
      return `your steps arrived. ${n} today. no rescue needed.`;
  }
}
