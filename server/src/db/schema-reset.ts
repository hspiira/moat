import { SCHEMA_SQL } from "./schema.js";

// Derived from the schema rather than listed by hand. A hand-kept list goes
// stale the moment a table is added, and the failure is a foreign key refusing
// the drop of something it depends on, far from the table that was added.
export function syncTableNames(schemaSql: string = SCHEMA_SQL): string[] {
  return [...schemaSql.matchAll(/create table if not exists\s+([a-z_]+)/gi)].map(
    (match) => match[1],
  );
}

// cascade because the order tables were declared in is not the order their
// dependencies allow them to be dropped in.
export function dropSyncTablesSql(schemaSql: string = SCHEMA_SQL): string {
  return syncTableNames(schemaSql)
    .map((table) => `drop table if exists ${table} cascade;`)
    .join("\n");
}
