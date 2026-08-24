import path from "node:path";
import { defineConfig } from "vitest/config";

// The server tests are excluded from the default run because they share one
// database and reset it, so their files must not run in parallel. This config
// is the serial half, called by test:server.
export default defineConfig({
  test: {
    environment: "node",
    env: { TZ: "Africa/Kampala" },
    include: ["server/**/*.test.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
