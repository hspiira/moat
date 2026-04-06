import type { StoreName } from "@/lib/repositories/indexeddb/client";

// Wraps the host storage bridge so the app can issue typed storage commands and handle native responses consistently.

export type NativeStorageRecord = Record<string, unknown>;

export type NativeStorageCommand =
  | {
      action: "getById";
      store: StoreName;
      id: string;
    }
  | {
      action: "listAll";
      store: StoreName;
    }
  | {
      action: "listByUser";
      store: StoreName;
      userId: string;
    }
  | {
      action: "listByField";
      store: StoreName;
      field: string;
      value: string | number | boolean;
    }
  | {
      action: "listByFieldPrefix";
      store: StoreName;
      field: string;
      prefix: string;
      userId?: string;
    }
  | {
      action: "listByFields";
      store: StoreName;
      filters: Array<{
        field: string;
        value: string | number | boolean;
      }>;
    }
  | {
      action: "listByFieldIn";
      store: StoreName;
      field: string;
      values: Array<string | number | boolean>;
      userId?: string;
    }
  | {
      action: "upsert";
      store: StoreName;
      record: NativeStorageRecord;
    }
  | {
      action: "remove";
      store: StoreName;
      id: string;
    }
  | {
      action: "replaceAll";
      store: StoreName;
      records: NativeStorageRecord[];
    }
  | {
      action: "clearAll";
    };

export type NativeStorageResponse =
  | {
      ok: true;
      result: unknown;
    }
  | {
      ok: false;
      error: string;
    };

export interface NativeStorageBridge {
  updateCaptureSettings?: (settingsJson: string) => void;
  getPendingCaptureRouteHint?: () => string | null;
  clearPendingCaptureRouteHint?: () => void;
  isStorageAvailable?: () => boolean;
  executeStorageCommand?: (commandJson: string) => string;
  clearStorage?: () => boolean;
}

declare global {
  interface Window {
    moatHostBridge?: {
      updateCaptureSettings?: (settingsJson: string) => void;
      getPendingCaptureRouteHint?: () => string | null;
      clearPendingCaptureRouteHint?: () => void;
      isStorageAvailable?: () => boolean;
      executeStorageCommand?: (commandJson: string) => string;
      clearStorage?: () => boolean;
    };
  }
}

export function getNativeStorageBridge(): NativeStorageBridge | null {
  if (typeof window === "undefined") {
    return null;
  }

  const bridge = window.moatHostBridge;
  if (!bridge?.executeStorageCommand) {
    return null;
  }

  return bridge;
}

export function hasNativeStorageBridge(): boolean {
  const bridge = getNativeStorageBridge();
  if (!bridge?.executeStorageCommand) {
    return false;
  }

  return bridge.isStorageAvailable?.() ?? true;
}

export function executeNativeStorageCommand<T>(
  command: NativeStorageCommand,
  bridge: NativeStorageBridge = getNativeStorageBridge() ?? {},
): T {
  const execute = bridge.executeStorageCommand;
  if (!execute) {
    throw new Error("Native storage bridge is not available.");
  }

  const rawResponse = execute(JSON.stringify(command));
  let response: NativeStorageResponse;

  try {
    response = JSON.parse(rawResponse) as NativeStorageResponse;
  } catch {
    throw new Error("Native storage bridge returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(response.error || "Native storage command failed.");
  }

  return response.result as T;
}

export function clearNativeStorage(
  bridge: NativeStorageBridge = getNativeStorageBridge() ?? {},
): void {
  if (bridge.clearStorage) {
    const cleared = bridge.clearStorage();
    if (!cleared) {
      throw new Error("Native storage reset failed.");
    }
    return;
  }

  executeNativeStorageCommand<null>({ action: "clearAll" }, bridge);
}
