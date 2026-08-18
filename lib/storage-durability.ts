/**
 * Whether the browser has promised to keep the ledger.
 *
 * IndexedDB in a "best-effort" origin is evictable: Chromium and Firefox may
 * clear it under storage pressure, and Safari expires unused origins. For an
 * app whose records exist nowhere else, that is silent total data loss.
 * `navigator.storage.persist()` moves the origin to "persistent", which
 * exempts it from that eviction.
 */

export type StorageDurability = {
  /** Unsupported browsers report "unknown" rather than a false negative. */
  state: "persisted" | "best-effort" | "unknown";
  /** Fraction of the quota in use, when the browser reports both numbers. */
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

/** Above this, an eviction is close enough to warn about. */
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

/**
 * Asks once for persistent storage and reports where things stand.
 *
 * Chromium grants this without a prompt for an installed app or a site with
 * engagement, and declines silently otherwise; Firefox may prompt. A refusal
 * is not an error, it just means the data stays evictable and a backup matters
 * more, so this never throws.
 */
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

/** Reads the current state without asking for anything. */
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

/** True when the ledger could be cleared by the browser without warning. */
export function isEvictable(durability: StorageDurability): boolean {
  return durability.state === "best-effort";
}
