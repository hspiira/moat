import { describe, expect, it } from "vitest";

import { pendingSyncTransactionIds } from "@/lib/repositories/workspace-snapshot";
import type { SyncOutboxItem, SyncProfile } from "@/lib/types";

const profile = (overrides: Partial<SyncProfile> = {}): SyncProfile => ({
  id: "sync:1",
  userId: "u1",
  mode: "hosted_opt_in",
  hostedSyncEnabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const item = (
  entityId: string,
  status: SyncOutboxItem["status"],
  entityType: SyncOutboxItem["entityType"] = "transaction",
): SyncOutboxItem => ({
  id: `out:${entityId}:${status}`,
  userId: "u1",
  entityType,
  entityId,
  operation: "upsert",
  payload: "{}",
  status,
  attempts: 0,
  queuedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("pendingSyncTransactionIds", () => {
  it("marks queued and failed transactions", () => {
    const ids = pendingSyncTransactionIds(profile(), [
      item("t1", "pending"),
      item("t2", "failed"),
      item("t3", "synced"),
    ]);

    expect([...ids].sort()).toEqual(["t1", "t2"]);
  });

  it("ignores entities that are not transactions", () => {
    const ids = pendingSyncTransactionIds(profile(), [item("a1", "pending", "account")]);
    expect(ids.size).toBe(0);
  });

  // Nothing is "waiting to sync" when sync was never turned on.
  it("returns nothing when hosted sync is off", () => {
    expect(
      pendingSyncTransactionIds(profile({ hostedSyncEnabled: false }), [item("t1", "pending")]).size,
    ).toBe(0);
    expect(
      pendingSyncTransactionIds(profile({ mode: "local_only" }), [item("t1", "pending")]).size,
    ).toBe(0);
    expect(pendingSyncTransactionIds(null, [item("t1", "pending")]).size).toBe(0);
  });
});
