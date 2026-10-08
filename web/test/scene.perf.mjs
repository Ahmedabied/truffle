// Run: node web/test/scene.perf.mjs
// Deterministic Node CPU work and actual glyph submission counts. This does not
// measure browser raster/GPU time or establish a Samsung frame-rate claim.
import { registerHooks, createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
const require = createRequire(import.meta.url);
const ts = require("typescript");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("baseline:")) return { url: specifier, shortCircuit: true };
    if (context.parentURL?.startsWith("baseline:") && specifier.startsWith("./")) return { url: `baseline:${specifier.slice(2)}.ts`, shortCircuit: true };
    if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !specifier.endsWith(".ts")) specifier += ".ts";
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith(".ts")) return next(url, context);
    const source = url.startsWith("baseline:")
      ? execFileSync("git", ["show", `HEAD:web/src/scene/${url.slice(9)}`], { encoding: "utf8" })
      : readFileSync(fileURLToPath(url), "utf8");
    return { format: "module", source: ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText, shortCircuit: true };
  }
});
const before = await import("baseline:world.ts");
const { Scene, EMPTY_VIEW, paintsFor, inksFor } = await import("../src/scene/world.ts");
const { Surface } = await import("../src/scene/surface.ts");
const noop = () => {};
const ctx = () => ({ clearRect: noop, drawImage: noop, fillText: noop, save: noop, restore: noop, beginPath: noop, rect: noop, clip: noop, measureText: () => ({ fontBoundingBoxAscent: 10, fontBoundingBoxDescent: 3 }) });
globalThis.document = { createElement: () => ({ style: {}, dataset: {}, setAttribute: noop, getContext: ctx }) };
globalThis.window = { devicePixelRatio: 2 };
globalThis.getComputedStyle = () => ({ fontFamily: "monospace" });
const root = { style: { fontSize: "6.666667px" }, clientWidth: 400, appendChild: noop };
const date = new Date("2026-10-08T08:00:00Z");
const base = { ...EMPTY_VIEW, stage: "Truffle", mood: "content", ageDays: 12 };
const cases = [
  { name: "sand-noon", hour: 12, view: base },
  { name: "grass-storm", hour: 15, view: { ...base, stage: "Elder", mood: "tired", country: "GB", rain: true, precipMm: 5, weatherCode: 95, windKmh: 40 } },
  { name: "grass-night", hour: 22, view: { ...base, mood: "asleep", country: "GB", weatherCode: 0, moonOverride: 0.5 } }
];
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const results = [];
for (const c of cases) {
  const scene = new Scene();
  const surface = new Surface(root);
  surface.fit();
  const run = (old, offset = 0) => {
    let calls = 0;
    let changes = 0;
    const start = performance.now();
    for (let i = 0; i < 300; i++) {
      const sec = (i + offset) / 60;
      const tick = Math.floor(sec * 12);
      const phase = sec * (c.view.windKmh / 20 + 0.15);
      if (old) before.composeAll(c.view, tick, phase, c.hour, date, false);
      else {
        const frame = scene.compose(c.view, tick, phase, c.hour, date, false, { sec });
        surface.inks(inksFor(frame.env, c.view.mood));
        surface.paint(paintsFor(frame));
        calls += surface.stats.glyphDraws;
        changes += surface.stats.changedCells;
      }
    }
    return { ms: (performance.now() - start) / 300, calls: calls / 300, changes: changes / 300 };
  };
  run(true); run(false);
  const baseline = [];
  const current = [];
  let work;
  for (let k = 0; k < 5; k++) {
    if (k % 2) { work = run(false, 300); current.push(work.ms); baseline.push(run(true, 300).ms); }
    else { baseline.push(run(true, 300).ms); work = run(false, 300); current.push(work.ms); }
  }
  results.push({ scene: c.name, baseline_compose_ms: +median(baseline).toFixed(3), current_compose_and_submission_js_ms: +median(current).toFixed(3), mean_glyph_draws: +work.calls.toFixed(1), mean_changed_cells: +work.changes.toFixed(1), static_builds: scene.builds.static });
}
console.log(JSON.stringify({ node: process.version, frames_per_batch: 300, batches: 5, baseline: "git HEAD composeAll", note: "Mock drawImage: CPU and call counts only. Browser/Samsung performance requires browser/device checks.", results }, null, 2));
