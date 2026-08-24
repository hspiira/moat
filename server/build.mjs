import { fileURLToPath } from "node:url";
import path from "node:path";

import * as esbuild from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const options = {
  entryPoints: [
    path.join(here, "src/server.ts"),
    path.join(here, "src/migrate.ts"),
    path.join(here, "src/mint-token.ts"),
  ],
  // Beside package.json, because that is the file the scripts run and the file
  // the deployment uses as its entrypoint. Building anywhere else lets a stale
  // committed bundle ship instead.
  outdir: here,
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
