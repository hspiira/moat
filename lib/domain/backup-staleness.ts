export const BACKUP_STALE_AFTER_DAYS = 14;

export type BackupStaleness =
  | { state: "never"; days: null }
  | { state: "fresh"; days: number }
  | { state: "stale"; days: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function localMidnightMs(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function readBackupStaleness(
  lastBackupAt: string | undefined,
  now: Date = new Date(),
): BackupStaleness {
  if (!lastBackupAt) {
    return { state: "never", days: null };
  }

  const backedUpAt = new Date(lastBackupAt);
  if (Number.isNaN(backedUpAt.getTime())) {
    return { state: "never", days: null };
  }

  const elapsed = localMidnightMs(now) - localMidnightMs(backedUpAt);
  const days = Math.max(0, Math.round(elapsed / DAY_MS));

  return days >= BACKUP_STALE_AFTER_DAYS
    ? { state: "stale", days }
    : { state: "fresh", days };
}
