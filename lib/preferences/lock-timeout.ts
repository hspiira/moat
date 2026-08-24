"use client";

const LOCK_TIMEOUT_KEY = "moat.lock-timeout-minutes";

/** How long the app may sit idle before locking. Immediately means on leaving. */
export const LOCK_TIMEOUT_CHOICES = [0, 1, 5, 15, 60] as const;

export type LockTimeoutMinutes = (typeof LOCK_TIMEOUT_CHOICES)[number];

export const DEFAULT_LOCK_TIMEOUT: LockTimeoutMinutes = 5;

export function isLockTimeout(value: unknown): value is LockTimeoutMinutes {
  return LOCK_TIMEOUT_CHOICES.includes(value as LockTimeoutMinutes);
}

/** Words for a choice, for a label rather than a number of minutes. */
export function describeLockTimeout(minutes: LockTimeoutMinutes): string {
  if (minutes === 0) return "Immediately";
  if (minutes === 60) return "After 1 hour";
  return `After ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function readLockTimeout(): LockTimeoutMinutes {
  if (typeof window === "undefined") return DEFAULT_LOCK_TIMEOUT;

  try {
    const raw = window.localStorage.getItem(LOCK_TIMEOUT_KEY);
    if (raw === null) return DEFAULT_LOCK_TIMEOUT;
    const parsed = Number(raw);
    return isLockTimeout(parsed) ? parsed : DEFAULT_LOCK_TIMEOUT;
  } catch {
    return DEFAULT_LOCK_TIMEOUT;
  }
}

export function writeLockTimeout(minutes: LockTimeoutMinutes): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCK_TIMEOUT_KEY, String(minutes));
  } catch {
    // A full or blocked store leaves the default in place, which still locks.
  }
}

/** Milliseconds for the timer. Zero still needs a tick, not an instant loop. */
export function lockTimeoutMs(minutes: LockTimeoutMinutes): number {
  return minutes === 0 ? 1_000 : minutes * 60 * 1000;
}
