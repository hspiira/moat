"use client";

import { useEffect } from "react";

import { isChunkLoadError, purgeStaleClientAndReload } from "@/lib/pwa/self-heal";

export function AppSelfHeal() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        void purgeStaleClientAndReload();
      }
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        void purgeStaleClientAndReload();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
