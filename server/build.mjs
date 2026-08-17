import { fileURLToPath } from "node:url";
import path from "node:path";

import * as esbuild from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

// The handlers share lib/sync with the web app, which imports through the "@/"
// alias, so the bundle resolves it the same way the Next build does. Vercel
// does not support TypeScript path mappings, so bundling is what makes the
// shared code deployable there at all.
//
// Output lands in dist/ because Vercel checks the entrypoint exists before it
// installs or builds anything, so the entrypoint has to be a committed file.
// server.js and migrate.js are those files; they import what lands here.
const options = {
  entryPoints: [
    path.join(here, "src/server.ts"),
    path.join(here, "src/migrate.ts"),
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
