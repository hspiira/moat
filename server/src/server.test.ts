import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPool } from "./db/pool.js";
import { mintSyncCredential } from "./db/credentials.js";
import { SCHEMA_SQL } from "./db/schema.js";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const describeServer = hasDatabase ? describe : describe.skip;

const OWNER = "server-test-owner";
const INTRUDER = "server-test-intruder";
const PORT = 8791;

function pushBody(userId: string) {
  return {
    userId,
    device: { app: "moat", platform: "web", id: "device:test" },
    items: [
      {
        outboxId: `outbox:${userId}:1`,
        entityType: "categories",
        entityId: "category:1",
        operation: "upsert",
        payload: JSON.stringify({ id: "category:1" }),
        queuedAt: "2026-08-19T00:00:00.000Z",
      },
    ],
  };
}

async function requireFreePort(port: number) {
  try {
    await fetch(`http://127.0.0.1:${port}/health`);
  } catch {
    return;
  }
  throw new Error(
    `Port ${port} already answers. A stale sync server would make these tests lie; kill it first.`,
  );
}

async function start(port: number, env: Record<string, string>): Promise<ChildProcess> {
  await requireFreePort(port);
  const child = spawn("node", [path.join(process.cwd(), "server/dist/server.js")], {
    env: { ...process.env, PORT: String(port), ...env },
    stdio: "ignore",
  });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}/health`);
      return child;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  child.kill();
  throw new Error("Sync server did not start.");
}

function post(port: number, pathname: string, body: unknown, token: string | null) {
  return fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describeServer("sync server tenancy", () => {
  let child: ChildProcess;
  let ownerToken: string;
  let intruderToken: string;

  beforeAll(async () => {
    await getPool().query(`
      drop table if exists sync_applied_outbox;
      drop table if exists sync_records;
      drop table if exists sync_users;
      drop table if exists sync_credentials;
    `);
    await getPool().query(SCHEMA_SQL);

    ownerToken = await mintSyncCredential(OWNER, "owner device");
    intruderToken = await mintSyncCredential(INTRUDER, "intruder device");

    child = await start(PORT, {
      DATABASE_SSL: process.env.DATABASE_SSL ?? "disable",
    });
  });

  afterAll(() => {
    child?.kill();
  });

  it("accepts a push for the user the token is bound to", async () => {
    const response = await post(PORT, "/v1/sync/push", pushBody(OWNER), ownerToken);
    expect(response.status).toBe(200);
  });

  it("refuses a push that claims another user", async () => {
    const response = await post(PORT, "/v1/sync/push", pushBody(INTRUDER), ownerToken);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "This token cannot read or write another user's records.",
    });
  });

  it("refuses a pull that claims another user", async () => {
    const response = await post(PORT, "/v1/sync/pull", { userId: INTRUDER }, ownerToken);
    expect(response.status).toBe(403);
  });

  it("lets a second user push their own records with their own token", async () => {
    const response = await post(PORT, "/v1/sync/push", pushBody(INTRUDER), intruderToken);
    expect(response.status).toBe(200);
  });

  it("refuses a wrong token", async () => {
    const response = await post(PORT, "/v1/sync/push", pushBody(OWNER), "not-a-real-token");
    expect(response.status).toBe(401);
  });

  it("refuses a request with no token at all", async () => {
    const response = await post(PORT, "/v1/sync/push", pushBody(OWNER), null);
    expect(response.status).toBe(401);
  });

  /* Guessing tokens is held far tighter than ordinary use, so this runs last:
     it spends the failed-authentication budget for this address. */
  it("stops someone guessing tokens, and says when to come back", async () => {
    let refused: Response | undefined;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await post(PORT, "/v1/sync/push", pushBody(OWNER), `guess-${attempt}`);
      if (response.status === 429) {
        refused = response;
        break;
      }
      expect(response.status).toBe(401);
    }

    expect(refused, "token guessing was never refused").toBeDefined();
    expect(Number(refused?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await refused?.json()).toEqual({
      error: "Too many failed sign-ins. Try again shortly.",
    });
  });
});

