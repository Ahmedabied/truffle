// Decision 0023. Pure, bounded procedural craft: no clock, I/O, model or food charge.
import type { Stage } from "./config";

export type GiftIntent = "walk" | "errand" | "rest";
export type GiftJobState = "scheduled" | "ready" | "cancelled" | "expired";
export const GIFT_WAIT_MS = 10 * 60_000;
export const GIFT_TTL_MS = 24 * 60 * 60_000;
export const MAX_GIFTS = 12;
export const GIFT_GENERATOR_VERSION = 1 as const;
export const MAX_GIFT_ADMISSIONS_PER_HOUR = 30;

export interface StoredGift {
  id: string;
  generation: number;
  /** Pinned server local day at completion, which can differ from admission. */
  day: string;
  created_ms: number;
  art: string;
  text: Record<"en" | "ar", { name: string; note: string }>;
  provenance: { art: "procedural"; note: "authored"; version: typeof GIFT_GENERATOR_VERSION };
}

/** Internal only. Neither the random seed nor request identifier is public. */
export interface GiftJob {
  id: string;
  client_request_id?: string;
  generation: number;
  day: string;
  intent: GiftIntent;
  seed: string;
  generator_version: typeof GIFT_GENERATOR_VERSION;
  created_ms: number;
  due_ms: number;
  expires_ms: number;
  state: GiftJobState;
}

/** Keep the day/time/rate fences when a generation or its collection is cleared. */
export interface GiftLedger {
  job?: GiftJob;
  gifts: StoredGift[];
  last_gift_day?: string;
  high_water_ms?: number;
  rate?: { start_ms: number; count: number };
}

export interface GiftPet { stage: Stage; dead: boolean }
export interface GiftContext {
  now_ms: number;
  /** Trusted localDayKey(now_ms, pinnedTimezone), never browser input. */
  day: string;
  generation: number;
  pet: GiftPet;
}
export interface GiftRequest {
  id: string;
  /** Independent server randomness saved before admission is acknowledged. */
  seed: string;
  intent: GiftIntent;
  client_request_id?: string;
}
export interface GiftSummary {
  generation: number;
  pending: { id: string; intent: GiftIntent; due_ms: number } | null;
  gifts: StoredGift[];
}
export type GiftAdmission =
  | { ok: true; ledger: GiftLedger; job: GiftJob }
  | { ok: false; ledger: GiftLedger; reason: "dead" | "daily_limit" | "clock_rollback" | "rate_limited"; retry_after_s?: number };

