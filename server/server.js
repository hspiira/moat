import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);

// src/server.ts
import { createServer } from "node:http";

// ../lib/sync/cursor.ts
var DEFAULT_PULL_PAGE_SIZE = 500;
var MAX_PULL_PAGE_SIZE = 2e3;
var CURSOR_SEPARATOR = "|";
function toEntityKey(entityType, entityId) {
  return `${entityType}:${entityId}`;
}
function serializeCursor(cursor) {
  return `${cursor.updatedAt}${CURSOR_SEPARATOR}${cursor.entityKey}`;
}
function parseCursor(since) {
  if (!since?.trim()) {
    return null;
  }
  const separatorIndex = since.indexOf(CURSOR_SEPARATOR);
  if (separatorIndex === -1) {
    return { updatedAt: since, entityKey: "" };
  }
  return {
    updatedAt: since.slice(0, separatorIndex),
    entityKey: since.slice(separatorIndex + CURSOR_SEPARATOR.length)
  };
}
function resolvePageSize(limit2) {
  if (typeof limit2 !== "number" || !Number.isFinite(limit2)) {
    return DEFAULT_PULL_PAGE_SIZE;
  }
  return Math.min(MAX_PULL_PAGE_SIZE, Math.max(1, Math.floor(limit2)));
}

// ../lib/sync/entity-sync.ts
var noop = async () => {
};
async function listSingleton(read) {
  const record = await read;
  return record ? [record] : [];
}
var entityDefinitions = {
  userProfiles: {
    strategy: "client_wins",
    upsert: (repositories, payload) => repositories.userProfile.save(payload),
    remove: noop,
    list: async (repositories, userId) => {
      const profile = await repositories.userProfile.get();
      return profile && profile.id === userId ? [profile] : [];
    }
  },
  accounts: {
    strategy: "manual_review",
    upsert: (repositories, payload) => repositories.accounts.upsert(payload),
    remove: (repositories, entityId) => repositories.accounts.remove(entityId),
    list: (repositories, userId) => repositories.accounts.listByUser(userId)
  },
  transactions: {
    strategy: "manual_review",
    upsert: (repositories, payload) => repositories.transactions.upsert(payload),
    remove: (repositories, entityId) => repositories.transactions.remove(entityId),
    list: (repositories, userId) => repositories.transactions.listByUser(userId)
  },
  transactionRules: {
    strategy: "client_wins",
    upsert: (repositories, payload) => repositories.transactionRules.upsert(payload),
    remove: (repositories, entityId) => repositories.transactionRules.remove(entityId),
    list: (repositories, userId) => repositories.transactionRules.listByUser(userId)
  },
  recurringObligations: {
    strategy: "manual_review",
    upsert: (repositories, payload) => repositories.recurringObligations.upsert(payload),
    remove: (repositories, entityId) => repositories.recurringObligations.remove(entityId),
    list: (repositories, userId) => repositories.recurringObligations.listByUser(userId)
  },
  monthCloses: {
    strategy: "server_wins",
    upsert: (repositories, payload) => repositories.monthCloses.upsert(payload),
    remove: (repositories, entityId) => repositories.monthCloses.remove(entityId),
    list: (repositories, userId) => repositories.monthCloses.listByUser(userId)
  },
  categories: {
    strategy: "client_wins",
    upsert: (repositories, payload) => repositories.categories.upsert(payload),
    remove: (repositories, entityId) => repositories.categories.remove(entityId),
    list: (repositories, userId) => repositories.categories.listByUser(userId)
  },
  counterparties: {
    strategy: "client_wins",
    upsert: (repositories, payload) => repositories.counterparties.upsert(payload),
    remove: (repositories, entityId) => repositories.counterparties.remove(entityId),
    list: (repositories, userId) => repositories.counterparties.listByUser(userId)
  },
  goals: {
    strategy: "manual_review",
    upsert: (repositories, payload) => repositories.goals.upsert(payload),
    remove: (repositories, entityId) => repositories.goals.remove(entityId),
    list: (repositories, userId) => repositories.goals.listByUser(userId)
  },
  budgets: {
    strategy: "manual_review",
    upsert: (repositories, payload) => repositories.budgets.upsert(payload),
    remove: (repositories, entityId) => repositories.budgets.remove(entityId),
    list: (repositories, userId) => repositories.budgets.listByUser(userId)
  },
  investmentProfiles: {
    strategy: "client_wins",
    upsert: (repositories, payload) => repositories.investmentProfiles.save(payload),
    remove: noop,
    list: (repositories, userId) => listSingleton(repositories.investmentProfiles.getByUser(userId))
  },
  items: {
    strategy: "manual_review",
    upsert: (repositories, payload) => repositories.items.upsert(payload),
    remove: (repositories, entityId) => repositories.items.remove(entityId),
    list: (repositories, userId) => repositories.items.listByUser(userId)
  },
  projects: {
    strategy: "client_wins",
    upsert: (repositories, payload) => repositories.projects.upsert(payload),
    remove: (repositories, entityId) => repositories.projects.remove(entityId),
    list: (repositories, userId) => repositories.projects.listByUser(userId)
  },
  plannedPurchases: {
    strategy: "manual_review",
    upsert: (repositories, payload) => repositories.plannedPurchases.upsert(payload),
    remove: (repositories, entityId) => repositories.plannedPurchases.remove(entityId),
    list: (repositories, userId) => repositories.plannedPurchases.listByUser(userId)
  },
  transactionLineItems: {
    strategy: "manual_review",
    upsert: (repositories, payload) => repositories.transactionLineItems.upsert(payload),
    remove: (repositories, entityId) => repositories.transactionLineItems.remove(entityId),
    list: (repositories, userId) => repositories.transactionLineItems.listByUser(userId)
  }
};
var syncableEntityTypes = Object.keys(entityDefinitions);
function getConflictStrategy(entityType) {
  return entityDefinitions[entityType]?.strategy ?? "manual_review";
}
function isSyncableEntityType(entityType) {
  return entityType in entityDefinitions;
}

