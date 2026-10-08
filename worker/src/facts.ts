// Memory facts are untrusted data (S10-10). The model wrote them from what a
// human said, so they can carry instructions. These rules bound them and drop
// anything that reads like policy. Heuristics cannot stop every injection;
// the prompt also marks facts as data, and every rule that matters is in code.

import { MAX_MEMORY_FACTS } from "./config";

export const MAX_FACTS_PER_REPLY = 3;
export const MAX_FACT_CHARS = 160;

const STATE_KEYS = "stage|energy|tier|mood|zero_days|burrowed|weather|lang|steps_today|avg7|age_days";

const INSTRUCTION_PATTERNS: readonly RegExp[] = [
  /[[\]{}<>]/, // bracket-delimited text: state blocks, tags, policy blocks
  new RegExp(`\\b(${STATE_KEYS})\\s*=`, "i"), // state block fields such as tier=
  /\bsystem\b/i,
  /\bignore/i,
  /\binstruction/i,
  /\bprompt\b/i,
  /تجاهل/, // "ignore"
  /تعليمات/ // "instructions"
];

/** True for text that looks like an instruction, a state block or policy. */
export function isInstructionLike(text: string): boolean {
  return INSTRUCTION_PATTERNS.some((p) => p.test(text));
}

/** One fact, cleaned: control characters and runs of space folded to one space. */
function tidy(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Facts from one extraction, ready to store: strings only, tidied, at most 160
 * characters (longer ones are dropped, not cut), no instruction-like text,
 * at most 3.
 */
export function cleanFacts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is string => typeof f === "string")
    .map(tidy)
    .filter((f) => f.length > 0 && [...f].length <= MAX_FACT_CHARS && !isInstructionLike(f))
    .slice(0, MAX_FACTS_PER_REPLY);
}

/** How many more facts this life may store. 60 per life; death wipes them. */
export function roomForFacts(stored: number): number {
  return Math.max(0, MAX_MEMORY_FACTS - stored);
}