export function admitGift(ledger: GiftLedger, context: GiftContext, request: GiftRequest): GiftAdmission {
  const { now_ms, day, generation, pet } = context;
  const deny = (reason: Extract<GiftAdmission, { ok: false }>["reason"], retry_after_s?: number): GiftAdmission =>
    ({ ok: false, ledger, reason, ...(retry_after_s === undefined ? {} : { retry_after_s }) });
  if (pet.dead) return deny("dead");
  if (now_ms < (ledger.high_water_ms ?? 0)) return deny("clock_rollback");
  const existing = ledger.job;
  if (existing?.generation === generation) {
    // Replayed terminal requests do not start a new wait. A later genuine away
    // event has a fresh request id and can replace an early cancellation.
    if (request.client_request_id && request.client_request_id === existing.client_request_id)
      return { ok: true, ledger, job: existing };
    if (existing.state === "scheduled" && now_ms < existing.expires_ms)
      return { ok: true, ledger, job: existing };
  }
  if (ledger.last_gift_day && day <= ledger.last_gift_day) return deny("daily_limit");
  const rate = !ledger.rate || now_ms >= ledger.rate.start_ms + 3_600_000
    ? { start_ms: now_ms, count: 0 } : ledger.rate;
  if (rate.count >= MAX_GIFT_ADMISSIONS_PER_HOUR)
    return deny("rate_limited", Math.max(1, Math.ceil((rate.start_ms + 3_600_000 - now_ms) / 1_000)));
  if (!validSeed(request.seed) || !validId(request.id) ||
      (request.client_request_id !== undefined && !validId(request.client_request_id)) ||
      !["walk", "errand", "rest"].includes(request.intent) || !validDay(day) ||
      !Number.isSafeInteger(now_ms) || now_ms < 0 || !Number.isSafeInteger(generation) || generation < 0)
    throw new Error("Invalid internal gift admission");
  const job: GiftJob = {
    ...request, generation, day, generator_version: GIFT_GENERATOR_VERSION,
    created_ms: now_ms, due_ms: now_ms + GIFT_WAIT_MS, expires_ms: now_ms + GIFT_TTL_MS, state: "scheduled"
  };
  return {
    ok: true, job,
    ledger: { ...ledger, job, high_water_ms: now_ms, rate: { start_ms: rate.start_ms, count: rate.count + 1 } }
  };
}
/** Returns and cancellations always cancel unstarted work, even when overdue. */
export function cancelGift(ledger: GiftLedger): GiftLedger {
  return ledger.job?.state === "scheduled" ? { ...ledger, job: { ...ledger.job, state: "cancelled" } } : ledger;
}
export function resetGifts(ledger: GiftLedger): GiftLedger {
  const { job: _job, ...fences } = ledger;
  return { ...fences, gifts: [] };
}
/** Call from the alarm, after fresh engine/generation state has been loaded. */
export function settleGift(ledger: GiftLedger, context: GiftContext): GiftLedger {
  const job = ledger.job;
  if (!job || job.state !== "scheduled") return ledger;
  const { now_ms, day, generation, pet } = context;
  if (pet.dead || job.generation !== generation) return cancelGift(ledger);
  if (now_ms < (ledger.high_water_ms ?? job.created_ms) || now_ms < job.due_ms) return ledger;
  if (now_ms >= job.expires_ms) return { ...ledger, job: { ...job, state: "expired" } };
  if (ledger.last_gift_day && day <= ledger.last_gift_day) return cancelGift(ledger);
  // Guard against a persisted duplicate even if an interrupted caller retained
  // a scheduled status. The real DO saves the entire returned ledger at once.
  if (ledger.gifts.some((gift) => gift.id === job.id)) return cancelGift(ledger);
  try {
    const gift = generateGift(job, pet, now_ms, day);
    if (!validGift(gift)) return cancelGift(ledger);
    return {
      ...ledger, job: { ...job, state: "ready" },
      gifts: [...ledger.gifts, gift].slice(-MAX_GIFTS),
      last_gift_day: day, high_water_ms: now_ms
    };
  } catch {
    // A malformed persisted job is terminal. No AI fallback or alarm retry loop.
    return cancelGift(ledger);
  }
}
export function giftSummary(ledger: GiftLedger, generation: number): GiftSummary {
  const job = ledger.job;
  return {
    generation,
    pending: job?.state === "scheduled" && job.generation === generation
      ? { id: job.id, intent: job.intent, due_ms: job.due_ms } : null,
    gifts: ledger.gifts.filter((gift) => gift.generation === generation).slice(-MAX_GIFTS)
  };
}

type Random = (limit: number) => number;
type Canvas = string[][];
const canvas = (): Canvas => Array.from({ length: 7 }, () => Array<string>(12).fill(" "));
function put(c: Canvas, x: number, y: number, glyph: string): void {
  if (x >= 0 && x < 12 && y >= 0 && y < 7) c[y][x] = glyph;
}
function row(c: Canvas, y: number, text: string, x = 0): void {
  for (let i = 0; i < text.length; i++) put(c, x + i, y, text[i]);
}
function drawing(c: Canvas): string {
  // Interior blank rows stay printable. No unbounded trim or repair loop.
  return c.map((line) => line.join("").trimEnd() || " ").join("\n");
}
/** FNV-1a plus Mulberry32, fixed for version 1. All input is bounded. */
function seeded(seed: string): Random {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return (limit) => {
    state = (state + 0x6d2b79f5) | 0;
    let word = Math.imul(state ^ (state >>> 15), state | 1);
    word ^= word + Math.imul(word ^ (word >>> 7), word | 61);
    return Math.floor(((word ^ (word >>> 14)) >>> 0) / 4294967296 * limit);
  };
}

