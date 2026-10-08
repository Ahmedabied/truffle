// Offline exploratory harness. It imports the real engine but never edits it.
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { build } = require("../../worker/node_modules/esbuild");
const scratch = await mkdtemp(join(tmpdir(), "truffle-energy-exploration-"));
try {
  const outfile = join(scratch, "simulation.mjs");
  await build({ entryPoints: [join(here, "simulation.ts")], outfile, bundle: true, platform: "node", format: "esm", logLevel: "silent" });
  const { run } = await import(pathToFileURL(outfile).href);
  run(here);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
