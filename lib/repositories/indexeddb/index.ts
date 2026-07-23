import { createIndexedDbAdapter } from "@/lib/repositories/indexeddb/repository";
import { createRepositoryBundle } from "@/lib/repositories/shared";
import type { RepositoryBundle } from "@/lib/repositories/types";

export function createIndexedDbRepositories(): RepositoryBundle {
  return createRepositoryBundle(createIndexedDbAdapter());
}