function constellation(r: Random): string {
  const c = canvas();
  row(c, 0, ".----------.");
  row(c, 6, "'----------'");
  for (let y = 1; y < 6; y++) { put(c, 0, y, "|"); put(c, 11, y, "|"); }
  // Five columns of the star map each contribute a star. Connect successive
  // stars with dotted lines, then redraw the stars over their connections.
  const points = Array.from({ length: 5 }, (_, i) => ({ x: 1 + i * 2 + r(2), y: 1 + r(5), glyph: ["*", "+", "o"][r(3)] }));
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    for (let s = 1; s < steps; s++)
      put(c, Math.round(a.x + (b.x - a.x) * s / steps), Math.round(a.y + (b.y - a.y) * s / steps), ".");
  }
  for (const point of points) put(c, point.x, point.y, point.glyph);
  return drawing(c);
}

function bouquet(r: Random): string {
  const c = canvas();
  const flowers = [1, 5, 9].map((base) => ({ x: base + r(2), y: r(3), bloom: ["(*)", "{o}", "<*>", "(o)", "{@}", "{+}"][r(6)] }));
  for (const flower of flowers) {
    let previous = flower.x;
    for (let y = flower.y + 1; y <= 4; y++) {
      const x = Math.round(flower.x + (5 - flower.x) * (y - flower.y) / (5 - flower.y));
      put(c, x, y, x === previous ? "|" : x > previous ? "\\" : "/");
      if (r(2)) put(c, x + (x < 5 ? -1 : 1), y, x < 5 ? "<" : ">");
      previous = x;
    }
  }
  for (const flower of flowers) row(c, flower.y, flower.bloom, flower.x - 1);
  row(c, 5, "   \\___/");
  row(c, 6, "    \\_/");
  return drawing(c);
}

function garden(r: Random): string {
  const c = canvas();
  for (const base of [1, 5, 9]) {
    const x = base + r(2), top = r(3), bloom = ["*", "o", "@", "+"][r(4)];
    put(c, x, top, bloom);
    for (let y = top + 1; y < 5; y++) {
      put(c, x, y, "|");
      const leaves = r(3);
      if (leaves !== 0) put(c, x - 1, y, ["\\", "<"][r(2)]);
      if (leaves !== 1) put(c, x + 1, y, ["/", ">"][r(2)]);
    }
  }
  row(c, 5, "+----------+");
  row(c, 6, " \\________/");
  return drawing(c);
}

function weaving(r: Random): string {
  const c = canvas();
  row(c, 0, "+----------+");
  row(c, 6, "+----------+");
  const motifs = ["/", "\\", "o", "+", "-", ":"];
  const mirror = (glyph: string) => glyph === "/" ? "\\" : glyph === "\\" ? "/" : glyph;
  // Each woven row has an independent stitch sequence, reflected around the
  // center seam. Top and bottom reflection makes a small textile medallion.
  for (let y = 1; y <= 3; y++) {
    for (const yy of [y, 6 - y]) { put(c, 0, yy, "|"); put(c, 11, yy, "|"); }
    for (let x = 1; x <= 5; x++) {
      const stitch = motifs[r(motifs.length)];
      for (const yy of [y, 6 - y]) { put(c, x, yy, stitch); put(c, 11 - x, yy, mirror(stitch)); }
    }
  }
  return drawing(c);
}

const CRAFTS = [
  { en: "Pocket constellation", ar: "كوكبة للجيب", make: constellation },
  { en: "Paper bouquet", ar: "باقة ورقية", make: bouquet },
  { en: "Little windowsill", ar: "حديقة النافذة", make: garden },
  { en: "Woven keepsake", ar: "تذكار منسوج", make: weaving }
] as const;

