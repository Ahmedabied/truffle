import { describe, expect, it } from "vitest";
import { credentialKey, normalizeApiOrigin, verifyImportedPet } from "../src/credentials";
import type { StateSummary } from "../src/types";

const base = "https://truffle.example.org";
describe("pet ownership boundaries", () => {
  it("keeps existing default-server pets and separates both server and demo identities", () => {
    expect(credentialKey(base + "/", base, false)).toBe("truffle.creds");
    expect(credentialKey(base, base, true)).toBe("truffle.demo");
    expect(credentialKey("https://other.example.org", base, false)).not.toBe("truffle.creds");
    expect(credentialKey("https://other.example.org", base, true)).not.toBe(credentialKey("https://other.example.org", base, false));
  });
  it.each(["http://example.org", "https://me:secret@example.org", "https://example.org/path", "https://example.org?x=1", "javascript:alert(1)"])("rejects unsafe or ambiguous API address %s", url => {
    expect(normalizeApiOrigin(url)).toBeNull();
  });
  it("allows loopback HTTP for local development only", () => {
    expect(normalizeApiOrigin("http://localhost:8787", true)).toBe("http://localhost:8787");
    expect(normalizeApiOrigin("http://localhost:8787")).toBeNull();
    expect(normalizeApiOrigin("http://localhost.attacker.test", true)).toBeNull();
  });
  it("refuses to adopt a demo as a real pet", async () => {
    await expect(verifyImportedPet({ phrase: "sand-moon-fig", secret: "a".repeat(22) }, async () => ({ demo: true } as StateSummary))).rejects.toThrow();
  });
  it("only returns successfully verified real pets", async () => {
    const summary = { demo: false } as StateSummary;
    expect(await verifyImportedPet({ phrase: "sand-moon-fig", secret: "a".repeat(22) }, async () => summary)).toBe(summary);
    await expect(verifyImportedPet({ phrase: "sand-moon-fig", secret: "a".repeat(22) }, async () => { throw new Error("unauthorized"); })).rejects.toThrow("unauthorized");
  });
});
