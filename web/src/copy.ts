// UI copy in both languages. Short, warm, never shaming.
// Arabic never goes inside the ASCII grid. It lives in normal HTML elements.

import type { Mood } from "../../worker/src/engine";
import type { Stage, Tier } from "../../worker/src/config";
import type { MomentKind } from "./moments";

export type Lang = "ar" | "en";

const en = {
  title: "Truffle",
  pocket: "Pocket",
  backToWorld: "Back to world",
  connection: "Connection",
  energyDetails: "How food works",
  replyEnergyUsed: "A little food spent on our conversation.",
  demoMode: "demo",
  demoStart: "Try a pretend walk to wake Truffle, then say hello.",
  replyNoEnergy: "A sleepy hello. No food spent.",
  shareSaved: "Saved a picture of your world.",
  giftOpen: "Open a little keepsake",

  pocketWorld: "a pocket world",
  worldCaption: "A little life, at your pace",
  sampleWorld: "sample world",
  conversation: "A quiet conversation",
  headingOut: "Heading out?",
  outingTitle: "A little adventure together",
  outingBody: "Tell Truffle your plan. No route, distance or destination needed.",
  outingWalk: "Taking a walk",
  outingErrand: "Just an errand",
  outingWalkNote: "Oh, a pocket adventure. I am coming along. Take your time. If you like, bring back one tiny thing you noticed.",
  outingErrandNote: "Even groceries? Excellent. I will be your very small shopping companion. Tell me about it when you are back.",
  keepsakes: "Your little keepsakes",
  keepsakesEmpty: "Truffle likes making small things while you are away. Come back later. Rest days count too.",
  keepsakesNote: "A little drawing may be waiting after ten minutes away. One a day, including rest days. Your older keepsakes stay in the archive.",
  giftWaiting: "I made a little something for you.",
  giftFrom: "Made by Truffle",
  previewGift: "Preview a return gift",
  energyStore: "Food for the days ahead",
  foodChatNote: "Food carries into tomorrow. It also pays for our conversations.",
  energyNote: "Stored food lasts across midnight. This trial uses 1,000 food points per elapsed day at every age. Heat shelter pauses that use. Actual AI replies spend 20, 60 or 200 points for small, everyday or deeper replies, capped by available effort.",
  foodReserveNote: "A rough reserve at the trial rate, before chats or future steps. Heat shelter pauses daily use.",
  effortEveryday: "Everyday · up to 60 food",
  effortSmall: "Small · up to 20 food",
  effortDeep: "Think deeper · up to 200 food",
  effortAsleep: "Sleepy hello · 0 food",
  effortNote: "Everyday chooses medium effort, or low for a short hello. Available food can lower the effort and price. Only a reply with visible text uses food.",
  nextDayNote: "This demo advances 24 hours. Ordinary midnight resets the step diary, with no extra food charge.",
  giftPending: "Your away plan is saved. Truffle can make a little drawing after ten minutes away. Come back whenever you like.",
  giftScheduleFailed: "We could not confirm your away plan was saved, so no drawing is promised this time. Take your time.",
  giftArchive: "Saved on this device",
  giftPreview: "Drawing preview",
  giftPreviewNote: "Try the same drawing maker used for away gifts. This preview is not added to your collection.",
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
  energy: "Food",
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
  judgeIntro: "A demo Truffle for trying steps, a passing day and heat. Online demos last 24 hours.",
  sliderLabel: "Steps today",
  midnight: "Next day (+24 hours)",
  heatOn: "Heat day: on",
  heatOff: "Heat day: off",
  reset: "Reset",
  askFor: "Reply effort",
  auto: "Everyday · up to 60 food",
  working: "Working...",
  loading: "Waking the world...",
  pairing: "Planting your spore...",
  stepsOnlyUp: "Today's total keeps the highest count. A lower number adds no steps.",
  freshSpore: "A fresh spore. Steps will wake it.",
  heatExplainOn: "A day for shade. Truffle rests safely; steps can still refill its energy.",
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
  importPaused: "Waiting for your Truffle",
  importFailed: "That Truffle could not be verified. Your saved pet is unchanged. Try again to reconnect it.",
  importDeclined: "The connection was canceled. Your saved pet is unchanged. Try again to connect the Truffle from the app.",
  importReopen: "The connection is unfinished. Reopen the Truffle link from the app to continue. Your saved pet is unchanged.",
  appPetRequired: "Open Feed in the app to make or connect your Truffle, then return to World.",
  apiInvalid: "Use an HTTPS server address without a path, query or password.",
  apiChange: "Change server? Each server has a separate pet. Your current pet stays saved for this server.",
  forgetConfirm: "Forget this pet in this browser? Save its app pairing first if you want to return."
};