// ../lib/sync/hosted-store.ts
function validateSyncPullRequest(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Sync pull payload must be an object.");
  }
  const request = input;
  if (typeof request.userId !== "string" || !request.userId.trim()) {
    throw new Error("Sync pull requires a userId.");
  }
  if (request.since !== void 0 && typeof request.since !== "string") {
    throw new Error("Sync pull since token must be a string when provided.");
  }
  if (request.limit !== void 0 && (typeof request.limit !== "number" || !Number.isFinite(request.limit))) {
    throw new Error("Sync pull limit must be a finite number when provided.");
  }
  return {
    userId: request.userId,
    since: request.since,
    limit: request.limit
  };
}

// ../lib/sync/server-contract.ts
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function validateSyncPushRequest(input) {
  if (!isRecord(input)) {
    throw new Error("Sync payload must be an object.");
  }
  const userId = input.userId;
  const device = input.device;
  const items = input.items;
  if (typeof userId !== "string" || !userId.trim()) {
    throw new Error("Sync payload requires a userId.");
  }
  if (!isRecord(device) || typeof device.app !== "string" || typeof device.platform !== "string") {
    throw new Error("Sync payload requires valid device metadata.");
  }
  if (!Array.isArray(items)) {
    throw new Error("Sync payload requires an items array.");
  }
  const normalizedItems = items.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Each sync item must be an object.");
    }
    const outboxId = item.outboxId;
    const entityType = item.entityType;
    const entityId = item.entityId;
    const operation = item.operation;
    const payload = item.payload;
    const queuedAt = item.queuedAt;
    const baseVersionToken = item.baseVersionToken;
    if (typeof outboxId !== "string" || typeof entityType !== "string" || typeof entityId !== "string" || operation !== "upsert" && operation !== "remove" || typeof payload !== "string" || typeof queuedAt !== "string") {
      throw new Error("Sync item is missing required fields.");
    }
    if (baseVersionToken !== void 0 && typeof baseVersionToken !== "string") {
      throw new Error("Sync item baseVersionToken must be a string when provided.");
    }
    return {
      outboxId,
      entityType,
      entityId,
      operation,
      payload,
      queuedAt,
      baseVersionToken
    };
  });
  return {
    userId,
    device: {
      app: "moat",
      platform: device.platform,
      id: typeof device.id === "string" ? device.id : void 0
    },
    items: normalizedItems
  };
}
var COMPARISON_FLOOR = 64;
function constantTimeEquals(left, right) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const width = Math.max(a.length, b.length, COMPARISON_FLOOR);
  let difference = a.length ^ b.length;
  for (let index = 0; index < width; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}
