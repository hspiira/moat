import { describe, expect, it } from "vitest";

import {
  DATABASE_VERSION,
  getIndexedDbMigrationStepVersions,
  getIndexedDbMigrationVersions,
  getIndexedDbStoreIndexes,
  USER_ID_INDEX,
  USER_ID_IS_DEFAULT_INDEX,
  USER_ID_MONTH_INDEX,
  USER_ID_OCCURRED_ON_INDEX,
  USER_ID_PERIOD_INDEX,
  USER_ID_STATUS_INDEX,
} from "@/lib/repositories/indexeddb/client";

describe("indexeddb schema metadata", () => {
  it("includes additive migrations for older installations", () => {
    expect(getIndexedDbMigrationVersions(1)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(getIndexedDbMigrationVersions(7)).toEqual([8, 9, 10, 11, 12]);
  });

  it("declares the indexes used by repository query helpers", () => {
    expect(getIndexedDbStoreIndexes("transactions")).toEqual([
      USER_ID_INDEX,
      USER_ID_OCCURRED_ON_INDEX,
    ]);
    expect(getIndexedDbStoreIndexes("categories")).toEqual([
      USER_ID_INDEX,
      USER_ID_IS_DEFAULT_INDEX,
    ]);
    expect(getIndexedDbStoreIndexes("budgets")).toEqual([
      USER_ID_INDEX,
      USER_ID_MONTH_INDEX,
    ]);
    expect(getIndexedDbStoreIndexes("monthCloses")).toEqual([
      USER_ID_INDEX,
      USER_ID_PERIOD_INDEX,
    ]);
    expect(getIndexedDbStoreIndexes("syncOutbox")).toEqual([
      USER_ID_INDEX,
      USER_ID_STATUS_INDEX,
    ]);
  });
});

describe("every migration actually runs", () => {
  /* runMigrations walks MIGRATION_VERSIONS, so a step listed only in
     migrationSteps is dead: the store it creates never appears, and the failure
     shows up as a missing object store long after the release. */
  it("lists every migration step among the versions it walks", () => {
    const walked = getIndexedDbMigrationVersions(0);
    const missing = getIndexedDbMigrationStepVersions().filter(
      (version) => !walked.includes(version),
    );

    expect(missing, "add these to MIGRATION_VERSIONS or their stores are never created").toEqual(
      [],
    );
  });

  it("walks nothing newer than the database version it opens", () => {
    const beyond = getIndexedDbMigrationVersions(0).filter(
      (version) => version > DATABASE_VERSION,
    );

    expect(beyond, "a migration past DATABASE_VERSION never runs").toEqual([]);
  });

  it("reaches the current database version", () => {
    expect(Math.max(...getIndexedDbMigrationVersions(0))).toBe(DATABASE_VERSION);
  });
});