export type CopyKey = keyof typeof en;

const ar: Record<CopyKey, string> = {
  title: "ترافل",
  pocket: "الجيب",
  backToWorld: "ارجع للعالم",
  connection: "الاتصال",
  energyDetails: "كيف يشتغل الطعام",
  replyEnergyUsed: "صرفنا شوي طعام على سوالفنا.",
  demoMode: "تجربة",
  demoStart: "جرّب مشية تجريبية تصحّي ترافل، وبعدين سلّم عليه.",
  replyNoEnergy: "سلام نعسان. ما صرفنا طعام.",
  shareSaved: "حفظنا صورة من عالمك.",
  giftOpen: "افتح تذكار صغير",

  pocketWorld: "عالم في جيبك",
  worldCaption: "حياة صغيرة، وعلى راحتك",
  sampleWorld: "عالم تجريبي",
  conversation: "سوالف هادية",
  headingOut: "طالع؟",
  outingTitle: "مغامرة صغيرة سوا",
  outingBody: "قل لترافل وش خطتك. ما نحتاج طريق ولا مسافة ولا وجهة.",
  outingWalk: "طالع أمشي",
  outingErrand: "بس مشوار",
  outingWalkNote: "أوه، مغامرة في الجيب. أنا معك. خذ راحتك. وإذا ودك، ارجع سولف لي عن شي صغير لاحظته.",
  outingErrandNote: "حتى لو للبقالة؟ حلو. بكون رفيق تسوّق صغير مرّة. سولف لي يوم ترجع.",
  keepsakes: "تذكاراتك الصغيرة",
  keepsakesEmpty: "ترافل يحب يسوي لك أشياء صغيرة وأنت غايب. ارجع بعدين. حتى أيام الراحة لها هدايا.",
  keepsakesNote: "ممكن تنتظرك رسمة صغيرة بعد عشر دقايق من الغياب. وحدة باليوم، حتى في أيام الراحة. تذكاراتك القديمة تبقى في الأرشيف.",
  giftWaiting: "سويت لك شي صغير.",
  giftFrom: "من صنع ترافل",
  previewGift: "جرّب هدية الرجعة",
  energyStore: "طعام للأيام الجاية",
  foodChatNote: "الطعام يبقى لبكرة. ومنه تكلفة سوالفنا بعد.",
  energyNote: "الطعام المخزّن يبقى بعد منتصف الليل. في هالتجربة، ترافل يستخدم ١٬٠٠٠ نقطة طعام لكل يوم يمر، في كل الأعمار. الاحتماء من الحر يوقف هالاستخدام. ردود الذكاء الاصطناعي الفعلية تستخدم ٢٠ أو ٦٠ أو ٢٠٠ نقطة للرد القصير أو اليومي أو الأعمق، بحد الجهد المتاح.",
  foodReserveNote: "مخزون تقريبي حسب معدل التجربة، قبل السوالف والخطوات الجاية. الاحتماء من الحر يوقف الاستخدام اليومي.",
  effortEveryday: "يومي · لحد ٦٠ طعام",
  effortSmall: "قصير · لحد ٢٠ طعام",
  effortDeep: "تفكير أعمق · لحد ٢٠٠ طعام",
  effortAsleep: "سلام نعسان · ٠ طعام",
  effortNote: "اليومي يختار جهد متوسط، أو منخفض للتحية القصيرة. الطعام المتاح ممكن يقلّل الجهد والتكلفة. الطعام ينصرف بس إذا ظهر نص الرد.",
  nextDayNote: "هالتجربة تقدّم الوقت ٢٤ ساعة. منتصف الليل العادي يبدأ يوم خطوات جديد بدون خصم طعام إضافي.",
  giftPending: "حفظنا خطة غيابك. يقدر ترافل يسوي رسمة صغيرة بعد عشر دقايق غياب. ارجع على راحتك.",
  giftScheduleFailed: "ما قدرنا نتأكد إن خطة غيابك انحفظت، فما نقدر نوعدك برسمة هالمرة. خذ راحتك.",
  giftArchive: "محفوظ على هالجهاز",
  giftPreview: "معاينة رسمة",
  giftPreviewNote: "جرّب نفس صانع رسومات هدايا الغياب. هالمعاينة ما تنضاف لمجموعتك.",
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
  energy: "الطعام",
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
  judgeIntro: "ترافل تجريبي عشان تجرّب الخطوات ومرور يوم والحر. نسخة التجربة على الخادم تنتهي بعد ٢٤ ساعة.",
  sliderLabel: "خطوات اليوم",
  midnight: "اليوم التالي (+٢٤ ساعة)",
  heatOn: "يوم حر: شغّال",
  heatOff: "يوم حر: طافي",
  reset: "ابدأ من جديد",
  askFor: "جهد الرد",
  auto: "يومي · لحد ٦٠ طعام",
  working: "لحظة...",
  loading: "العالم يصحى...",
  pairing: "نزرع بذرتك...",
  stepsOnlyUp: "نحتفظ بأعلى عدد خطوات اليوم. الرقم الأقل ما يضيف خطوات.",
  freshSpore: "بذرة جديدة. الخطوات تصحّيها.",
  heatExplainOn: "يوم للظل. ترافل يرتاح بأمان، والخطوات تقدر تعبي طاقته.",
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
  importPaused: "ننتظر ترافل حقك",
  importFailed: "ما قدرنا نتحقق من ترافل هذا. رفيقك المحفوظ ما تغيّر. جرّب مرة ثانية عشان نوصله.",
  importDeclined: "ألغيت الاتصال. رفيقك المحفوظ ما تغيّر. جرّب مرة ثانية عشان توصل ترافل اللي في التطبيق.",
  importReopen: "الاتصال ما اكتمل. افتح رابط ترافل من التطبيق مرة ثانية عشان تكمّل. رفيقك المحفوظ ما تغيّر.",
  appPetRequired: "افتح تبويب التغذية في التطبيق عشان تنشئ ترافل أو تربطه، ثم ارجع للعالم.",
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
  const tier = TIER_WORD[lang][o.tier];
  if (o.brain === "sample") {
    return lang === "ar"
      ? `رد تجريبي بمحاكاة، بدون نداء لنموذج ذكاء اصطناعي. تكلفة الطعام في المحاكاة: ${momentNum(lang, o.spent)} نقطة في العالم التجريبي فقط.`
      : `Simulated sample reply. No AI model call. Simulated cost: ${o.spent} food points in this sample world only.`;
  }
  if (lang === "ar") {
    if (o.tier === "asleep") return "سلام نعسان. ما فيه نداء للنموذج. التكلفة ٠ طعام.";
    return `جهد الرد ${tier}. التفكير ${o.thinking ? "شغّال" : "طافي"}. التكلفة الفعلية ${momentNum(lang, o.spent)} طعام. نسبة امتلاء المخزون ما تحدد جهد الرد وحدها.`;
  }
  if (o.tier === "asleep") return "A sleepy hello. No model call. Cost 0 food.";
  return `${tier[0].toUpperCase() + tier.slice(1)} effort. Thinking ${o.thinking ? "on" : "off"}. Actual cost ${o.spent} food. Store fullness alone does not determine reply effort.`;
}

