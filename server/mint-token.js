import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);

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

// src/db/credentials.ts
import { createHash, randomBytes } from "node:crypto";
function hashSyncToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
function generateSyncToken() {
  return randomBytes(32).toString("hex");
}
async function mintSyncCredential(userId2, label2) {
  const token = generateSyncToken();
  await getPool().query(
    `insert into sync_credentials (token_sha256, user_id, label, created_at)
     values ($1, $2, $3, $4)`,
    [hashSyncToken(token), userId2, label2 ?? null, (/* @__PURE__ */ new Date()).toISOString()]
  );
  return token;
}
async function revokeSyncCredentials(userId2) {
  const result = await getPool().query("delete from sync_credentials where user_id = $1", [userId2]);
  return result.rowCount ?? 0;
}

// src/mint-token.ts
var [command, userId, label] = process.argv.slice(2);
function usage() {
  console.error("usage: mint-token <mint|revoke> <userId> [label]");
  process.exit(1);
}
if (!userId || command !== "mint" && command !== "revoke") {
  usage();
}
try {
  if (command === "mint") {
    const token = await mintSyncCredential(userId, label);
    console.log(token);
    console.error(`Minted a sync token for ${userId}. It is shown once; store it now.`);
  } else {
    const removed = await revokeSyncCredentials(userId);
    console.error(`Revoked ${removed} token${removed === 1 ? "" : "s"} for ${userId}.`);
  }
} finally {
  await closePool();
}
//# sourceMappingURL=mint-token.js.map