function bearerTokenFrom(headerValue) {
  const value = headerValue?.trim();
  if (!value?.startsWith("Bearer ")) {
    throw new Error("Hosted sync requires a bearer token.");
  }
  return value.slice("Bearer ".length).trim();
}
function assertPrincipalOwns(principal, claimedUserId) {
  if (!constantTimeEquals(principal.userId, claimedUserId)) {
    throw new Error("This token cannot read or write another user's records.");
  }
}

// src/db/credentials.ts
import { createHash, randomBytes } from "node:crypto";

// src/db/pool.ts
import pg from "pg";
var pool = null;
function getPool() {
  if (pool) {
    return pool;
  }
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }
  pool = new pg.Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    ssl: resolveSsl()
  });
  return pool;
}
function resolveSsl() {
  switch (process.env.DATABASE_SSL) {
    case "disable":
      return void 0;
    case "no-verify":
      return { rejectUnauthorized: false };
    default:
      return { rejectUnauthorized: true };
  }
}
async function closePool() {
  await pool?.end();
  pool = null;
}
async function withTransaction(run) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {
    });
    throw error;
  } finally {
    client.release();
  }
}
async function withUserTransaction(userId, run) {
  return withTransaction(async (client) => {
    await client.query("select set_config('moat.user_id', $1, true)", [userId]);
    return run(client);
  });
}

// src/db/credentials.ts
function hashSyncToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
function generateSyncToken() {
  return randomBytes(32).toString("hex");
}
async function mintSyncCredential(userId, label) {
  const token = generateSyncToken();
  await withTransaction(async (client) => {
    await client.query(
      `insert into sync_users (user_id, created_at)
       values ($1, moat_now_iso())
       on conflict (user_id) do nothing`,
      [userId]
    );
    await client.query(
      `insert into sync_credentials (token_sha256, user_id, label, created_at)
       values ($1, $2, $3, moat_now_iso())`,
      [hashSyncToken(token), userId, label ?? null]
    );
  });
  return token;
}
async function resolveSyncCredential(token) {
  const result = await getPool().query(
    `with found as (
       select token_sha256, user_id, last_used_at
         from sync_credentials
        where token_sha256 = $1
     ),
     stamped as (
       update sync_credentials c
          set last_used_at = moat_now_iso()
         from found
        where c.token_sha256 = found.token_sha256
          and (found.last_used_at is null
               or found.last_used_at < moat_now_iso(now() - interval '5 minutes'))
     )
     select user_id from found`,
    [hashSyncToken(token)]
  );
  return result.rows[0]?.user_id ?? null;
}

// src/auth.ts
async function authenticateSyncRequest(authorization) {
  const token = bearerTokenFrom(authorization ?? null);
  const userId = await resolveSyncCredential(token);
  if (!userId) {
    throw new Error("Hosted sync bearer token is not recognised.");
  }
  return { userId };
}

// src/caller-address.ts
function trustedProxyCount(env = process.env) {
  return Math.max(0, Math.trunc(Number(env.MOAT_SYNC_TRUSTED_PROXIES ?? 0)) || 0);
}
function callerAddress(request, trustedProxies2) {
  const socketAddress = (request.socket.remoteAddress ?? "unknown").trim();
  if (trustedProxies2 === 0) {
    return socketAddress;
  }
  const forwarded = request.headers["x-forwarded-for"];
  const hops = (Array.isArray(forwarded) ? forwarded.join(",") : forwarded ?? "").split(",").map((hop) => hop.trim()).filter(Boolean);
  return hops[hops.length - trustedProxies2] ?? socketAddress;
}

