import { fileURLToPath } from "node:url";
import path from "node:path";

import * as esbuild from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

// The handlers share lib/sync with the web app, which imports through the "@/"
// alias, so the bundle resolves it the same way the Next build does.
const options = {
  entryPoints: [
    path.join(here, "src/index.ts"),
    path.join(here, "src/db/migrate.ts"),
  ],
  outdir: path.join(here, "dist"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  packages: "external",
  alias: { "@": repoRoot },
  banner: {
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
  },
};

if (process.argv.includes("--watch")) {
  const context = await esbuild.context(options);
  await context.watch();
  console.log("watching");
} else {
  await esbuild.build(options);
}
