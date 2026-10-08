import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Tests run in plain Node. Durable Object tests import src/do.ts with
// "cloudflare:workers" swapped for a small stand-in and SQLite from node:sqlite
// (see test/helpers/do-harness.ts).
export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": resolve(__dirname, "test/helpers/cloudflare-workers.ts")
    }
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node"
  }
});
