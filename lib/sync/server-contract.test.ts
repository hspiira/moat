import { describe, expect, it } from "vitest";

import {
  createSyncStubResponse,
  validateSyncBearerToken,
  validateSyncPushRequest,
} from "@/lib/sync/server-contract";
import { applyHostedSyncPush, pullHostedSyncChanges } from "@/lib/sync/hosted-store";

describe("validateSyncPushRequest", () => {
  it("accepts a valid sync payload", () => {
    const request = validateSyncPushRequest({
      userId: "u1",
      device: { app: "moat", platform: "web" },
      items: [
        {
          outboxId: "sync-outbox:1",
          entityType: "transactions",
          entityId: "t1",
          operation: "upsert",
          payload: "{\"id\":\"t1\"}",
          queuedAt: "2026-04-06T00:00:00.000Z",
        },
      ],
    });

    expect(request.userId).toBe("u1");
    expect(request.items).toHaveLength(1);
  });

  it("creates a stub response covering every item", () => {
    const response = createSyncStubResponse({
      userId: "u1",
      device: { app: "moat", platform: "web" },
      items: [
        {
          outboxId: "sync-outbox:1",
          entityType: "transactions",
          entityId: "t1",
          operation: "upsert",
          payload: "{}",
          queuedAt: "2026-04-06T00:00:00.000Z",
        },
      ],
    });

    expect(response.results[0]).toMatchObject({
      outboxId: "sync-outbox:1",
      status: "synced",
    });
  });

  it("accepts optional device id metadata", () => {
    const request = validateSyncPushRequest({
      userId: "u1",
      device: { app: "moat", platform: "web", id: "device:web-1" },
      items: [],
    });

    expect(request.device.id).toBe("device:web-1");
  });
});

describe("hosted sync store", () => {
  it("persists push items and exposes them via pull", async () => {
    const push = await applyHostedSyncPush({
      userId: "hosted-test-user-1",
      device: { app: "moat", platform: "web", id: "device:web-1" },
      items: [
        {
          outboxId: "sync-outbox:hosted-1",
          entityType: "categories",
          entityId: "category:1",
          operation: "upsert",
          payload: "{\"id\":\"category:1\",\"userId\":\"hosted-test-user-1\",\"name\":\"Food\",\"kind\":\"expense\",\"isDefault\":true,\"createdAt\":\"2026-04-06T00:00:00.000Z\"}",
          queuedAt: "2026-04-06T00:00:00.000Z",
        },
      ],
    });

    expect(push.results[0]).toMatchObject({
      outboxId: "sync-outbox:hosted-1",
      status: "synced",
      strategy: "client_wins",
    });

    const pull = await pullHostedSyncChanges({
      userId: "hosted-test-user-1",
    });

    expect(pull.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: "categories",
          entityId: "category:1",
          deleted: false,
        }),
      ]),
    );
  });

  it("marks manual-review entities as conflicts when server state diverges", async () => {
    await applyHostedSyncPush({
      userId: "hosted-test-user-2",
      device: { app: "moat", platform: "web", id: "device:web-1" },
      items: [
        {
          outboxId: "sync-outbox:hosted-2a",
          entityType: "transactions",
          entityId: "transaction:1",
          operation: "upsert",
          payload: "{\"id\":\"transaction:1\",\"amount\":100}",
          queuedAt: "2026-04-06T00:00:00.000Z",
        },
      ],
    });

    const conflict = await applyHostedSyncPush({
      userId: "hosted-test-user-2",
      device: { app: "moat", platform: "android", id: "device:android-1" },
      items: [
        {
          outboxId: "sync-outbox:hosted-2b",
          entityType: "transactions",
          entityId: "transaction:1",
          operation: "upsert",
          payload: "{\"id\":\"transaction:1\",\"amount\":200}",
          queuedAt: "2026-04-06T00:01:00.000Z",
        },
      ],
    });

    expect(conflict.results[0]).toMatchObject({
      status: "conflict",
      strategy: "manual_review",
    });
  });
});

describe("validateSyncBearerToken", () => {
  it("allows requests when no bearer token is configured", () => {
    validateSyncBearerToken(null);
  });

  it("rejects invalid bearer tokens when configured", () => {
    process.env.MOAT_SYNC_BEARER_TOKEN = "secret";

    expect(() => validateSyncBearerToken("Bearer wrong")).toThrow(
      "Hosted sync bearer token is invalid.",
    );

    delete process.env.MOAT_SYNC_BEARER_TOKEN;
  });
});
