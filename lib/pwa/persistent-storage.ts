/**
 * Asking the browser not to evict our data.
 *
 * Moat keeps every record on the device. iOS clears web app storage when the
 * device runs low on disk space, which for a local-first app means silent data
 * loss rather than a slow app. A granted persistence request moves the data out
 * of the "best effort" bucket, so the browser stops treating it as disposable.
 *
 * This is a request, not a guarantee. Safari decides, and it usually grants it
 * only for a home-screen app the person actually uses. So it lowers the risk;
 * it does not remove the need for a backup.
 */

export type PersistentStorageResult = "persisted" | "denied" | "unsupported";

export async function requestPersistentStorage(): Promise<PersistentStorageResult> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return "unsupported";
  }

  try {
    // Already granted: asking again is a no-op, but persisted() avoids the
    // prompt some browsers show on a repeat persist() call.
    if (navigator.storage.persisted && (await navigator.storage.persisted())) {
      return "persisted";
    }

    return (await navigator.storage.persist()) ? "persisted" : "denied";
  } catch {
    // A browser that throws here is telling us the same thing as a refusal.
    return "denied";
  }
}

export async function isStoragePersisted(): Promise<PersistentStorageResult> {
  if (typeof navigator === "undefined" || !navigator.storage?.persisted) {
    return "unsupported";
  }

  try {
    return (await navigator.storage.persisted()) ? "persisted" : "denied";
  } catch {
    return "denied";
  }
}