// src/auth/google-clients.ts
function readGoogleClient(kind, env = process.env) {
  if (kind === "ios") {
    const clientId2 = env.MOAT_OIDC_GOOGLE_IOS_CLIENT_ID?.trim();
    if (!clientId2) {
      throw new Error("MOAT_OIDC_GOOGLE_IOS_CLIENT_ID is not set, so the app cannot sign in.");
    }
    if (clientId2 === env.MOAT_OIDC_GOOGLE_CLIENT_ID?.trim()) {
      throw new Error(
        "MOAT_OIDC_GOOGLE_IOS_CLIENT_ID is the web client id. The app needs its own iOS client."
      );
    }
    return { kind, clientId: clientId2 };
  }
  const clientId = env.MOAT_OIDC_GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.MOAT_OIDC_GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId) throw new Error("MOAT_OIDC_GOOGLE_CLIENT_ID is not set.");
  if (!clientSecret) throw new Error("MOAT_OIDC_GOOGLE_CLIENT_SECRET is not set.");
  return { kind, clientId, clientSecret };
}
function iosRedirectScheme(clientId) {
  const withoutSuffix = clientId.replace(/\.apps\.googleusercontent\.com$/, "");
  return `com.googleusercontent.apps.${withoutSuffix}`;
}
function isIosRedirect(redirectUri, clientId) {
  return redirectUri.startsWith(`${iosRedirectScheme(clientId)}:/`);
}

