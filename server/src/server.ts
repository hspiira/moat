import { createServer } from "node:http";

import { validateSyncPullRequest } from "@/lib/sync/hosted-store";
import {
  assertPrincipalOwns,
  isHostedBackendUsable,
  resolveSyncPrincipal,
  validateSyncPushRequest,
  type SyncPrincipal,
} from "@/lib/sync/server-contract";

import { getPool } from "./db/pool.js";
import { applyPostgresSyncPush, pullPostgresSyncChanges } from "./db/postgres-store.js";
import { HttpError, applyCors, readJsonBody, sendJson } from "./http.js";

const port = Number(process.env.PORT ?? 8787);

function requireCredentials() {
  if (!isHostedBackendUsable()) {
    throw new HttpError(
      503,
      "Sync server requires MOAT_SYNC_BEARER_TOKEN and MOAT_SYNC_BEARER_USER_ID to be set.",
    );
  }
}

function validate<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Invalid sync payload.");
  }
}

async function checkHealth(): Promise<[number, unknown]> {
  const problems: string[] = [];

  if (!process.env.MOAT_SYNC_BEARER_TOKEN?.trim()) {
    problems.push("MOAT_SYNC_BEARER_TOKEN is not set.");
  }

  if (!process.env.MOAT_SYNC_BEARER_USER_ID?.trim()) {
    problems.push("MOAT_SYNC_BEARER_USER_ID is not set, so tenancy would be self-asserted.");
  }

  try {
    await getPool().query("select 1");
  } catch (error) {
    problems.push(error instanceof Error ? error.message : "Database is unreachable.");
  }

  return problems.length > 0 ? [503, { status: "unhealthy", problems }] : [200, { status: "ok" }];
}

function authenticate(authorization: string | undefined): SyncPrincipal {
  try {
    return resolveSyncPrincipal(authorization ?? null);
  } catch (error) {
    throw new HttpError(401, error instanceof Error ? error.message : "Unauthorized.");
  }
}

function authorize(principal: SyncPrincipal, claimedUserId: string) {
  try {
    assertPrincipalOwns(principal, claimedUserId);
  } catch (error) {
    throw new HttpError(403, error instanceof Error ? error.message : "Forbidden.");
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

    requireCredentials();
    const principal = authenticate(request.headers.authorization);

    if (url.pathname === "/v1/sync/push") {
      const body = await readJsonBody(request);
      const syncRequest = validate(() => validateSyncPushRequest(body));
      authorize(principal, syncRequest.userId);
      sendJson(response, 200, await applyPostgresSyncPush(syncRequest));
      return;
    }

    if (url.pathname === "/v1/sync/pull") {
      const body = await readJsonBody(request);
      const syncRequest = validate(() => validateSyncPullRequest(body));
      authorize(principal, syncRequest.userId);
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
