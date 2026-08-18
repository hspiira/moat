export type StorageDurability = {
  state: "persisted" | "best-effort" | "unknown";
  usedFraction: number | null;
  usedBytes: number | null;
  quotaBytes: number | null;
};

const UNSUPPORTED: StorageDurability = {
  state: "unknown",
  usedFraction: null,
  usedBytes: null,
  quotaBytes: null,
};

export const QUOTA_WARNING_FRACTION = 0.8;

function storageManager(): StorageManager | null {
  if (typeof navigator === "undefined" || !navigator.storage) {
    return null;
  }
  return navigator.storage;
}

async function readUsage(storage: StorageManager) {
  if (typeof storage.estimate !== "function") {
    return { usedBytes: null, quotaBytes: null, usedFraction: null };
  }

  try {
    const { usage, quota } = await storage.estimate();
    const usedBytes = typeof usage === "number" ? usage : null;
    const quotaBytes = typeof quota === "number" ? quota : null;
    return {
      usedBytes,
      quotaBytes,
      usedFraction: usedBytes !== null && quotaBytes ? usedBytes / quotaBytes : null,
    };
  } catch {
    return { usedBytes: null, quotaBytes: null, usedFraction: null };
  }
}

export async function ensurePersistentStorage(): Promise<StorageDurability> {
  const storage = storageManager();
  if (!storage || typeof storage.persisted !== "function") {
    return UNSUPPORTED;
  }

  try {
    let persisted = await storage.persisted();
    if (!persisted && typeof storage.persist === "function") {
      persisted = await storage.persist();
    }

    return {
      state: persisted ? "persisted" : "best-effort",
      ...(await readUsage(storage)),
    };
  } catch {
    return UNSUPPORTED;
  }
}

export async function readStorageDurability(): Promise<StorageDurability> {
  const storage = storageManager();
  if (!storage || typeof storage.persisted !== "function") {
    return UNSUPPORTED;
  }

  try {
    const persisted = await storage.persisted();
    return {
      state: persisted ? "persisted" : "best-effort",
      ...(await readUsage(storage)),
    };
  } catch {
    return UNSUPPORTED;
  }
}

export function isRunningLowOnSpace(durability: StorageDurability): boolean {
  return durability.usedFraction !== null && durability.usedFraction >= QUOTA_WARNING_FRACTION;
}

export function isEvictable(durability: StorageDurability): boolean {
  return durability.state === "best-effort";
}