// src/auth/callback-request.ts
function readString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Sign-in request is missing ${field}.`);
  }
  return value.trim();
}
function allowedRedirectUris() {
  return (process.env.MOAT_OIDC_REDIRECT_URIS ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
}
function validateAuthCallbackRequest(body, allowed, iosClientId) {
  if (typeof body !== "object" || body === null) {
    throw new Error("Sign-in request must be an object.");
  }
  const input = body;
  if (input.provider !== "google") {
    throw new Error("That sign-in provider is not supported.");
  }
  if (input.client !== void 0 && input.client !== "web" && input.client !== "ios") {
    throw new Error("That sign-in client is not supported.");
  }
  const client = input.client === "ios" ? "ios" : "web";
  const redirectUri = readString(input.redirectUri, "redirectUri");
  const permitted = client === "ios" ? Boolean(iosClientId) && isIosRedirect(redirectUri, iosClientId) : allowed.includes(redirectUri);
  if (!permitted) {
    throw new Error("That redirect address is not allowed for this deployment.");
  }
  const proposedUserId = typeof input.proposedUserId === "string" && input.proposedUserId.trim() ? input.proposedUserId.trim() : void 0;
  return {
    provider: "google",
    client,
    code: readString(input.code, "code"),
    codeVerifier: readString(input.codeVerifier, "codeVerifier"),
    redirectUri,
    nonce: readString(input.nonce, "nonce"),
    proposedUserId
  };
}

// src/auth/google.ts
import { createRemoteJWKSet, jwtVerify } from "jose";

// src/auth/id-token-claims.ts
function readIdTokenClaims(params) {
  const { claims } = params;
  const issuer = typeof claims.iss === "string" ? claims.iss : "";
  if (!params.expectedIssuers.includes(issuer)) {
    throw new Error("The sign-in token was not issued by a provider this server trusts.");
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud.filter((entry) => typeof entry === "string") : typeof claims.aud === "string" ? [claims.aud] : [];
  if (!audiences.includes(params.expectedAudience)) {
    throw new Error("The sign-in token was issued for a different application.");
  }
  const expiry = typeof claims.exp === "number" ? claims.exp : 0;
  if (expiry * 1e3 <= params.now) {
    throw new Error("The sign-in token has expired.");
  }
  if (typeof claims.nonce !== "string" || claims.nonce !== params.expectedNonce) {
    throw new Error("The sign-in token does not match this sign-in attempt.");
  }
  const subject = typeof claims.sub === "string" ? claims.sub.trim() : "";
  if (!subject) {
    throw new Error("The sign-in token names no account.");
  }
  const email = claims.email_verified === true && typeof claims.email === "string" ? claims.email : void 0;
  return { issuer, subject, email };
}

// src/auth/google.ts
var GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
var GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");
var GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
var googleKeys = createRemoteJWKSet(GOOGLE_JWKS_URL);
async function exchangeGoogleCode(params) {
  const client = readGoogleClient(params.client);
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    code_verifier: params.codeVerifier,
    redirect_uri: params.redirectUri,
    client_id: client.clientId
  });
  if (client.clientSecret) {
    form.set("client_secret", client.clientSecret);
  }
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form
  });
  if (!response.ok) {
    throw new Error("Google would not exchange this sign-in code.");
  }
  const body = await response.json();
  if (typeof body.id_token !== "string") {
    throw new Error("Google returned no identity token.");
  }
  const { payload } = await jwtVerify(body.id_token, googleKeys, {
    issuer: GOOGLE_ISSUERS,
    audience: client.clientId
  });
  return readIdTokenClaims({
    claims: payload,
    expectedIssuers: GOOGLE_ISSUERS,
    expectedAudience: client.clientId,
    expectedNonce: params.nonce,
    now: Date.now()
  });
}

// src/db/identities.ts
import { randomUUID } from "node:crypto";

// src/auth/identity-link.ts
function decideIdentityLink(params) {
  const proposed = params.proposedUserId?.trim() || null;
  const { linkedUserId, proposedIsClaimed } = params.state;
  if (linkedUserId) {
    if (!proposed || proposed === linkedUserId) {
      return { outcome: "sign_in", userId: linkedUserId };
    }
    return { outcome: "already_linked_elsewhere" };
  }
  if (!proposed) {
    return { outcome: "sign_up" };
  }
  if (proposedIsClaimed && !params.state.proposedIsProven) {
    return { outcome: "proposed_id_taken" };
  }
  return { outcome: "link", userId: proposed };
}

// src/db/identities.ts
async function readState(client, params) {
  const linked = await client.query(
    "select user_id from sync_identities where issuer = $1 and subject = $2",
    [params.issuer, params.subject]
  );
  let proposedIsClaimed = false;
  if (params.proposedUserId) {
    const claimed = await client.query(
      `select exists (select 1 from sync_identities where user_id = $1)
           or exists (select 1 from sync_records where user_id = $1) as claimed`,
      [params.proposedUserId]
    );
    proposedIsClaimed = claimed.rows[0]?.claimed === true;
  }
  return {
    linkedUserId: linked.rows[0]?.user_id ?? null,
    proposedIsClaimed,
    proposedIsProven: params.proposedIsProven
  };
}
async function resolveIdentity(params) {
  const proposedUserId = params.proposedUserId?.trim() || null;
  return withUserTransaction(proposedUserId ?? "", async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      `${params.issuer}
${params.subject}`
    ]);
    const state = await readState(client, {
      issuer: params.issuer,
      subject: params.subject,
      proposedUserId,
      proposedIsProven: params.proposedIsProven === true
    });
    const decision = decideIdentityLink({ proposedUserId, state });
    if (decision.outcome === "already_linked_elsewhere") {
      return { status: "already_linked_elsewhere" };
    }
    if (decision.outcome === "proposed_id_taken") {
      return { status: "proposed_id_taken" };
    }
    if (decision.outcome === "sign_in") {
      return { status: "ok", userId: decision.userId, isNewUser: false };
    }
    const userId = decision.outcome === "link" ? decision.userId : `user:${randomUUID()}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await client.query(
      "insert into sync_users (user_id, created_at) values ($1, $2) on conflict (user_id) do nothing",
      [userId, now]
    );
    await client.query(
      `insert into sync_identities (issuer, subject, user_id, email, created_at)
       values ($1, $2, $3, $4, $5)
       on conflict (issuer, subject) do nothing`,
      [params.issuer, params.subject, userId, params.email ?? null, now]
    );
    return {
      status: "ok",
      userId,
      isNewUser: decision.outcome === "sign_up"
    };
  });
}

