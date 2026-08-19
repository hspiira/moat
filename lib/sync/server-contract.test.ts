import { afterEach, describe, expect, it } from "vitest";

import {
  assertPrincipalOwns,
  constantTimeEquals,
  createSyncStubResponse,
  resolveSyncPrincipal,
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

describe("constantTimeEquals", () => {
  it("matches identical secrets", () => {
    expect(constantTimeEquals("a-long-shared-secret", "a-long-shared-secret")).toBe(true);
  });

  it("separates secrets that differ only in the last byte", () => {
    expect(constantTimeEquals("a-long-shared-secretA", "a-long-shared-secretB")).toBe(false);
  });

  it("separates a secret from its own prefix", () => {
    expect(constantTimeEquals("a-long-shared-secret", "a-long-shared-secre")).toBe(false);
  });

  it("separates a secret from a longer string that starts with it", () => {
    expect(constantTimeEquals("a-long-shared-secret", "a-long-shared-secret-plus")).toBe(false);
  });
});

describe("resolveSyncPrincipal", () => {
  afterEach(() => {
    delete process.env.MOAT_SYNC_BEARER_TOKEN;
    delete process.env.MOAT_SYNC_BEARER_USER_ID;
  });

  it("refuses to serve when nothing is configured, rather than letting everyone in", () => {
    expect(() => resolveSyncPrincipal("Bearer anything")).toThrow(
      /MOAT_SYNC_BEARER_TOKEN and MOAT_SYNC_BEARER_USER_ID/,
    );
  });

  it("refuses a token that is not bound to a user", () => {
    process.env.MOAT_SYNC_BEARER_TOKEN = "secret";

    expect(() => resolveSyncPrincipal("Bearer secret")).toThrow(
      /MOAT_SYNC_BEARER_TOKEN and MOAT_SYNC_BEARER_USER_ID/,
    );
  });

  it("rejects a wrong token", () => {
    process.env.MOAT_SYNC_BEARER_TOKEN = "secret";
    process.env.MOAT_SYNC_BEARER_USER_ID = "user:owner";

    expect(() => resolveSyncPrincipal("Bearer wrong")).toThrow(
      "Hosted sync bearer token is invalid.",
    );
  });

  it("rejects a missing authorization header", () => {
    process.env.MOAT_SYNC_BEARER_TOKEN = "secret";
    process.env.MOAT_SYNC_BEARER_USER_ID = "user:owner";

    expect(() => resolveSyncPrincipal(null)).toThrow("Hosted sync requires a bearer token.");
  });

  it("takes the user from the token, never from the caller", () => {
    process.env.MOAT_SYNC_BEARER_TOKEN = "secret";
    process.env.MOAT_SYNC_BEARER_USER_ID = "user:owner";

    expect(resolveSyncPrincipal("Bearer secret")).toEqual({ userId: "user:owner" });
  });
});

describe("assertPrincipalOwns", () => {
  it("lets a token act for its own user", () => {
    assertPrincipalOwns({ userId: "user:owner" }, "user:owner");
  });

  it("stops a token reading somebody else's records", () => {
    expect(() => assertPrincipalOwns({ userId: "user:owner" }, "user:someone-else")).toThrow(
      "This token cannot read or write another user's records.",
    );
  });
});
