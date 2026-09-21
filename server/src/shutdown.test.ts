import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const describeServer = hasDatabase ? describe : describe.skip;

const PORT = 8794;

async function startServer(): Promise<ChildProcess> {
  const child = spawn("node", [path.join(process.cwd(), "server/server.js")], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_SSL: process.env.DATABASE_SSL ?? "disable",
    },
    stdio: "ignore",
  });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/health`);
      return child;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  child.kill();
  throw new Error("Sync server did not start.");
}

function exitOf(child: ChildProcess, withinMs: number): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Server was still running ${withinMs}ms after SIGTERM.`));
    }, withinMs);

    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

describeServer("shutdown", () => {
  /* The handler closes the server and the pool before exiting, so a signal that
     arrives mid-transaction lets it finish rather than cutting the connection. */
  it("exits cleanly on SIGTERM", async () => {
    const child = await startServer();

    child.kill("SIGTERM");

    expect(await exitOf(child, 8_000)).toBe(0);
  });

  it("exits cleanly on SIGINT", async () => {
    const child = await startServer();

    child.kill("SIGINT");

    expect(await exitOf(child, 8_000)).toBe(0);
  });

  it("does not trip over a second signal", async () => {
    const child = await startServer();

    child.kill("SIGTERM");
    child.kill("SIGTERM");

    expect(await exitOf(child, 8_000)).toBe(0);
  });
});
