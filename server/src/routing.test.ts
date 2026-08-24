import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* The sync service only receives what the deployment forwards to it. A route
   the server answers but nothing routes reaches the static site instead, which
   is how signing in failed: /v1/auth/callback existed and went nowhere. */
describe("deployment routing", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

  const serverRoutes = [
    ...read("server/src/server.ts").matchAll(/url\.pathname === "([^"]+)"/g),
  ].map((match) => match[1]);

  const rewrites = (
    JSON.parse(read("vercel.json")) as {
      rewrites: { source: string; destination: { service: string } }[];
    }
  ).rewrites;

  function servedBy(pathname: string): string | undefined {
    for (const rule of rewrites) {
      const pattern = new RegExp(`^${rule.source.replace(/\(\.\*\)/g, ".*")}$`);
      if (pattern.test(pathname)) return rule.destination.service;
    }
    return undefined;
  }

  it("knows which routes the server answers", () => {
    expect(serverRoutes).toContain("/v1/auth/callback");
    expect(serverRoutes.length).toBeGreaterThan(2);
  });

  it.each([
    "/health",
    "/v1/auth/callback",
    "/v1/sync/push",
    "/v1/sync/pull",
  ])("forwards %s to the sync service", (pathname) => {
    expect(servedBy(pathname)).toBe("sync");
  });

  it("forwards every route the server answers", () => {
    const stranded = serverRoutes.filter((route) => servedBy(route) !== "sync");

    expect(stranded, "these reach the static site instead of the server").toEqual([]);
  });

  /* The bundle beside package.json is what the deployment runs. It went stale
     once already: sign-in shipped while the committed bundle predated it and
     had no /v1/auth/callback in it at all. */
  it("ships a bundle that answers every route the source declares", () => {
    const bundle = read("server/server.js");
    const missing = serverRoutes.filter((route) => !bundle.includes(route));

    expect(missing, "the built entrypoint is behind the source; rebuild it").toEqual([]);
  });

  it("still serves the app itself from the web service", () => {
    expect(servedBy("/settings")).toBe("web");
    expect(servedBy("/")).toBe("web");
  });
});
