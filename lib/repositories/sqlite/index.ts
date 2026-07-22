import { createSqliteClient, type SqliteClient } from "@/lib/repositories/sqlite/client";
import { createSqliteAdapter } from "@/lib/repositories/sqlite/repository";
import { createRepositoryBundle } from "@/lib/repositories/shared";
import type { RepositoryBundle } from "@/lib/repositories/types";

export function createSqliteRepositories(
  client: SqliteClient = createSqliteClient(),
): RepositoryBundle {
  return createRepositoryBundle(createSqliteAdapter(client));
}