// src/db/postgres-store.ts
import { randomUUID as randomUUID2 } from "node:crypto";
function toPullRecord(row) {
  return {
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: row.payload,
    deleted: row.deleted,
    updatedAt: row.updated_at,
    serverVersionToken: row.server_version_token
  };
}
function createServerVersionToken() {
  return `sv:${randomUUID2()}`;
}
async function ensureUser(client, userId) {
  await client.query(
    `insert into sync_users (user_id, created_at)
     values ($1, moat_now_iso())
     on conflict (user_id) do nothing`,
    [userId]
  );
}
async function writeRecord(client, params) {
  const result = await client.query(
    `insert into sync_records (
       user_id, entity_type, entity_id, payload, deleted,
       updated_at, server_version_token, last_outbox_id, last_device_id
     )
     values ($1, $2, $3, $4, $5, moat_now_iso(), $6, $7, $8)
     on conflict (user_id, entity_type, entity_id) do update set
       payload = excluded.payload,
       deleted = excluded.deleted,
       updated_at = excluded.updated_at,
       server_version_token = excluded.server_version_token,
       last_outbox_id = excluded.last_outbox_id,
       last_device_id = excluded.last_device_id
     returning entity_type, entity_id, payload, deleted, updated_at, server_version_token`,
    [
      params.userId,
      params.entityType,
      params.entityId,
      params.payload,
      params.deleted,
      createServerVersionToken(),
      params.outboxId,
      params.deviceId ?? null
    ]
  );
  return result.rows[0];
}
async function markOutboxApplied(client, userId, outboxId) {
  await client.query(
    `insert into sync_applied_outbox (user_id, outbox_id, applied_at)
     values ($1, $2, moat_now_iso())
     on conflict (user_id, outbox_id) do nothing`,
    [userId, outboxId]
  );
}
function isBasedOnCurrent(params) {
  if (params.baseVersionToken) {
    return params.baseVersionToken === params.existing.server_version_token;
  }
  return params.existing.deleted === params.deleted && params.existing.payload === params.payload;
}
async function applyPostgresSyncPush(request) {
  const items = [...request.items].sort(
    (left, right) => toEntityKey(left.entityType, left.entityId) < toEntityKey(right.entityType, right.entityId) ? -1 : 1
  );
  const results = await withUserTransaction(request.userId, async (client) => {
    await ensureUser(client, request.userId);
    const collected = [];
    for (const item of items) {
      collected.push(await applyOne(client, request, item));
    }
    return collected;
  });
  const byOutboxId = new Map(results.map((result) => [result.outboxId, result]));
  return {
    syncedAt: (/* @__PURE__ */ new Date()).toISOString(),
    results: request.items.map(
      (item) => byOutboxId.get(item.outboxId) ?? {
        outboxId: item.outboxId,
        status: "failed",
        error: "Sync item was not processed."
      }
    )
  };
}
async function applyOne(client, request, item) {
  if (!isSyncableEntityType(item.entityType)) {
    return {
      outboxId: item.outboxId,
      status: "failed",
      error: `Unsupported sync entity type: ${item.entityType}`
    };
  }
  const strategy = getConflictStrategy(item.entityType);
  const deleted = item.operation === "remove";
  const payload = deleted ? null : item.payload;
  const locked = await client.query(
    `select entity_type, entity_id, payload, deleted, updated_at, server_version_token
       from sync_records
      where user_id = $1 and entity_type = $2 and entity_id = $3
      for update`,
    [request.userId, item.entityType, item.entityId]
  );
  const existing = locked.rows[0];
  const replayed = await client.query(
    `select 1 from sync_applied_outbox where user_id = $1 and outbox_id = $2`,
    [request.userId, item.outboxId]
  );
  if ((replayed.rowCount ?? 0) > 0) {
    return {
      outboxId: item.outboxId,
      status: "synced",
      strategy,
      serverVersionToken: existing?.server_version_token,
      serverRecord: existing ? toPullRecord(existing) : void 0
    };
  }
  const accept = async () => {
    const written = await writeRecord(client, {
      userId: request.userId,
      entityType: item.entityType,
      entityId: item.entityId,
      payload,
      deleted,
      outboxId: item.outboxId,
      deviceId: request.device.id
    });
    await markOutboxApplied(client, request.userId, item.outboxId);
    return {
      outboxId: item.outboxId,
      status: "synced",
      strategy,
      serverVersionToken: written.server_version_token,
      serverRecord: toPullRecord(written)
    };
  };
  if (!existing) {
    return accept();
  }
  if (isBasedOnCurrent({ baseVersionToken: item.baseVersionToken, existing, payload, deleted })) {
    return accept();
  }
  if (strategy === "client_wins") {
    return accept();
  }
  if (strategy === "server_wins") {
    await markOutboxApplied(client, request.userId, item.outboxId);
    return {
      outboxId: item.outboxId,
      status: "synced",
      strategy,
      serverVersionToken: existing.server_version_token,
      serverRecord: toPullRecord(existing)
    };
  }
  return {
    outboxId: item.outboxId,
    status: "conflict",
    strategy,
    error: "Manual review required before this ledger-affecting record can be synced.",
    serverVersionToken: existing.server_version_token,
    serverRecord: toPullRecord(existing)
  };
}
async function pullPostgresSyncChanges(request) {
  const cursor = parseCursor(request.since);
  const pageSize = resolvePageSize(request.limit);
  const rows = await withUserTransaction(request.userId, async (client) => {
    const result = await client.query(
      `select entity_type, entity_id, payload, deleted, updated_at, server_version_token
         from sync_records
        where user_id = $1
          and ($2::text is null or (updated_at, entity_key) > ($2::text, $3::text))
        order by updated_at, entity_key
        limit $4`,
      [request.userId, cursor?.updatedAt ?? null, cursor?.entityKey ?? "", pageSize + 1]
    );
    return result.rows;
  });
  const page = rows.slice(0, pageSize);
  const last = page.at(-1);
  return {
    syncedAt: (/* @__PURE__ */ new Date()).toISOString(),
    records: page.map(toPullRecord),
    nextSince: last ? serializeCursor({
      updatedAt: last.updated_at,
      entityKey: toEntityKey(last.entity_type, last.entity_id)
    }) : request.since,
    hasMore: rows.length > pageSize
  };
}

