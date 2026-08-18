const KEY = "moat.storage-notice-dismissed";

export type StorageNoticeKind = "evictable" | "low-space" | "no-backup";

export function isStorageNoticeDismissed(kind: StorageNoticeKind): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`${KEY}.${kind}`) === "1";
  } catch {
    return false;
  }
}

export function dismissStorageNotice(kind: StorageNoticeKind): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${KEY}.${kind}`, "1");
  } catch {
    // A browser that refuses localStorage just shows the notice again.
  }
}
