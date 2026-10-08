// The phone app and the page hand a Truffle to each other (decision 0016).
// App to page: the app opens the page with #creds=<phrase>.<secret>. The page
// stores them and strips the fragment before anything else runs. A fragment
// never reaches a server.
// Page to app: on Android, outside the app, a link to truffle://pair?creds=...
// The custom scheme is handled by the app on the device and never reaches a server.

import type { Creds } from "./types";

export const APP_UA_MARK = "TruffleApp/";
export const RELEASES_URL = "https://github.com/ahmedabied/Truffle/releases";

// Three lowercase words with hyphens (worker/src/pairing.ts generatePhrase).
// The Worker checks the words against its list; a wrong phrase gets its calm 401.
const PHRASE = /^[a-z]{2,20}-[a-z]{2,20}-[a-z]{2,20}$/;
// The secret is base64url (worker/src/pairing.ts generateSecret: 16 bytes, 22 chars).
// Same accepted envelope as the Worker and Android. Offline pets cannot be moved.
const SECRET = /^[A-Za-z0-9_-]{16,64}$/;

/** Creds from a location.hash like "#creds=sand-moon-fig.AbC_d-123", or null. */
export function parseCredsHash(hash: string): Creds | null {
  const m = /^#?creds=([^&]*)$/.exec(hash);
  if (!m) return null;
  let body: string;
  try {
    body = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  const dot = body.indexOf(".");
  if (dot < 0) return null;
  const phrase = body.slice(0, dot).trim().toLowerCase();
  const secret = body.slice(dot + 1).trim();
  if (!PHRASE.test(phrase) || !SECRET.test(secret)) return null;
  return { phrase, secret };
}

/**
 * Read #creds= once, hand them to save, and strip the fragment from the URL
 * and from history. A fragment that looks like creds but is malformed is still
 * stripped, so a broken secret never sits in the address bar.
 */
export function takeCredsFromHash(
  loc: Pick<Location, "hash" | "pathname" | "search">,
  hist: Pick<History, "replaceState" | "state">,
  save: (c: Creds) => void
): Creds | null {
  if (!/^#?creds=/.test(loc.hash)) return null;
  const c = parseCredsHash(loc.hash);
  hist.replaceState(hist.state, "", loc.pathname + loc.search);
  if (c) save(c);
  return c;
}

export function inApp(ua: string): boolean {
  return ua.includes(APP_UA_MARK);
}

export function isAndroid(ua: string): boolean {
  return /\bAndroid\b/i.test(ua);
}

/** Show "open in the Truffle app": Android browser, a real Truffle, never inside the app. */
export function offerApp(ua: string, o: { demo: boolean; mock: boolean; paired: boolean }): boolean {
  return isAndroid(ua) && !inApp(ua) && !o.demo && !o.mock && o.paired;
}

export function appLink(c: Creds): string {
  return `truffle://pair?creds=${encodeURIComponent(c.phrase)}.${encodeURIComponent(c.secret)}`;
}
