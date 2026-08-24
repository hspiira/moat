import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: { TZ: "Africa/Kampala" },
    // The server tests share one database and reset it, so running their files
    // in parallel makes them fight over the schema. They run serially through
    // test:server instead, which verify calls after this.
    exclude: ["**/node_modules/**", "**/.claude/worktrees/**", "e2e/**", "server/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
