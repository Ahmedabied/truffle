import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    // The offline demo imports the real engine from ../worker/src (read only).
    fs: { allow: [".", "../worker/src"] }
  },
  build: { target: "es2020" }
});
