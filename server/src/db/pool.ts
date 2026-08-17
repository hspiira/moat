import pg from "pg";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
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
    ssl: resolveSsl(),
  });

  return pool;
}

// Verifying certificates is the default. "no-verify" exists because some
// managed providers issue certs the default trust store rejects, but it has to
// be asked for: without verification, TLS does not stop an interceptor.
function resolveSsl(): pg.PoolConfig["ssl"] {
  switch (process.env.DATABASE_SSL) {
    case "disable":
      return undefined;
    case "no-verify":
      return { rejectUnauthorized: false };
    default:
      return { rejectUnauthorized: true };
  }
}

export async function closePool() {
  await pool?.end();
  pool = null;
}

/**
 * Run inside a transaction scoped to one user.
 *
 * The row-level security policies read `moat.user_id`, so every statement in
 * here is filtered to that user by the database rather than by the query text.
 * A query that forgets its user_id predicate returns nothing instead of
 * another user's rows.
 */
export async function withUserTransaction<T>(
  userId: string,
  run: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query("select set_config('moat.user_id', $1, true)", [userId]);
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