export function explainSteps(lang: Lang, steps: number, pct: number, tier: Tier, burrowed: boolean): string {
  if (lang === "ar") return `${num(lang, steps)} خطوة اليوم. ${burrowed ? "ترافل يرتاح في الظل، وطاقته محفوظة للسوالف." : tier === "asleep" ? "ترافل نعسان الحين. خذ راحتك." : "ترافل عنده طاقة للسوالف. خذ راحتك."}`;
  return `${num(lang, steps)} steps today. ${burrowed ? "Truffle is resting in the shade, with energy for company." : tier === "asleep" ? "Truffle is sleepy for now. Take your time." : "Truffle has energy for company. Take your time."}`;
}

export function explainMidnight(
  lang: Lang,
  o: { burned: number; pct: number; zero_days: number; dead: boolean; wasBurrowed: boolean; affectionUp: boolean; grew?: Stage; continuous?: boolean }
): string {
  const ar = lang === "ar";
  if (o.continuous) {
    if (o.dead) return ar
      ? "مرّ يوم في التجربة. ترافل رجع للتراب بعد ٩٦ ساعة بدون طعام خارج فترة الاحتماء من الحر. تقدر تزرع بذرة جديدة."
      : "A demo day passed. Truffle returned to the soil after 96 hours without food outside heat shelter. You can plant a new spore.";
    return ar
      ? `مرّ يوم في التجربة. استخدام الطعام خلال الوقت اللي مرّ: ${momentNum(lang, o.burned)}. ${o.wasBurrowed ? "الاحتماء من الحر وقف الاستخدام. " : ""}بدأ يوم خطوات جديد. ما فيه خصم إضافي عند منتصف الليل.`
      : `A demo day passed. Food used over that time: ${num(lang, o.burned)}. ${o.wasBurrowed ? "Heat shelter paused that use. " : ""}A fresh step diary begins. Midnight adds no extra charge.`;
  }
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

/** Reserve is an estimate for food use, never a survival countdown. */
export function foodSummary(lang: Lang, food: number, capacity: number): { amount: string; reserve: string } {
  const safeFood = Math.max(0, Math.floor(food));
  const amount = lang === "ar"
    ? `${momentNum(lang, safeFood)} من ${momentNum(lang, capacity)} نقطة طعام`
    : `${momentNum(lang, safeFood)} of ${momentNum(lang, capacity)} food points`;
  const days = safeFood / 1_000;
  const rounded = new Intl.NumberFormat(lang === "ar" ? "ar-u-nu-arab" : "en-US", { maximumFractionDigits: 1 }).format(days);
  const reserve = safeFood === 0
    ? lang === "ar" ? "المخزون فاضي حاليًا. الخطوات الجاية تقدر تعبيه." : "The store is empty for now. Future steps can refill it."
    : days < 0.1
      ? lang === "ar" ? "مخزون صغير لوقت هادي." : "A little food in reserve."
      : lang === "ar" ? `حوالي ${rounded} يوم من الاستخدام الهادي.` : `About ${rounded} days of quiet use.`;
  return { amount, reserve };
}

/** The upper bound visible before send. The Worker still admits the actual tier. */
export function replyFoodEstimate(lang: Lang, available: Tier, requested?: Tier): string {
  const costs: Record<Tier, number> = { asleep: 0, low: 20, medium: 60, high: 200 };
  const maximum = Math.min(costs[available], costs[requested ?? "medium"]);
  return lang === "ar"
    ? `بالمخزون الحالي: لحد ${momentNum(lang, maximum)} نقطة طعام للرد.`
    : `With this food: up to ${maximum} points per reply.`;
}
