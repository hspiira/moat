// Self-healing for stale-client failures. When a deploy leaves a browser
// holding outdated cached chunks or a stale service worker, the app can fail
// to boot a page ("ChunkLoadError", "module factory is not available", etc.).
// Users should never have to hard-reload or clear caches to fix this — the app
// detects these failures, drops its own caches, unregisters the worker, and
// reloads once. A short cool-down prevents reload loops.

const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|module factory is not available|importScripts/i;

const HEAL_MARK_KEY = "moat:self-heal-at";
const HEAL_COOLDOWN_MS = 20_000;

export function isChunkLoadError(input: unknown): boolean {
  if (!input) return false;
  if (typeof input === "string") return CHUNK_ERROR_PATTERN.test(input);
  const candidate = input as { message?: unknown; name?: unknown };
  const message = `${String(candidate.name ?? "")} ${String(candidate.message ?? "")}`;
  return CHUNK_ERROR_PATTERN.test(message);
}

/**
 * Best-effort recovery: clear Moat's caches and service worker, then reload.
 * Guarded so a page that keeps failing after a heal shows the friendly error
 * screen instead of reloading forever. Never throws.
 */
export async function purgeStaleClientAndReload(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const lastHealedAt = Number(sessionStorage.getItem(HEAL_MARK_KEY) ?? 0);
    if (Number.isFinite(lastHealedAt) && Date.now() - lastHealedAt < HEAL_COOLDOWN_MS) {
      return; // Healed very recently — avoid a reload loop.
    }
    sessionStorage.setItem(HEAL_MARK_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable (private mode edge cases) — proceed anyway.
  }

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith("moat-")).map((key) => caches.delete(key)),
      );
    }
  } catch {
    // Recovery is best-effort; reload regardless so fresh assets are fetched.
  }

  window.location.reload();
}
