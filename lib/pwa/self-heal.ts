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
 * Full-screen "we're updating" state shown while healing. Injected as plain
 * DOM (not React) because the React tree is usually the thing that broke, and
 * inline styles + CSS vars keep it working even mid-failure. Framed as an
 * update, never an error, so it reassures rather than alarms.
 */
function showHealingOverlay(): void {
  if (typeof document === "undefined" || document.getElementById("moat-healing")) return;

  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const overlay = document.createElement("div");
  overlay.id = "moat-healing";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483647",
    "display:flex",
    "flex-direction:column",
    "align-items:center",
    "justify-content:center",
    "gap:16px",
    "padding:24px",
    "text-align:center",
    "background:#f6f2e9",
    "background:var(--background,#f6f2e9)",
    "color:#1a1e1c",
    "color:var(--foreground,#1a1e1c)",
    "font-family:system-ui,-apple-system,sans-serif",
  ].join(";");

  overlay.innerHTML = `
    <div class="moat-heal-ring"></div>
    <div style="font-size:16px;font-weight:600;">Updating Moat</div>
    <div style="font-size:13px;opacity:0.65;max-width:20rem;">Getting the latest version. Your data is safe — this only takes a moment.</div>
    <style>
      #moat-healing .moat-heal-ring{width:36px;height:36px;border-radius:9999px;border:3px solid color-mix(in srgb, currentColor 18%, transparent);border-top-color:var(--primary,#0e4d45);}
      ${reduceMotion ? "" : "@keyframes moat-heal-spin{to{transform:rotate(360deg)}}#moat-healing .moat-heal-ring{animation:moat-heal-spin .8s linear infinite;}"}
    </style>
  `;

  document.body.appendChild(overlay);
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

  showHealingOverlay();

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
