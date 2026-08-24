import { sealSyncPayload } from "@/lib/sync/payload-crypto";
import type { SyncOutboxItem } from "@/lib/types";

import type {
  SyncPullRequest,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
} from "@/lib/sync/types";

// A stalled connection never settles on its own, which leaves the caller
// waiting for good. Sync is a background errand, so it gives up rather than
// hangs.
const REQUEST_TIMEOUT_MS = 20_000;

function requestSignal(): AbortSignal | undefined {
  return typeof AbortSignal?.timeout === "function"
    ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    : undefined;
}

export function normalizeEndpoint(endpoint: string) {
  return endpoint.replace(/\/+$/, "");
}

// A refusal to serve for now is not the same as a request the server could not
// understand. Saying so plainly keeps the owner from thinking their records
// failed to save.
function syncRequestError(response: Response, what: string): Error {
  if (response.status === 429) {
    const seconds = Number(response.headers.get("retry-after"));
    const when = Number.isFinite(seconds) && seconds > 0 ? ` Try again in ${seconds}s.` : "";
    return new Error(`Sync is being asked for too often.${when}`);
  }
  return new Error(`${what} failed with status ${response.status}.`);
}

export async function createSyncPushRequest(params: {
  userId: string;
  items: SyncOutboxItem[];
  platform?: "web" | "android" | "ios";
  deviceId?: string;
  // The token last seen for each record, so the server can tell an edit made
  // against its current version from one made against a stale one.
  baseVersionTokens?: Map<string, string>;
}): Promise<SyncPushRequest> {
  const items = await Promise.all(
    params.items.map(async (item) => ({
      outboxId: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      operation: item.operation,
      payload: await sealSyncPayload(item.payload),
      queuedAt: item.queuedAt,
      baseVersionToken: params.baseVersionTokens?.get(`${item.entityType}:${item.entityId}`),
    })),
  );

  return {
    userId: params.userId,
    device: {
      app: "moat",
      platform: params.platform ?? "web",
      id: params.deviceId,
    },
    items,
  };
}

export async function pushSyncBatch(params: {
  endpoint: string;
  request: SyncPushRequest;
  authToken?: string;
}): Promise<SyncPushResponse> {
  const response = await fetch(`${normalizeEndpoint(params.endpoint)}/v1/sync/push`, {
    signal: requestSignal(),
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
    throw syncRequestError(response, "Sync request");
  }

  return (await response.json()) as SyncPushResponse;
}

export async function pullSyncBatch(params: {
  endpoint: string;
  request: SyncPullRequest;
  authToken?: string;
}): Promise<SyncPullResponse> {
  const response = await fetch(`${normalizeEndpoint(params.endpoint)}/v1/sync/pull`, {
    signal: requestSignal(),
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
    throw syncRequestError(response, "Sync pull request");
  }

  return (await response.json()) as SyncPullResponse;
}