const INTENT_NOTES: Record<GiftIntent, { en: string; ar: string }> = {
  walk: { en: "A little keepsake for your walk plan. It can wait here until you return.", ar: "تذكار صغير لخطة المشي. يبقى هنا حتى تعود." },
  errand: { en: "A little keepsake for your errand plan. There is a small place for it here.", ar: "تذكار صغير لخطة مشوارك. له مكان صغير هنا." },
  rest: { en: "A little keepsake for a rest or a pause. No hurry to come back.", ar: "تذكار صغير للراحة أو الاستراحة. لا داعي للاستعجال في العودة." }
};
const STAGE_NOTES: Record<Stage, { en: string; ar: string }> = {
  Spore: { en: "Small things feel just right at my spore size.", ar: "الأشياء الصغيرة تناسب حجمي وأنا بوغ صغير." },
  Sprout: { en: "A small sprout can still make a little surprise.", ar: "حتى البرعم الصغير يصنع مفاجأة صغيرة." },
  Truffle: { en: "Made with care, from one little mushroom to you.", ar: "صنعتها بعناية، من فطر صغير إليك." },
  Elder: { en: "An old mushroom still likes making small things.", ar: "حتى الفطر العجوز يحب صنع الأشياء الصغيرة." }
};

export function generateGift(job: GiftJob, pet: GiftPet, now_ms = job.due_ms, day = job.day): StoredGift {
  if (pet.dead || !STAGE_NOTES[pet.stage] || !INTENT_NOTES[job.intent] ||
      job.generator_version !== GIFT_GENERATOR_VERSION || !validSeed(job.seed) ||
      !validDay(job.day) || !validDay(day) || !validId(job.id) ||
      !Number.isSafeInteger(job.generation) || job.generation < 0 ||
      !Number.isSafeInteger(now_ms) || now_ms < 0)
    throw new Error("Invalid internal gift job");
  const random = seeded(`${job.generator_version}:${job.generation}:${job.day}:${job.seed}`);
  const craft = CRAFTS[random(CRAFTS.length)];
  const intent = INTENT_NOTES[job.intent], stage = STAGE_NOTES[pet.stage];
  return {
    id: job.id, generation: job.generation, day, created_ms: now_ms, art: craft.make(random),
    text: {
      en: { name: craft.en, note: `${intent.en} ${stage.en}` },
      ar: { name: craft.ar, note: `${intent.ar} ${stage.ar}` }
    },
    provenance: { art: "procedural", note: "authored", version: GIFT_GENERATOR_VERSION }
  };
}

function validSeed(seed: string): boolean { return typeof seed === "string" && /^[\x21-\x7e]{1,128}$/.test(seed); }
function validId(id: string): boolean { return typeof id === "string" && /^[a-zA-Z0-9._:-]{1,128}$/.test(id); }
function validDay(day: string): boolean { return typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day); }
function validText(text: string, max: number): boolean {
  return typeof text === "string" && text.trim().length > 0 && text.length <= max &&
    !/[\x00-\x1f\x7f<>\u202a-\u202e\u2066-\u2069]/.test(text);
}
/** Validate before a candidate is stored. Rendering must still use textContent. */
export function validGift(gift: StoredGift): boolean {
  if (!gift || !validId(gift.id) || !validDay(gift.day) ||
      !Number.isSafeInteger(gift.generation) || gift.generation < 0 ||
      !Number.isSafeInteger(gift.created_ms) || gift.created_ms < 0 ||
      typeof gift.art !== "string" || gift.art.length > 90 || !gift.art.trim() ||
      gift.provenance?.art !== "procedural" || gift.provenance?.note !== "authored" ||
      gift.provenance?.version !== GIFT_GENERATOR_VERSION) return false;
  const lines = gift.art.split("\n");
  if (lines.length > 7 || lines.some((line) => !/^[\x20-\x7e]{1,12}$/.test(line))) return false;
  return ["en", "ar"].every((lang) => {
    const text = gift.text?.[lang as "en" | "ar"];
    return text && validText(text.name, 64) && validText(text.note, 280);
  });
}
