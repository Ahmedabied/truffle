import { defineConfig } from "vitest/config";

// Pure modules only (error parsing, cooldown, frame meter, source scans). Plain Node.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node"
  }
});
