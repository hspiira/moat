const CACHE_NAME = "moat-v3";
const OFFLINE_URL = "/offline";
const APP_SHELL_URLS = [
  OFFLINE_URL,
  "/",
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

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

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
          const cache = await caches.open(CACHE_NAME);
          const cachedPage = await cache.match(request);
          return cachedPage ?? cache.match(OFFLINE_URL);
        }),
    );
    return;
  }

  const url = new URL(request.url);
  const isStaticAsset =
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/"));

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request).then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        });
      }),
    );
  }
});
