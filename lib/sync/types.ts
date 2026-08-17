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
    // The serverVersionToken this edit was based on. Lets the server tell a
    // newer version apart from a divergent one. Clients do not send it yet.
    baseVersionToken?: string;
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
  // Cursor from the previous page's nextSince. A bare timestamp also works.
  since?: string;
  // Clamped server-side. See lib/sync/cursor.ts.
  limit?: number;
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
  // Pass as the next request's since. Unchanged when the page was empty.
  nextSince?: string;
  hasMore?: boolean;
};

export type SyncRunSummary = {
  attempted: number;
  synced: number;
  failed: number;
  conflicts: number;
  pulled?: number;
  syncedAt?: string;
  error?: string;
};
