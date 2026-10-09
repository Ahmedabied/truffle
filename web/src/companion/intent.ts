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
  if (/^(?:please )?(?:stop reminding me|no more outing prompts)(?:[,.].*)?$/.test(s)
    || /^i (?:don't|do not) want (?:a |any |more )?reminders?(?:[,;] (?:but |and ).*)?$/.test(s)
    || /^(?:لا تذكرني(?: بالمشي)?|ما ابي تذكير|ما ابغي تذكير)$/.test(s)) return { type: "quiet" };
  if (/[?؟]/.test(s)) return { type: "none" };
  if (/^(?:i )?changed my mind[,;]? (?:i'm |i am )?staying (?:in|home)$/.test(s)
    || /^(?:i'm |i am )?not going after all$/.test(s)
    || /^بطلت(?:[،,]? (?:بجلس|باقي) في البيت)?$/.test(s)) return { type: "cancel" };
  if (/^(?:i'm|i am) not going (?:for a walk|walking)$/.test(s)
    || /^(?:ما (?:بطلع|بروح) امشي|ماني (?:طالع|رايح) امشي)$/.test(s)) return { type: "cancel", kind: "walk" };
  if (/^(?:i'm|i am) not going (?:shopping|to the (?:shop|shops|store))$/.test(s)
    || /^(?:ماني رايح|ما بروح) (?:البقالة|السوق)$/.test(s)) return { type: "cancel", kind: "errand" };

  if (/^(?:(?:i'm|i am) )?back(?: (?:now|again))?$/.test(s) || /^(?:انا )?رجعت$/.test(s)) return { type: "back" };
  if (/^(?:(?:i'm|i am) )?back from (?:the |my )?(?:walk|walking)$/.test(s)
    || /^(?:انا )?رجعت من (?:المشي|المشية)$/.test(s)) return { type: "back", kind: "walk" };
  if (/^(?:(?:i'm|i am) )?back from (?:the )?(?:groceries|shopping|shop|shops|store|errand|errands)$/.test(s)
    || /^(?:انا )?رجعت من (?:البقالة|السوق|المشوار)$/.test(s)) return { type: "back", kind: "errand" };

  const english = s.replace(/ (?:now|soon|today|this morning|this afternoon|this evening|for a bit)$/, "");
  const subject = "(?:(?:i'm|i am) )?";
  if (new RegExp(`^${subject}(?:heading out|going|off|walking) (?:for groceries|grocery shopping|shopping|to (?:the )?(?:shop|shops|store|supermarket)|to (?:get|buy) groceries|(?:on|to run) (?:an errand|errands))$`).test(english)
    || /^(?:i'm|i am) going shopping$/.test(english)) return { type: "plan", kind: "errand" };
  if (new RegExp(`^${subject}(?:going|heading out|off) for a walk$`).test(english)
    || /^(?:i'm|i am) (?:taking a walk|going walking)$/.test(english)) return { type: "plan", kind: "walk" };
  const arabic = s.replace(/^(?:انا )/, "").replace(/ (?:الحين|الان|بعد شوي|اليوم)$/, "");
  if (/^(?:(?:طالع|طالعة|رايح|رايحة|بروح|بطلع) (?:ل?البقالة|ل?لسوق|السوق|اقضي اغراض|اتسوق|مشوار)|(?:بروح|بطلع) اشتري اغراض)$/.test(arabic)) return { type: "plan", kind: "errand" };
  if (/^(?:طالع|طالعة|رايح|رايحة|بطلع|بروح) (?:امشي|اتمشي)$/.test(arabic)) return { type: "plan", kind: "walk" };
  return { type: "none" };
}
