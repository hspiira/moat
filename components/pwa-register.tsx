"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function PwaRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
      if ("caches" in window) {
        void caches.keys().then((keys) => {
          for (const key of keys) {
            if (key.startsWith("moat-")) {
              void caches.delete(key);
            }
          }
        });
      }
      return;
    }

    const teardown = new AbortController();

    void navigator.serviceWorker.register("/sw.js").then((registration) => {
      if (teardown.signal.aborted) return;

      function watch(worker: ServiceWorker | null) {
        if (!worker) return;
        worker.addEventListener(
          "statechange",
          () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          },
          { signal: teardown.signal },
        );
      }

      if (registration.waiting && navigator.serviceWorker.controller) {
        setUpdateReady(true);
      }
      watch(registration.installing);
      registration.addEventListener("updatefound", () => watch(registration.installing), {
        signal: teardown.signal,
      });
    });

    return () => {
      teardown.abort();
    };
  }, []);

  if (!updateReady) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-100 flex justify-center px-4 pt-3"
      style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-card/90 py-2 pr-2 pl-4 shadow-lg shadow-black/25 backdrop-blur-xl">
        <span className="text-sm text-foreground">A new version is ready.</span>
        <Button size="sm" className="rounded-full" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}