// src/http.ts
var MAX_BODY_BYTES = 8 * 1024 * 1024;
var HttpError = class extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
  status;
  headers;
};
async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(413, "Sync payload is too large.");
    }
    chunks.push(chunk);
  }
  if (size === 0) {
    throw new HttpError(400, "Request body is empty.");
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body is not valid JSON.");
  }
}
function sendJson(response, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    ...headers
  });
  response.end(payload);
}
function allowedOrigins() {
  return (process.env.MOAT_SYNC_ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
}
function applyCors(request, response) {
  const origin = request.headers.origin;
  const allowed = allowedOrigins();
  if (origin && allowed.includes(origin)) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "origin");
    response.setHeader("access-control-allow-headers", "content-type, authorization");
    response.setHeader("access-control-allow-methods", "POST, GET, OPTIONS");
    response.setHeader("access-control-max-age", "86400");
  }
  if (request.method === "OPTIONS") {
    response.writeHead(origin && allowed.includes(origin) ? 204 : 403);
    response.end();
    return true;
  }
  return false;
}

// src/rate-limit.ts
var DEFAULT_MAX_KEYS = 1e4;
function createRateLimiter(rule) {
  const windows = /* @__PURE__ */ new Map();
  const maxKeys = rule.maxKeys ?? DEFAULT_MAX_KEYS;
  let nextSweepAt = Number.NEGATIVE_INFINITY;
  function sweep(now) {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
    nextSweepAt = now + rule.windowMs;
  }
  function makeRoom(now) {
    if (windows.size < maxKeys) return;
    sweep(now);
    for (const key of windows.keys()) {
      if (windows.size < maxKeys) break;
      windows.delete(key);
    }
  }
  return {
    check(key, now) {
      if (now >= nextSweepAt) sweep(now);
      const window = windows.get(key);
      if (!window || window.resetAt <= now) {
        makeRoom(now);
        windows.set(key, { count: 1, resetAt: now + rule.windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }
      if (window.count >= rule.limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1e3))
        };
      }
      window.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
    size() {
      return windows.size;
    }
  };
}

