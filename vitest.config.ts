import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
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
