import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Date behaviour differs by host: a UTC runner and a Kampala laptop
    // disagree, and a test that passes locally then fails in CI is worse than
    // no test. Pinned to where the app is used.
    env: { TZ: "Africa/Kampala" },
    // Agent worktrees checked out under .claude/ carry their own copies of the
    // suite; scanning them from the parent runs foreign tests against the
    // wrong tree.
    exclude: ["**/node_modules/**", "**/.claude/worktrees/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
