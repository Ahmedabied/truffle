import type { Creds, StateSummary } from "./types";

/** API settings accept origins, never credentials, paths, or insecure remote servers. */
export function normalizeApiOrigin(value: string, local = false): string | null {
  try {
    const u = new URL(value.trim());
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
    if (u.protocol !== "https:" && !(local && loopback && u.protocol === "http:")) return null;
    if (u.username || u.password || u.pathname !== "/" || u.search || u.hash) return null;
    return u.origin;
  } catch { return null; }
}

/** Legacy keys belong only to the default API. Another server gets its own pet. */
export function credentialKey(base: string, defaultBase: string, demo: boolean): string {
  const key = demo ? "truffle.demo" : "truffle.creds";
  const origin = new URL(base).origin;
  return origin === new URL(defaultBase).origin ? key : `${key}@${origin}`;
}

export async function verifyImportedPet(candidate: Creds, read: (c: Creds) => Promise<StateSummary>): Promise<StateSummary> {
  const s = await read(candidate);
  if (s.demo !== false) throw new Error("A demo pet cannot be imported as a real pet.");
  return s;
}
