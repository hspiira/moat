import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { storeNames } from "@/lib/repositories/store-names";

// Reads the source rather than calling it, so adding a store and forgetting the
// export fails here.
describe("export completeness", () => {
  const notUserOwned = new Set<string>([storeNames.meta, storeNames.resources]);
  const source = readFileSync(path.join(process.cwd(), "lib/security/data-export.ts"), "utf8");

  const missingFrom = (section: string) =>
    Object.values(storeNames)
      .filter((store) => !notUserOwned.has(store))
      .filter((store) => !section.includes(`repositories.${repositoryFor(store)}.`));

  it("collects every store holding user data", () => {
    expect(
      missingFrom(
        source.slice(
          source.indexOf("export async function collectFullExport"),
          source.indexOf("export async function restoreFullExport"),
        ),
      ),
    ).toEqual([]);
  });

  it("restores every store it collects", () => {
    expect(
      missingFrom(source.slice(source.indexOf("export async function restoreFullExport"))),
    ).toEqual([]);
  });
});

function repositoryFor(store: string): string {
  return store === "userProfiles" ? "userProfile" : store;
}
