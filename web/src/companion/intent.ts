export type OutingKind = "walk" | "errand";
export type Intent =
  | { type: "plan"; kind: OutingKind }
  | { type: "back"; kind?: OutingKind }
  | { type: "cancel"; kind?: OutingKind }
  | { type: "quiet" }
  | { type: "none" };

// Deliberately a small affirmative grammar. Unknown wording still gets its normal
// model answer; a false positive would invent a persistent plan for the person.
export function classifyIntent(text: string): Intent {
  if (typeof text !== "string" || text.length > 2000) return { type: "none" };
  const s = text.toLowerCase().normalize("NFKC").replace(/[‘’]/g, "'")
    .replace(/[\u064b-\u065f\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
    .replace(/\s+/g, " ").trim().replace(/[.!。!]+$/g, "").trim();
  // Apostrophes within contractions are allowed. Quoted and reported speech is not.
  if (!s || /["“”«»`]|(?:^|\s)'|'(?:\s|$)/u.test(s)) return { type: "none" };
  // A polite request can end in a question mark. Match its whole sentence so
  // reported speech or a later reversal cannot silently change preferences.
  const quiet = s.replace(/[?؟]+$/, "").trim()
    .replace(/^(?:please[, ]+|(?:could|would|can) you (?:please )?)/, "")
    .replace(/^(?:من فضلك |لو سمحت |ممكن )/, "")
    .replace(/(?:,? (?:please|thanks)|[،,]? لو سمحت)$/, "");
  if (/^(?:stop reminding me|(?:don't|do not) remind me)(?: about (?:walks|walking|going out))?$/.test(quiet)
    || /^no more outing prompts$/.test(quiet)
    || /^i (?:don't|do not) want (?:a |any |more )?reminders?(?:[,;] (?:but|and) (?:i'm|i am) going (?:shopping|for a walk))?$/.test(quiet)
    || /^(?:(?:لا|ما) تذكرني(?: بالمشي)?|ما (?:ابي|ابغي) تذكير(?:ات)?|بدون تذكير)$/.test(quiet)) return { type: "quiet" };
  if (/[?؟]/.test(s)) return { type: "none" };
  if (/^(?:(?:i|i've|i have) )?changed my mind[,;]? (?:i'm |i am )?staying (?:in|home)$/.test(s)
    || /^(?:i'm|i am) (?:staying (?:in|home)|resting)(?: (?:instead|today))?$/.test(s)
    || /^(?:i'll|i will) stay (?:in|home)(?: (?:instead|today))?$/.test(s)
    || /^(?:i'm |i am )?not going after all$/.test(s)
    || /^(?:(?:بطلت|غيرت رايي)[،,]? )?(?:بجلس|باقي) في البيت$/.test(s)
    || /^(?:بطلت|بارتاح(?: اليوم)?)$/.test(s)) return { type: "cancel" };
  if (/^(?:i'm|i am) not going (?:for a walk|walking)$/.test(s)
    || /^(?:ما (?:بطلع|بروح) امشي|ماني (?:طالع|رايح) امشي)$/.test(s)) return { type: "cancel", kind: "walk" };
  if (/^(?:i'm|i am) not going (?:grocery shopping|shopping|to (?:the )?(?:grocery store|shop|shops|store|supermarket))$/.test(s)
    || /^(?:ماني رايح(?:ة)?|ما بروح) (?:البقالة|للبقالة|السوق|للسوق|السوبرماركت|للسوبرماركت)$/.test(s)) return { type: "cancel", kind: "errand" };

  const returning = s.replace(/ (?:now|الحين|الان)$/, "");
  if (/^(?:(?:i'm|i am) )?back(?: (?:home|again))?$/.test(returning)
    || /^(?:i'm|i am) home$/.test(returning)
    || /^(?:انا )?رجعت(?: البيت)?$/.test(returning)) return { type: "back" };
  if (/^(?:(?:i'm|i am) )?back from (?:the |my )?(?:walk|walking)$/.test(returning)
    || /^(?:انا )?رجعت من (?:المشي|المشية)$/.test(returning)) return { type: "back", kind: "walk" };
  if (/^(?:(?:i'm|i am) )?back from (?:the )?(?:groceries|grocery store|shopping|shop|shops|store|supermarket|errand|errands)$/.test(returning)
    || /^(?:انا )?رجعت من (?:البقالة|السوق|السوبرماركت|المشوار)$/.test(returning)) return { type: "back", kind: "errand" };

  const english = s.replace(/ (?:now|soon|today|this morning|this afternoon|this evening|for a bit)$/, "");
  const subject = "(?:(?:i'm|i am) )?";
  if (new RegExp(`^${subject}(?:heading(?: out)?|going|off|walking) (?:for groceries|grocery shopping|shopping|to (?:the )?(?:grocery store|shop|shops|store|supermarket)|to (?:get|buy) (?:some )?groceries|(?:on|to run) (?:an errand|errands))$`).test(english)
    || /^(?:i'm|i am) going shopping$/.test(english)) return { type: "plan", kind: "errand" };
  if (new RegExp(`^${subject}(?:going(?: out| to go)?|heading out|off) for a (?:short )?walk$`).test(english)
    || /^(?:i'm|i am) (?:taking a (?:short )?walk|going walking|going to walk)$/.test(english)) return { type: "plan", kind: "walk" };
  const arabic = s.replace(/^(?:انا )/, "").replace(/ (?:الحين|الان|بعد شوي|اليوم|شوي)$/, "");
  if (/^(?:(?:طالع|طالعة|رايح|رايحة|بروح|بطلع) (?:البقالة|للبقالة|السوق|للسوق|السوبرماركت|للسوبرماركت|اقضي اغراض|اتسوق|مشوار)|(?:بروح|بطلع) اشتري اغراض)$/.test(arabic)) return { type: "plan", kind: "errand" };
  if (/^(?:طالع|طالعة|رايح|رايحة|بطلع|بروح) (?:امشي|اتمشي)$/.test(arabic)
    || /^ساذهب للمشي$/.test(arabic)) return { type: "plan", kind: "walk" };
  return { type: "none" };
}
