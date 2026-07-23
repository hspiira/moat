"use client";

import { useEffect, useState } from "react";

import { hasNativeStorageBridge } from "@/lib/native/storage-bridge";

/**
 * True only when running inside the native (Android) host shell. Resolves after
 * mount so server and first client render agree (the bridge is a client-only,
 * window-injected global). Web always gets false.
 */
export function useHasNativeBridge(): boolean {
  const [hasBridge, setHasBridge] = useState(false);
  useEffect(() => {
    // Hydration-safe: resolve the client-only, window-injected bridge after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasBridge(hasNativeStorageBridge());
  }, []);
  return hasBridge;
}
