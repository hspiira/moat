import { describe, expect, it } from "vitest";

import {
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
    expect(getIndexedDbMigrationVersions(1)).toEqual([4, 5, 6, 7, 8]);
    expect(getIndexedDbMigrationVersions(7)).toEqual([8]);
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
