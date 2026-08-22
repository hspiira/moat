export function formatLockoutMessage(lockoutMs: number): string {
  const seconds = Math.ceil(lockoutMs / 1000);
  if (seconds < 60) {
    return `Too many attempts. Try again in ${seconds}s.`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}
