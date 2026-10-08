// Pairing without accounts: a 3-word phrase names the Truffle, a random
// secret proves you own it. /feed needs only the phrase (worst case someone
// feeds your Truffle). /chat, /state, /spore and demo controls need the secret.

import { WORDS } from "./words";

const WORD_SET = new Set(WORDS);
const enc = new TextEncoder();

/** Uniform index in [0, n) with rejection sampling (no modulo bias). */
function randomIndex(n: number, c: Crypto): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    c.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

export function generatePhrase(c: Crypto = crypto): string {
  return [0, 1, 2].map(() => WORDS[randomIndex(WORDS.length, c)]).join("-");
}

/** Trim, lowercase, accept spaces, dashes, dots or underscores between words. */
export function normalizePhrase(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 100) return null;
  const parts = input.trim().toLowerCase().split(/[\s\-_.]+/).filter(Boolean);
  if (parts.length !== 3) return null;
  return parts.join("-");
}

export function isValidPhrase(input: unknown): boolean {
  const n = normalizePhrase(input);
  return n !== null && n.split("-").every((w) => WORD_SET.has(w));
}

/** Normalized phrase if valid, else null. */
export function parsePhrase(input: unknown): string | null {
  return isValidPhrase(input) ? normalizePhrase(input) : null;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** SHA-256 hex of the normalized phrase. The DO id is idFromName(hash). */
export async function hashPhrase(phrase: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode("truffle:" + phrase)));
}

/** 16 random bytes, base64url. Shown once at /pair. */
export function generateSecret(c: Crypto = crypto): string {
  return base64url(c.getRandomValues(new Uint8Array(16)));
}

export async function hashSecret(secret: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode("truffle-secret:" + secret)));
}

/** Constant-time compare of two equal-length hex strings. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isPlausibleSecret(s: unknown): s is string {
  return typeof s === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(s);
}

/**
 * The one answer for an unknown phrase, a wrong secret and a missing secret
 * (S10-01). Same status, same body, so a guess learns nothing.
 */
export const AUTH_FAILED = "That phrase and secret do not match a Truffle.";

/** Stands in for the stored hash when there is no Truffle, so both paths do the same work. */
const NO_TRUFFLE_HASH = "0".repeat(64);

/**
 * Owner check. Always hashes the secret and does one constant-time compare,
 * whether or not a Truffle exists, so an unknown phrase and a wrong secret
 * take the same time class.
 */
export async function ownerMatches(storedHash: string | undefined, secret: string): Promise<boolean> {
  const ok = safeEqual(await hashSecret(secret), storedHash ?? NO_TRUFFLE_HASH);
  return ok && storedHash !== undefined;
}
