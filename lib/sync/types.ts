import type { SyncOutboxItem } from "@/lib/types";

export type SyncPushRequest = {
  userId: string;
  device: {
    app: "moat";
    platform: "web" | "android" | "ios";
    id?: string;
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
  status: "synced" | "failed" | "conflict";
  error?: string;
  strategy?: "client_wins" | "server_wins" | "manual_review";
  serverVersionToken?: string;
  serverRecord?: {
    entityType: string;
    entityId: string;
    payload: string | null;
    deleted: boolean;
    updatedAt: string;
    serverVersionToken: string;
  };
};

export type SyncPushResponse = {
  syncedAt: string;
  results: SyncPushResult[];
};

export type SyncPullRequest = {
  userId: string;
  since?: string;
};

export type SyncPullRecord = {
  entityType: string;
  entityId: string;
  payload: string | null;
  deleted: boolean;
  updatedAt: string;
  serverVersionToken: string;
};

export type SyncPullResponse = {
  syncedAt: string;
  records: SyncPullRecord[];
};

export type SyncRunSummary = {
  attempted: number;
  synced: number;
  failed: number;
  conflicts: number;
  syncedAt?: string;
  error?: string;
};
