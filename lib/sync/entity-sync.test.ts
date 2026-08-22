import { describe, expect, it, vi } from "vitest";

import {
  applyPulledRecord,
  getConflictStrategy,
  isSyncableEntityType,
} from "@/lib/sync/entity-sync";
import type { RepositoryBundle } from "@/lib/repositories/types";
import type { SyncPullRecord } from "@/lib/sync/types";

function makeRepositories(): RepositoryBundle {
  return {
    userProfile: {} as RepositoryBundle["userProfile"],
    projects: {} as RepositoryBundle["projects"],
    syncVersions: {} as RepositoryBundle["syncVersions"],
    accounts: {} as RepositoryBundle["accounts"],
    transactions: {} as RepositoryBundle["transactions"],
    captureEnvelopes: {} as RepositoryBundle["captureEnvelopes"],
    captureReviewItems: {} as RepositoryBundle["captureReviewItems"],
    correctionLogs: {} as RepositoryBundle["correctionLogs"],
    transactionRules: {} as RepositoryBundle["transactionRules"],
    recurringObligations: {} as RepositoryBundle["recurringObligations"],
    monthCloses: {} as RepositoryBundle["monthCloses"],
    categories: {} as RepositoryBundle["categories"],
    counterparties: {} as RepositoryBundle["counterparties"],
    goals: {} as RepositoryBundle["goals"],
    budgets: {} as RepositoryBundle["budgets"],
    investmentProfiles: {} as RepositoryBundle["investmentProfiles"],
    imports: {} as RepositoryBundle["imports"],
    resources: {} as RepositoryBundle["resources"],
    syncProfiles: {} as RepositoryBundle["syncProfiles"],
    syncOutbox: {} as RepositoryBundle["syncOutbox"],
    items: {
      getById: vi.fn(),
      listByUser: vi.fn(),
      findByNormalizedName: vi.fn(),
      upsert: vi.fn(async (value) => value),
      remove: vi.fn(),
    } as unknown as RepositoryBundle["items"],
    plannedPurchases: {
      getById: vi.fn(),
      listByUser: vi.fn(),
      listByStatus: vi.fn(),
      upsert: vi.fn(async (value) => value),
      remove: vi.fn(),
    } as unknown as RepositoryBundle["plannedPurchases"],
    transactionLineItems: {
    projects: {} as RepositoryBundle["projects"],
    syncVersions: {} as RepositoryBundle["syncVersions"],
      getById: vi.fn(),
      listByUser: vi.fn(),
      listByTransactionId: vi.fn(),
      upsert: vi.fn(async (value) => value),
      remove: vi.fn(),
    } as unknown as RepositoryBundle["transactionLineItems"],
  };
}

describe.each(["items", "plannedPurchases", "transactionLineItems"] as const)(
  "entity-sync: %s",
  (entityType) => {
    it("is a recognized syncable entity type", () => {
      expect(isSyncableEntityType(entityType)).toBe(true);
    });

    it("uses the same conflict strategy as transactions (manual_review)", () => {
      expect(getConflictStrategy(entityType)).toBe(getConflictStrategy("transactions"));
      expect(getConflictStrategy(entityType)).toBe("manual_review");
    });

    it("upserts a pulled record through the matching repository", async () => {
      const repositories = makeRepositories();
      const record: SyncPullRecord = {
        entityType,
        entityId: "record-1",
        payload: JSON.stringify({ id: "record-1", userId: "u1" }),
        deleted: false,
        updatedAt: "2026-08-07T00:00:00.000Z",
        serverVersionToken: "v1",
      };

      await applyPulledRecord(repositories, record);

      expect(repositories[entityType].upsert).toHaveBeenCalledWith({
        id: "record-1",
        userId: "u1",
      });
    });

    it("removes a deleted pulled record through the matching repository", async () => {
      const repositories = makeRepositories();
      const record: SyncPullRecord = {
        entityType,
        entityId: "record-1",
        payload: null,
        deleted: true,
        updatedAt: "2026-08-07T00:00:00.000Z",
        serverVersionToken: "v1",
      };

      await applyPulledRecord(repositories, record);

      expect(repositories[entityType].remove).toHaveBeenCalledWith("record-1");
    });
  },
);
