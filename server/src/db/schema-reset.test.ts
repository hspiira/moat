import { describe, expect, it } from "vitest";

import { SCHEMA_SQL } from "./schema.js";
import { dropSyncTablesSql, syncTableNames } from "./schema-reset.js";

describe("syncTableNames", () => {
  it("finds every table the schema creates", () => {
    const names = syncTableNames();

    for (const expected of [
      "sync_users",
      "sync_credentials",
      "sync_identities",
      "sync_records",
      "sync_applied_outbox",
    ]) {
      expect(names, `${expected} is missing, so a reset would leave it behind`).toContain(expected);
    }
  });

  /* The list is derived so that adding a table cannot leave the teardown stale.
     A stale teardown fails as a foreign key refusing a drop, nowhere near the
     table that was added. */
  it("misses nothing, counted against the schema itself", () => {
    expect(syncTableNames()).toHaveLength(
      (SCHEMA_SQL.match(/create table if not exists/gi) ?? []).length,
    );
  });
});

describe("dropSyncTablesSql", () => {
  it("cascades, because declaration order is not drop order", () => {
    expect(dropSyncTablesSql()).toContain("cascade");
  });

  it("drops every table it found", () => {
    const sql = dropSyncTablesSql();
    for (const table of syncTableNames()) {
      expect(sql).toContain(`drop table if exists ${table} cascade;`);
    }
  });
});
