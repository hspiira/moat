import { createServer } from "node:http";

import { validateSyncPullRequest } from "@/lib/sync/hosted-store";
import { validateSyncBearerToken, validateSyncPushRequest } from "@/lib/sync/server-contract";

import { getPool } from "./db/pool.js";
import { applyPostgresSyncPush, pullPostgresSyncChanges } from "./db/postgres-store.js";
import { HttpError, applyCors, readJsonBody, sendJson } from "./http.js";

const port = Number(process.env.PORT ?? 8787);

function requireBearerToken() {
  if (!process.env.MOAT_SYNC_BEARER_TOKEN?.trim()) {
    throw new HttpError(503, "Sync server requires MOAT_SYNC_BEARER_TOKEN to be set.");
  }
}

// The shared validators throw plain Errors. Turn those into 400s here so an
// unexpected fault elsewhere is still reported as a 500.
function validate<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Invalid sync payload.");
  }
}

// Says what is wrong rather than returning a bare 500, so a misconfigured
// deploy is obvious from the health check alone.
async function checkHealth(): Promise<[number, unknown]> {
  const problems: string[] = [];

  if (!process.env.MOAT_SYNC_BEARER_TOKEN?.trim()) {
    problems.push("MOAT_SYNC_BEARER_TOKEN is not set.");
  }

  try {
    await getPool().query("select 1");
  } catch (error) {
    problems.push(error instanceof Error ? error.message : "Database is unreachable.");
  }

  return problems.length > 0 ? [503, { status: "unhealthy", problems }] : [200, { status: "ok" }];
}

function authorize(authorization: string | undefined) {
  try {
    validateSyncBearerToken(authorization ?? null);
  } catch (error) {
    throw new HttpError(401, error instanceof Error ? error.message : "Unauthorized.");
  }
}

const server = createServer(async (request, response) => {
  try {
    if (applyCors(request, response)) {
      return;
    }

    const url = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, ...(await checkHealth()));
      return;
    }

    if (request.method !== "POST") {
      throw new HttpError(405, "Method not allowed.");
    }

    requireBearerToken();
    authorize(request.headers.authorization);

    if (url.pathname === "/v1/sync/push") {
      const body = await readJsonBody(request);
      const syncRequest = validate(() => validateSyncPushRequest(body));
      sendJson(response, 200, await applyPostgresSyncPush(syncRequest));
      return;
    }

    if (url.pathname === "/v1/sync/pull") {
      const body = await readJsonBody(request);
      const syncRequest = validate(() => validateSyncPullRequest(body));
      sendJson(response, 200, await pullPostgresSyncChanges(syncRequest));
      return;
    }

    throw new HttpError(404, "Not found.");
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(response, error.status, { error: error.message });
      return;
    }

    console.error("Sync request failed.", error);
    sendJson(response, 500, { error: "Sync request failed." });
  }
});

server.listen(port, () => {
  console.log(`moat sync server listening on ${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
