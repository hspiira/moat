import type { SyncOutboxItem } from "@/lib/types";

import type {
  SyncPullRequest,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
} from "@/lib/sync/types";

function normalizeEndpoint(endpoint: string) {
  return endpoint.replace(/\/+$/, "");
}

export function createSyncPushRequest(params: {
  userId: string;
  items: SyncOutboxItem[];
  platform?: "web" | "android" | "ios";
  deviceId?: string;
}): SyncPushRequest {
  return {
    userId: params.userId,
    device: {
      app: "moat",
      platform: params.platform ?? "web",
      id: params.deviceId,
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
  authToken?: string;
}): Promise<SyncPushResponse> {
  const response = await fetch(`${normalizeEndpoint(params.endpoint)}/v1/sync/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(params.authToken?.trim()
        ? { Authorization: `Bearer ${params.authToken.trim()}` }
        : {}),
    },
    body: JSON.stringify(params.request),
  });

  if (!response.ok) {
    throw new Error(`Sync request failed with status ${response.status}.`);
  }

  return (await response.json()) as SyncPushResponse;
}

export async function pullSyncBatch(params: {
  endpoint: string;
  request: SyncPullRequest;
  authToken?: string;
}): Promise<SyncPullResponse> {
  const response = await fetch(`${normalizeEndpoint(params.endpoint)}/v1/sync/pull`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(params.authToken?.trim()
        ? { Authorization: `Bearer ${params.authToken.trim()}` }
        : {}),
    },
    body: JSON.stringify(params.request),
  });

  if (!response.ok) {
    throw new Error(`Sync pull request failed with status ${response.status}.`);
  }

  return (await response.json()) as SyncPullResponse;
}
