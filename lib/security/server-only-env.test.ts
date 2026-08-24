import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

/* Next inlines NEXT_PUBLIC_ values into the browser bundle and nothing else, so
   a secret is safe only while its name carries no such prefix and it is read
   nowhere the browser runs. The client secret reaching a phone would let anyone
   holding the app impersonate the deployment to Google. */
describe("server-only configuration", () => {
  const tracked = execFileSync("git", ["ls-files", "app", "components", "lib", "server", "scripts"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter((file) => /\.(ts|tsx|mjs)$/.test(file));

  // Only the sign-in configuration is secret. lib/sync/hosted-store.ts reads a
  // store path, imports node:path, and is imported by the server alone, so it
  // never reaches a browser bundle to begin with.
  it("reads no sign-in secret anywhere the browser runs", () => {
    const offenders = tracked
      .filter((file) => !file.startsWith("server/") && !file.endsWith(".test.ts"))
      .filter((file) => /process\.env\.MOAT_OIDC/.test(readFileSync(file, "utf8")));

    expect(
      offenders,
      "a MOAT_OIDC value read outside server/ is a secret handed to every phone",
    ).toEqual([]);
  });

  it("gives no MOAT_ variable a NEXT_PUBLIC_ name", () => {
    const offenders = tracked.filter((file) =>
      /NEXT_PUBLIC_MOAT_OIDC/.test(readFileSync(file, "utf8")),
    );

    expect(offenders, "the NEXT_PUBLIC_ prefix publishes a value to the browser").toEqual([]);
  });
});
