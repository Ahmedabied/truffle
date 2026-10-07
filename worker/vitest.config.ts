import { defineConfig } from "vitest/config";

// Pure-engine tests run in plain Node. DO/route tests may add
// @cloudflare/vitest-pool-workers later in a second project entry.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node"
  }
});
