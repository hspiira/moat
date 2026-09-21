import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPool } from "./db/pool.js";
import { dropSyncTablesSql } from "./db/schema-reset.js";
import { SCHEMA_SQL } from "./db/schema.js";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const describeServer = hasDatabase ? describe : describe.skip;

const READY_PORT = 8792;
const UNREACHABLE_PORT = 8793;

async function start(port: number, env: Record<string, string>): Promise<ChildProcess> {
  const child = spawn("node", [path.join(process.cwd(), "server/server.js")], {
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
  throw new Error(`Sync server did not start on ${port}.`);
}

describeServer("health", () => {
  const children: ChildProcess[] = [];

  beforeAll(async () => {
    await getPool().query(dropSyncTablesSql());
    await getPool().query(SCHEMA_SQL);

    children.push(
      await start(READY_PORT, { DATABASE_SSL: process.env.DATABASE_SSL ?? "disable" }),
      await start(UNREACHABLE_PORT, {
        DATABASE_URL: "postgres://moat_absent:secret@127.0.0.1:1/moat_absent",
        DATABASE_SSL: "disable",
      }),
    );
  });

  afterAll(() => {
    for (const child of children) child.kill();
  });

  /* A fresh deployment has no credentials because signing in is what creates
     the first one, and the sign-in is unreachable if the probe fails. */
  it("stays healthy on a database with no credentials yet", async () => {
    const response = await fetch(`http://127.0.0.1:${READY_PORT}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
  });

  it("still says a credential is worth minting", async () => {
    const response = await fetch(`http://127.0.0.1:${READY_PORT}/health`);
    const body = (await response.json()) as { notes?: string[] };

    expect(body.notes?.join(" ")).toContain("No sync credentials exist yet");
  });

  it("reports an unreachable database as unhealthy", async () => {
    const response = await fetch(`http://127.0.0.1:${UNREACHABLE_PORT}/health`);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "unhealthy",
      problems: ["Database is unreachable."],
    });
  });

  /* The endpoint takes no token, so whatever it says is said to anyone. */
  it("names neither the host, the port, the database nor the role when it fails", async () => {
    const response = await fetch(`http://127.0.0.1:${UNREACHABLE_PORT}/health`);
    const body = await response.text();

    for (const secret of ["moat_absent", "secret", "127.0.0.1", "ECONNREFUSED", ":1"]) {
      expect(body, `${secret} reached an unauthenticated response`).not.toContain(secret);
    }
  });
});
