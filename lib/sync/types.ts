import type { SyncOutboxItem } from "@/lib/types";

export type SyncPushRequest = {
  userId: string;
  device: {
    app: "moat";
    platform: "web" | "android" | "ios";
  };
  items: Array<{
    outboxId: string;
    entityType: string;
    entityId: string;
    operation: SyncOutboxItem["operation"];
    payload: string;
    queuedAt: string;
  }>;
};

export type SyncPushResult = {
  outboxId: string;
  status: "synced" | "failed";
  error?: string;
};

export type SyncPushResponse = {
  syncedAt: string;
  results: SyncPushResult[];
};

export type SyncRunSummary = {
  attempted: number;
  synced: number;
  failed: number;
  syncedAt?: string;
  error?: string;
};
