import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const describeServer = hasDatabase ? describe : describe.skip;

const OWNER = "server-test-owner";
const INTRUDER = "server-test-intruder";
const TOKEN = "a-long-shared-secret-token";
const BOUND_PORT = 8791;
const UNBOUND_PORT = 8792;

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

  beforeAll(async () => {
    child = await start(BOUND_PORT, {
      MOAT_SYNC_BEARER_TOKEN: TOKEN,
      MOAT_SYNC_BEARER_USER_ID: OWNER,
      DATABASE_SSL: process.env.DATABASE_SSL ?? "disable",
    });
  });

  afterAll(() => {
    child?.kill();
  });

  it("accepts a push for the user the token is bound to", async () => {
    const response = await post(BOUND_PORT, "/v1/sync/push", pushBody(OWNER), TOKEN);
    expect(response.status).toBe(200);
  });

  it("refuses a push that claims another user", async () => {
    const response = await post(BOUND_PORT, "/v1/sync/push", pushBody(INTRUDER), TOKEN);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "This token cannot read or write another user's records.",
    });
  });

  it("refuses a pull that claims another user", async () => {
    const response = await post(BOUND_PORT, "/v1/sync/pull", { userId: INTRUDER }, TOKEN);
    expect(response.status).toBe(403);
  });

  it("refuses a wrong token", async () => {
    const response = await post(BOUND_PORT, "/v1/sync/push", pushBody(OWNER), "not-the-token");
    expect(response.status).toBe(401);
  });

  it("refuses a request with no token at all", async () => {
    const response = await post(BOUND_PORT, "/v1/sync/push", pushBody(OWNER), null);
    expect(response.status).toBe(401);
  });
});

describeServer("sync server without a bound user", () => {
  let child: ChildProcess;

  beforeAll(async () => {
    child = await start(UNBOUND_PORT, {
      MOAT_SYNC_BEARER_TOKEN: TOKEN,
      MOAT_SYNC_BEARER_USER_ID: "",
      DATABASE_SSL: process.env.DATABASE_SSL ?? "disable",
    });
  });

  afterAll(() => {
    child?.kill();
  });

  it("reports itself unhealthy rather than accepting self-asserted tenancy", async () => {
    const response = await fetch(`http://127.0.0.1:${UNBOUND_PORT}/health`);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).toContain("self-asserted");
  });

  it("refuses to serve sync at all", async () => {
    const response = await post(UNBOUND_PORT, "/v1/sync/push", pushBody(OWNER), TOKEN);
    expect(response.status).toBe(503);
  });
});
