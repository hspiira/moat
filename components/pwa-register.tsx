"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js");
      return;
    }

    // In development, a service worker left over from a previous production
    // run on this origin will keep serving stale hashed chunks and break
    // hot reloads. Unregister it and drop its caches so dev self-heals.
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
  }, []);

  return null;
}
