// Bumped whenever APP_SHELL_URLS changes: the install step only precaches into
// a cache it has not seen, so an installed app would otherwise keep serving the
// old shell and never fetch a newly added route. The activate handler below
// drops superseded caches, so this upgrades in place with no user action.
const CACHE_NAME = "moat-v6";
const OFFLINE_URL = "/offline";

// Every statically-rendered route is precached at install, not just on first
// visit. Offline support is advertised on the landing page, and a route that
// has never been opened while online previously fell through to /offline —
// which reads as "the app is broken" rather than "you're offline".
// Dynamic routes (/accounts/[accountId]) cannot be precached and still rely on
// the runtime cache below.
const APP_SHELL_URLS = [
  OFFLINE_URL,
  "/",
  "/accounts",
  "/budgets",
  "/debt",
  "/goals",
  "/investment-compass",
  "/learn",
  "/onboarding",
  "/privacy",
  "/recurring",
  "/settings",
  "/settings/sync-conflicts",
  "/transactions",
  "/transactions/capture",
  "/transactions/import",
  "/transactions/review",
  "/transactions/review/capture",
  "/transactions/review/month-close",
  "/transactions/tools",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/logo.svg",
  "/icons/logo.png",
  "/icons/maskable-icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Add entries individually so one missing asset cannot abort the
      // whole install and leave the app without any offline support.
      Promise.allSettled(APP_SHELL_URLS.map((url) => cache.add(url))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Network-first, then this exact URL from cache, then the URL without its
 *  query string. Capture deep links carry params (?capture=expense) that make
 *  the cache key miss an otherwise-identical cached route. */
async function cacheFallback(request) {
  const cache = await caches.open(CACHE_NAME);

  const exact = await cache.match(request);
  if (exact) {
    return exact;
  }

  const url = new URL(request.url);
  if (url.search) {
    const withoutQuery = await cache.match(url.origin + url.pathname);
    if (withoutQuery) {
      return withoutQuery;
    }
  }

  return null;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    // Network-first, falling back to the cached copy of the same route so
    // previously visited pages keep working offline, then to /offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await cacheFallback(request);
          if (cachedPage) {
            return cachedPage;
          }
          const cache = await caches.open(CACHE_NAME);
          return cache.match(OFFLINE_URL);
        }),
    );
    return;
  }

  // React Server Component payloads. Client-side navigation (next/link) never
  // issues a `navigate` request — it fetches the route's RSC payload instead,
  // so without this branch tapping a nav link offline bypasses the cache
  // entirely and fails, even when the route's HTML is precached.
  const isRscRequest =
    isSameOrigin &&
    (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1");

  if (isRscRequest) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await cacheFallback(request);
          // No cached payload: fail rather than return the offline HTML, which
          // is not a valid RSC payload and would break the router. The client
          // treats the rejection as a failed navigation.
          return cached ?? Response.error();
        }),
    );
    return;
  }

  const isStaticAsset =
    isSameOrigin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/"));

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request)
          .then((response) => {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            return response;
          })
          // Offline and never cached: return a network error instead of leaving
          // the promise to reject unhandled. A missing chunk surfaces as a
          // ChunkLoadError, which lib/pwa/self-heal.ts already recovers from.
          .catch(() => Response.error());
      }),
    );
  }
});