// src/server.ts
var port = Number(process.env.PORT ?? 8787);
var MINUTE = 6e4;
var perAddress = createRateLimiter({ limit: 600, windowMs: MINUTE });
var perUser = createRateLimiter({ limit: 300, windowMs: MINUTE });
var perFailedAuth = createRateLimiter({ limit: 10, windowMs: MINUTE });
var perSignIn = createRateLimiter({ limit: 20, windowMs: MINUTE });
var trustedProxies = trustedProxyCount();
function addressOf(request) {
  return callerAddress(request, trustedProxies);
}
function limit(limiter, key, now, message) {
  const verdict = limiter.check(key, now);
  if (!verdict.allowed) {
    throw new HttpError(429, message, {
      "retry-after": String(verdict.retryAfterSeconds)
    });
  }
}
function validate(run) {
  try {
    return run();
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Invalid sync payload.");
  }
}
async function checkHealth() {
  try {
    const credentials = await getPool().query(
      "select count(*)::text as count from sync_credentials"
    );
    return credentials.rows[0]?.count === "0" ? [
      200,
      {
        status: "ok",
        notes: [
          "No sync credentials exist yet. Mint one with `pnpm --filter @moat/sync-server mint`."
        ]
      }
    ] : [200, { status: "ok" }];
  } catch (error) {
    console.error("Health check could not reach the database.", error);
    return [503, { status: "unhealthy", problems: ["Database is unreachable."] }];
  }
}
async function authenticate(authorization) {
  try {
    return await authenticateSyncRequest(authorization);
  } catch (error) {
    throw new HttpError(401, error instanceof Error ? error.message : "Unauthorized.");
  }
}
function authorize(principal, claimedUserId) {
  try {
    assertPrincipalOwns(principal, claimedUserId);
  } catch (error) {
    throw new HttpError(403, error instanceof Error ? error.message : "Forbidden.");
  }
}
var server = createServer(async (request, response) => {
  try {
    if (applyCors(request, response)) {
      return;
    }
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, ...await checkHealth());
      return;
    }
    if (request.method !== "POST") {
      throw new HttpError(405, "Method not allowed.");
    }
    if (url.pathname === "/v1/auth/callback") {
      const address2 = addressOf(request);
      limit(perAddress, address2, Date.now(), "Too many requests. Try again shortly.");
      limit(perSignIn, address2, Date.now(), "Too many sign-in attempts. Try again shortly.");
      const body = await readJsonBody(request);
      const signIn = validate(
        () => validateAuthCallbackRequest(
          body,
          allowedRedirectUris(),
          process.env.MOAT_OIDC_GOOGLE_IOS_CLIENT_ID?.trim()
        )
      );
      let identity;
      try {
        identity = await exchangeGoogleCode({
          code: signIn.code,
          codeVerifier: signIn.codeVerifier,
          redirectUri: signIn.redirectUri,
          nonce: signIn.nonce,
          client: signIn.client
        });
      } catch (error) {
        throw new HttpError(401, error instanceof Error ? error.message : "Sign-in failed.");
      }
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
        proposedIsProven
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
        syncAuthToken: await mintSyncCredential(resolved.userId, "sign-in")
      });
      return;
    }
    const address = addressOf(request);
    const now = Date.now();
    limit(perAddress, address, now, "Too many requests. Try again shortly.");
    let principal;
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
    if (!response.headersSent) {
      sendJson(response, 500, { error: "Sync request failed." });
    }
  }
});
server.requestTimeout = 3e4;
server.headersTimeout = 15e3;
server.listen(port, () => {
  console.log(`moat sync server listening on ${port}`);
});
var stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    const giveUp = setTimeout(() => process.exit(1), 1e4);
    giveUp.unref();
    server.close(() => {
      closePool().catch((error) => console.error("Could not close the pool cleanly.", error)).finally(() => process.exit(0));
    });
  });
}
//# sourceMappingURL=server.js.map
