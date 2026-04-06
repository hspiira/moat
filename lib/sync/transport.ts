import type { SyncOutboxItem } from "@/lib/types";

import type { SyncPushRequest, SyncPushResponse } from "@/lib/sync/types";

function normalizeEndpoint(endpoint: string) {
  return endpoint.replace(/\/+$/, "");
}

export function createSyncPushRequest(params: {
  userId: string;
  items: SyncOutboxItem[];
  platform?: "web" | "android" | "ios";
}): SyncPushRequest {
  return {
    userId: params.userId,
    device: {
      app: "moat",
      platform: params.platform ?? "web",
    },
    items: params.items.map((item) => ({
      outboxId: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      operation: item.operation,
      payload: item.payload,
      queuedAt: item.queuedAt,
    })),
  };
}

export async function pushSyncBatch(params: {
  endpoint: string;
  request: SyncPushRequest;
}): Promise<SyncPushResponse> {
  const response = await fetch(`${normalizeEndpoint(params.endpoint)}/v1/sync/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.request),
  });

  if (!response.ok) {
    throw new Error(`Sync request failed with status ${response.status}.`);
  }

  return (await response.json()) as SyncPushResponse;
}
