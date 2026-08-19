import type { SyncPushRequest, SyncPushResponse } from "@/lib/sync/types";
import type { SyncOutboxOperation } from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validateSyncPushRequest(input: unknown): SyncPushRequest {
  if (!isRecord(input)) {
    throw new Error("Sync payload must be an object.");
  }

  const userId = input.userId;
  const device = input.device;
  const items = input.items;

  if (typeof userId !== "string" || !userId.trim()) {
    throw new Error("Sync payload requires a userId.");
  }

  if (!isRecord(device) || typeof device.app !== "string" || typeof device.platform !== "string") {
    throw new Error("Sync payload requires valid device metadata.");
  }

  if (!Array.isArray(items)) {
    throw new Error("Sync payload requires an items array.");
  }

  const normalizedItems = items.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Each sync item must be an object.");
    }

    const outboxId = item.outboxId;
    const entityType = item.entityType;
    const entityId = item.entityId;
    const operation = item.operation;
    const payload = item.payload;
    const queuedAt = item.queuedAt;
    const baseVersionToken = item.baseVersionToken;

    if (
      typeof outboxId !== "string" ||
      typeof entityType !== "string" ||
      typeof entityId !== "string" ||
      (operation !== "upsert" && operation !== "remove") ||
      typeof payload !== "string" ||
      typeof queuedAt !== "string"
    ) {
      throw new Error("Sync item is missing required fields.");
    }

    if (baseVersionToken !== undefined && typeof baseVersionToken !== "string") {
      throw new Error("Sync item baseVersionToken must be a string when provided.");
    }

    return {
      outboxId,
      entityType,
      entityId,
      operation: operation as SyncOutboxOperation,
      payload,
      queuedAt,
      baseVersionToken,
    };
  });

  return {
    userId,
    device: {
      app: "moat",
      platform: device.platform as "web" | "android" | "ios",
      id: typeof device.id === "string" ? device.id : undefined,
    },
    items: normalizedItems,
  };
}

const COMPARISON_FLOOR = 64;

export function constantTimeEquals(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const width = Math.max(a.length, b.length, COMPARISON_FLOOR);

  let difference = a.length ^ b.length;
  for (let index = 0; index < width; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }

  return difference === 0;
}

export function bearerTokenFrom(headerValue: string | null): string {
  const value = headerValue?.trim();
  if (!value?.startsWith("Bearer ")) {
    throw new Error("Hosted sync requires a bearer token.");
  }
  return value.slice("Bearer ".length).trim();
}

export type SyncPrincipal = { userId: string };

export function assertPrincipalOwns(principal: SyncPrincipal, claimedUserId: string) {
  if (!constantTimeEquals(principal.userId, claimedUserId)) {
    throw new Error("This token cannot read or write another user's records.");
  }
}

export function createSyncStubResponse(request: SyncPushRequest): SyncPushResponse {
  return {
    syncedAt: new Date().toISOString(),
    results: request.items.map((item) => ({
      outboxId: item.outboxId,
      status: "synced" as const,
      strategy: "client_wins" as const,
    })),
  };
}
