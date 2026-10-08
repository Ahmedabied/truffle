import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Facts, weather, chat text and gravestones come from people and the model.
// They must reach the page as text. No HTML sinks anywhere in the web app.
const SINKS = /\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write|createContextualFragment|DOMParser/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|html)$/.test(f) ? [p] : [];
  });
}

describe("no HTML sinks", () => {
  const root = join(__dirname, "..");
  const all = [...files(join(root, "src")), join(root, "index.html")];
  it("scans a real set of files", () => {
    expect(all.length).toBeGreaterThan(10);
  });
  for (const f of all) {
    it(f.slice(root.length + 1), () => {
      const hits = readFileSync(f, "utf8")
        .split("\n")
        .map((l, i) => [i + 1, l] as const)
        .filter(([, l]) => SINKS.test(l));
      expect(hits).toEqual([]);
    });
  }
});
