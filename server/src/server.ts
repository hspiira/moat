import { createServer, type IncomingMessage } from "node:http";

import { validateSyncPullRequest } from "@/lib/sync/hosted-store";
import {
  assertPrincipalOwns,
  validateSyncPushRequest,
  type SyncPrincipal,
} from "@/lib/sync/server-contract";

import { authenticateSyncRequest } from "./auth.js";

import { getPool } from "./db/pool.js";
import { applyPostgresSyncPush, pullPostgresSyncChanges } from "./db/postgres-store.js";
import { HttpError, applyCors, readJsonBody, sendJson } from "./http.js";
import { createRateLimiter } from "./rate-limit.js";

const port = Number(process.env.PORT ?? 8787);

// A full sync is a handful of requests at a page size of 500, so these are far
// above ordinary use and only bite on a caller hammering the endpoint. Failed
// authentication is held much tighter, because that is someone guessing tokens.
const MINUTE = 60_000;
const perAddress = createRateLimiter({ limit: 600, windowMs: MINUTE });
const perUser = createRateLimiter({ limit: 300, windowMs: MINUTE });
const perFailedAuth = createRateLimiter({ limit: 10, windowMs: MINUTE });

function callerAddress(request: IncomingMessage): string {
  // Behind a proxy the socket is the proxy, so the forwarded address is used
  // when one is present. It is only a rate-limit key, never an identity.
  const forwarded = request.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return (first ?? request.socket.remoteAddress ?? "unknown").trim();
}

function limit(
  limiter: ReturnType<typeof createRateLimiter>,
  key: string,
  now: number,
  message: string,
) {
  const verdict = limiter.check(key, now);
  if (!verdict.allowed) {
    throw new HttpError(429, message, {
      "retry-after": String(verdict.retryAfterSeconds),
    });
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

  try {
    await getPool().query("select 1");
    const credentials = await getPool().query<{ count: string }>(
      "select count(*)::text as count from sync_credentials",
    );
    if (credentials.rows[0]?.count === "0") {
      problems.push("No sync credentials exist yet. Mint one with `pnpm --filter @moat/sync-server mint`.");
    }
  } catch (error) {
    problems.push(error instanceof Error ? error.message : "Database is unreachable.");
  }

  return problems.length > 0 ? [503, { status: "unhealthy", problems }] : [200, { status: "ok" }];
}

async function authenticate(authorization: string | undefined): Promise<SyncPrincipal> {
  try {
    return await authenticateSyncRequest(authorization);
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

    const address = callerAddress(request);
    const now = Date.now();
    limit(perAddress, address, now, "Too many requests. Try again shortly.");

    let principal: SyncPrincipal;
    try {
      principal = await authenticate(request.headers.authorization);
    } catch (error) {
      limit(perFailedAuth, address, now, "Too many failed sign-ins. Try again shortly.");
      throw error;
    }

    limit(perUser, principal.userId, now, "Too many requests for this account. Try again shortly.");

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
      sendJson(response, error.status, { error: error.message }, error.headers);
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
