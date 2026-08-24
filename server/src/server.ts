import { createServer, type IncomingMessage } from "node:http";

import { validateSyncPullRequest } from "@/lib/sync/hosted-store";
import {
  assertPrincipalOwns,
  validateSyncPushRequest,
  type SyncPrincipal,
} from "@/lib/sync/server-contract";

import { authenticateSyncRequest } from "./auth.js";
import { allowedRedirectUris, validateAuthCallbackRequest } from "./auth/callback-request.js";
import { exchangeGoogleCode } from "./auth/google.js";
import { mintSyncCredential } from "./db/credentials.js";
import { resolveIdentity } from "./db/identities.js";

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
// Signing in is rare and costs a round trip to the provider, so it is held
// tighter than syncing.
const perSignIn = createRateLimiter({ limit: 20, windowMs: MINUTE });

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

    // Sign-in comes before authentication, because it is how a caller gets a
    // token in the first place.
    if (url.pathname === "/v1/auth/callback") {
      const address = callerAddress(request);
      limit(perAddress, address, Date.now(), "Too many requests. Try again shortly.");
      limit(perSignIn, address, Date.now(), "Too many sign-in attempts. Try again shortly.");

      const body = await readJsonBody(request);
      const signIn = validate(() => validateAuthCallbackRequest(body, allowedRedirectUris()));

      let identity;
      try {
        identity = await exchangeGoogleCode({
          code: signIn.code,
          codeVerifier: signIn.codeVerifier,
          redirectUri: signIn.redirectUri,
          nonce: signIn.nonce,
        });
      } catch (error) {
        throw new HttpError(401, error instanceof Error ? error.message : "Sign-in failed.");
      }

      // A device already syncing on a hand-minted token proves the ledger is
      // its own by presenting that token alongside the sign-in.
      let proposedIsProven = false;
      if (signIn.proposedUserId && request.headers.authorization) {
        try {
          const existing = await authenticateSyncRequest(request.headers.authorization);
          proposedIsProven = existing.userId === signIn.proposedUserId;
        } catch {
          proposedIsProven = false;
        }
      }

      const resolved = await resolveIdentity({
        issuer: identity.issuer,
        subject: identity.subject,
        email: identity.email,
        proposedUserId: signIn.proposedUserId,
        proposedIsProven,
      });

      if (resolved.status === "already_linked_elsewhere") {
        throw new HttpError(409, "This account is already syncing another Moat ledger.");
      }
      if (resolved.status === "proposed_id_taken") {
        throw new HttpError(409, "That ledger already belongs to another account.");
      }

      sendJson(response, 200, {
        userId: resolved.userId,
        isNewUser: resolved.isNewUser,
        syncAuthToken: await mintSyncCredential(resolved.userId, "sign-in"),
      });
      return;
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
