import { describe, expect, it } from "vitest";

import {
  createSyncStubResponse,
  validateSyncPushRequest,
} from "@/lib/sync/server-contract";

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
});
