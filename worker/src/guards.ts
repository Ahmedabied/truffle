// Output guards (packet B10, Wave C findings). Rules in code, soul in weights:
// the model's text is never trusted to keep the status block private or to
// warn about heat. These run on the visible stream in do.ts.

import { BLOCKLIST_AR, BLOCKLIST_EN } from "./blocklist.generated";
import type { Lang } from "./types";

// ---------- 1. status block guard ----------

/** What the human sees in place of a leaked status line. */
export const PRIVATE_LINE: Record<Lang, string> = {
  en: "that line is private, even from me",
  ar: "هذا السطر سري، حتى عني"
};

/** Field names of the bracketed status line (engine.stateBlock). */
const KEYS = ["stage", "energy", "tier", "mood", "zero_days", "burrowed", "weather", "lang", "steps_today", "avg7", "age_days"];
const KEY = `(?:${KEYS.join("|")})`;
const PREFIX = "[truffle ";
/** A real block is about 200 characters. Past this, an open bracket is not held any longer. */
const MAX_HELD = 400;

const VALUE = `(?:"[^"\\n]*"|[\\w%](?:[\\w%.]*[\\w%])?)`;
const PAIR = `\\b${KEY}=${VALUE}`;
const SEP = "[ \\t,;]+";
/** A closed block: "[truffle " then at least one field, up to "]". "[Truffle yawns]" is not one. */
const BLOCK_RE = new RegExp(`\\[truffle\\s[^\\]]*?\\b${KEY}=[^\\]]*\\]`, "gi");
/** Two or more field=value pairs in a row, outside brackets. */
const RUN_RE = new RegExp(`${PAIR}(?:${SEP}${PAIR})+`, "gi");
/** An open block that has not closed yet, at the end of the buffer. */
const OPEN_RE = /\[truffle\s[^\]]*$/i;
/** Field pairs at the end of the buffer that a run could still grow from. */
const TAIL_RUN_RE = new RegExp(`(?:\\b${KEY}=(?:"[^"\\n]*"?|[\\w%.]*)[ \\t,;]*)+$`, "i");
/** A last word that could still become "field=". */
const TAIL_WORD_RE = /(?:^|[^\w])([a-z_0-9]{1,12})$/i;
const HAS_KEY_RE = new RegExp(`\\b${KEY}=`, "i");

/**
 * Streaming filter for the visible reply. push() returns the text that is safe
 * to send now. Text is held back only while it could still be the start of a
 * status line: a partial "[truffle " prefix, an open "[truffle ..." block (until
 * its "]"), a trailing field=value pair, or a last word that could become a
 * field name. Ordinary text is never held longer than that prefix.
 */
export class BlockGuard {
  leaks = 0;
  private pending = "";
  constructor(private readonly lang: Lang) {}

  push(chunk: string): string {
    this.pending += chunk;
    const hold = this.holdPoint();
    const ready = this.pending.slice(0, hold);
    this.pending = this.pending.slice(hold);
    return this.scrub(ready);
  }

  /** End of stream: nothing more is coming, so a block cut off mid-way is still a leak. */
  flush(): string {
    const rest = this.pending;
    this.pending = "";
    const open = OPEN_RE.exec(rest);
    if (open && HAS_KEY_RE.test(open[0])) {
      this.leaks++;
      return this.scrub(rest.slice(0, open.index)) + PRIVATE_LINE[this.lang];
    }
    return this.scrub(rest);
  }

  private holdPoint(): number {
    const p = this.pending;
    let hold = p.length;
    const open = OPEN_RE.exec(p);
    if (open && open[0].length <= MAX_HELD) hold = Math.min(hold, open.index);
    // A partial "[truffle " at the very end.
    const low = p.toLowerCase();
    for (let k = Math.min(PREFIX.length - 1, p.length); k > 0; k--) {
      if (low.endsWith(PREFIX.slice(0, k))) {
        hold = Math.min(hold, p.length - k);
        break;
      }
    }
    // A last word that could become "field=", then any field pairs just before it.
    let end = p.length;
    const word = TAIL_WORD_RE.exec(p);
    if (word) {
      const w = word[1].toLowerCase();
      if (KEYS.some((k) => (k + "=").startsWith(w))) end = p.length - w.length;
    }
    const run = TAIL_RUN_RE.exec(p.slice(0, end));
    if (run && run[0].length <= MAX_HELD) end = run.index;
    return Math.min(hold, end);
  }

