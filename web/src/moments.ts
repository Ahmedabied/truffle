// Proud moments (decision 0017). The engine notices a real thing the person did
// and the summary carries the last 20, ascending id. The page remembers the last
// id it showed, per phrase, and shows each new one once. Pure helpers here so
// they are unit tested without a DOM. Types mirror decision 0017 until
// web/src/types.ts carries them (B12).

export type MomentKind =
  | "stage_up" // value: stage index 1..3
  | "best_day" // value: steps today
  | "beat_avg7" // value: steps today
  | "day_10k" // value: steps today
  | "streak" // value: days (3, 7, 14, 30)
  | "lifetime" // value: lifetime steps crossed (10,000 ... 500,000)
  | "heat_day_indoor"; // value: steps today

export interface Moment {
  id: number;
  kind: MomentKind;
  at_ms: number;
  value: number;
}

export const MOMENT_KINDS: readonly MomentKind[] = [
  "stage_up",
  "best_day",
  "beat_avg7",
  "day_10k",
  "streak",
  "lifetime",
  "heat_day_indoor"
];

/** How long one moment line stays under the HUD. */
export const MOMENT_SHOW_MS = 6000;
/** On the first visit for a phrase, only a moment this fresh is shown. Older ones go to the list quietly. */
export const FIRST_SIGHT_MS = 6 * 60 * 60 * 1000;
/** At most this many lines in one go (the newest), so a long absence is not a two minute queue. */
export const MAX_BURST = 3;
/** The list under the HUD shows this many. */
export const LIST_MAX = 5;

export function lastIdKey(phrase: string): string {
  return `truffle.moment.last.${phrase}`;
}

function isMoment(m: unknown): m is Moment {
  if (!m || typeof m !== "object") return false;
  const o = m as Record<string, unknown>;
  return (
    Number.isSafeInteger(o.id) &&
    typeof o.kind === "string" &&
    (MOMENT_KINDS as readonly string[]).includes(o.kind) &&
    typeof o.at_ms === "number" &&
    typeof o.value === "number" &&
    Number.isFinite(o.value)
  );
}

/** The moments of a summary, valid and known kinds only, ascending id. Missing field means none. */
export function momentsOf(summary: unknown): Moment[] {
  const raw = (summary as { moments?: unknown } | null)?.moments;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isMoment).sort((a, b) => a.id - b.id);
}

/**
 * Which moments to celebrate now, in order, and the id to remember.
 * lastId null means this browser has never seen this Truffle: show only the
 * newest moment if it is fresh, so a returning phone does not get a flood.
 * The same happens when the ids went backwards (a reset Truffle).
 */
export function pickNew(moments: Moment[], lastId: number | null, now: number): { show: Moment[]; lastId: number | null } {
  // Seen with no moments yet: everything from here on is new.
  if (moments.length === 0) return { show: [], lastId: lastId ?? 0 };
  const top = moments[moments.length - 1].id;
  // A counter below what we remember means the Truffle was replaced (reset, new pet): start over.
  if (lastId === null || top < lastId) {
    const newest = moments[moments.length - 1];
    return { show: now - newest.at_ms <= FIRST_SIGHT_MS ? [newest] : [], lastId: top };
  }
  const show = moments.filter((m) => m.id > lastId).slice(-MAX_BURST);
  return { show, lastId: Math.max(lastId, top) };
}

/** Newest first, at most LIST_MAX. */
export function recent(moments: Moment[]): Moment[] {
  return moments.slice(-LIST_MAX).reverse();
}
