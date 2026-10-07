import { describe, expect, it } from "vitest";
import { WORDS } from "../src/words";
import {
  generatePhrase, generateSecret, hashPhrase, hashSecret, isPlausibleSecret, isValidPhrase, normalizePhrase, parsePhrase, safeEqual
} from "../src/pairing";

describe("wordlist", () => {
  it("has 2000 unique short lowercase words", () => {
    expect(WORDS).toHaveLength(2000);
    expect(new Set(WORDS).size).toBe(2000);
    for (const w of WORDS) expect(w).toMatch(/^[a-z]{3,10}$/);
  });
});

describe("phrases", () => {
  it("generates three valid words joined by dashes", () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePhrase();
      expect(p.split("-")).toHaveLength(3);
      expect(isValidPhrase(p)).toBe(true);
    }
  });
  it("normalizes case, spaces and dashes", () => {
    expect(normalizePhrase("  Sand Moon  FIG ")).toBe("sand-moon-fig");
    expect(normalizePhrase("sand--moon_fig")).toBe("sand-moon-fig");
    expect(parsePhrase("Sand Moon Fig")).toBe("sand-moon-fig");
  });
  it("rejects bad input", () => {
    for (const bad of ["", "sand-moon", "sand-moon-fig-oak", "sand-moon-xyzzy", "sand-moon-f1g", 42, null, undefined, {}, "a".repeat(200)]) {
      expect(isValidPhrase(bad)).toBe(false);
      expect(parsePhrase(bad)).toBeNull();
    }
  });
});

describe("hashes and secrets", () => {
  it("hashPhrase is stable SHA-256 hex", async () => {
    const a = await hashPhrase("sand-moon-fig");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashPhrase("sand-moon-fig")).toBe(a);
    expect(await hashPhrase("sand-moon-oak")).not.toBe(a);
  });
  it("secret is 16 random bytes in base64url", async () => {
    const s = generateSecret();
    expect(s).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(isPlausibleSecret(s)).toBe(true);
    expect(generateSecret()).not.toBe(s);
    expect(safeEqual(await hashSecret(s), await hashSecret(s))).toBe(true);
    expect(safeEqual(await hashSecret(s), await hashSecret(generateSecret()))).toBe(false);
    expect(isPlausibleSecret("short")).toBe(false);
    expect(isPlausibleSecret("has spaces in it here")).toBe(false);
  });
});