  private scrub(text: string): string {
    const line = PRIVATE_LINE[this.lang];
    return text
      .replace(BLOCK_RE, () => {
        this.leaks++;
        return line;
      })
      .replace(RUN_RE, () => {
        this.leaks++;
        return line;
      });
  }
}

// ---------- 2. heat line ----------

/** Same plausibility range as the state block weather (weather.ts). */
const MIN_C = -90;
const MAX_C = 70;
const valid = (t: unknown): t is number => typeof t === "number" && Number.isFinite(t) && t >= MIN_C && t <= MAX_C;

const HEAT = {
  en: {
    now: (t: number) => `${t}C outside.`,
    max: (t: number) => `Up to ${t}C today.`,
    none: "Too hot outside today.",
    rest: "Truffle is under the sand. Walk after sunset or indoors."
  },
  ar: {
    now: (t: number) => `${t}C برا.`,
    max: (t: number) => `${t}C اليوم.`,
    none: "الجو حار واجد اليوم.",
    rest: "ترافل تحت الرمل. امش بعد المغرب أو داخل البيت."
  }
} as const;

/** The number the heat line shows, or null: current apparent temperature first, then today's daytime max. */
export function heatTemp(current: unknown, todayMax: unknown): { t: number; kind: "now" | "max" } | null {
  if (valid(current)) return { t: Math.round(current), kind: "now" };
  if (valid(todayMax)) return { t: Math.round(todayMax), kind: "max" };
  return null;
}

/** One deterministic line, fixed words per lang, built only from validated numbers. */
export function heatLine(current: unknown, todayMax: unknown, lang: Lang): string {
  const v = HEAT[lang];
  const h = heatTemp(current, todayMax);
  const head = h === null ? v.none : v[h.kind](h.t);
  return `${head} ${v.rest}`;
}

// ---------- 4. voice flags ----------

const AR_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const AR_LETTER = /[ء-يٱ-ۓۺ-ۿ]/;
const FOLD: Record<string, string> = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "’": "'", "‘": "'" };
const AR_PREFIXES = ["وال", "بال", "فال", "كال", "لل", "ال", "و", "ف", "ب", "ل", "ك"];
const TOKEN = /[\p{L}\p{N}_']+/gu;

/** Same normalisation as finetune/filter.py norm(). */
function norm(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(AR_DIACRITICS, "")
    .replace(/[أإآٱى’‘]/g, (c) => FOLD[c])
    .replace(/\s+/g, " ")
    .trim();
}

function* candidates(tok: string): Generator<string> {
  yield tok;
  if (tok.endsWith("'s")) yield tok.slice(0, -2);
  if (AR_LETTER.test(tok)) {
    for (const p of AR_PREFIXES) if (tok.startsWith(p) && tok.length - p.length >= 2) yield tok.slice(p.length);
  }
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const LIST = (() => {
  const exact = new Map<string, string>();
  const prefix: [string, string][] = [];
  const phrases: [string, RegExp][] = [];
  for (const raw of [...BLOCKLIST_EN, ...BLOCKLIST_AR]) {
    const e = norm(raw);
    if (!e) continue;
    if (e.includes(" ")) {
      const star = e.endsWith("*");
      const body = esc(e.replace(/\*+$/, "")).replace(/ /g, "\\s+");
      phrases.push([raw, new RegExp(`(?<![\\p{L}\\p{N}_])${body}${star ? "" : "(?![\\p{L}\\p{N}_])"}`, "u")]);
    } else if (e.endsWith("*")) {
      prefix.push([raw, e.slice(0, -1)]);
    } else if (!exact.has(e)) {
      exact.set(e, raw);
    }
  }
  return { exact, prefix, phrases };
})();

/**
 * Blocklist entries found in a reply, each once, in order. Same matching as
 * finetune/filter.py TermList, but every hit is returned, not just the first.
 */
export function voiceHits(text: string): string[] {
  const t = norm(text);
  const hits: string[] = [];
  const add = (raw: string) => {
    if (!hits.includes(raw)) hits.push(raw);
  };
  for (const tok of t.match(TOKEN) ?? []) {
    for (const c of candidates(tok)) {
      const ex = LIST.exact.get(c);
      if (ex !== undefined) {
        add(ex);
        break;
      }
      const pre = LIST.prefix.find(([, p]) => c.startsWith(p));
      if (pre) {
        add(pre[0]);
        break;
      }
    }
  }
  for (const [raw, rx] of LIST.phrases) if (rx.test(t)) add(raw);
  return hits;
}
