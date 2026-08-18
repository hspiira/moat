// Serves the static export for the end-to-end run. `next build` with
// output: "export" writes /month.html, but the app links to /month, so a plain
// file server 404s on every route.
//
//   node scripts/serve-static.mjs [dir] [port]

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "out");
const port = Number(process.argv[3] ?? 4321);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

async function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const withinRoot = path.normalize(path.join(root, decoded));
  if (!withinRoot.startsWith(root)) return null;

  for (const candidate of [withinRoot, `${withinRoot}.html`, path.join(withinRoot, "index.html")]) {
    const found = await stat(candidate).catch(() => null);
    if (found?.isFile()) return candidate;
  }
  return null;
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  const match = await resolveFile(pathname);
  const file = match ?? (await resolveFile("/404"));

  if (!file) {
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("Not found");
    return;
  }

  response.writeHead(match ? 200 : 404, {
    "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(response);
}).listen(port, () => {
  console.log(`serving ${root} on http://localhost:${port}`);
});
