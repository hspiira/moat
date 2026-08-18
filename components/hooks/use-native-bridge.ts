"use client";

import { useEffect, useState } from "react";

import { hasNativeStorageBridge } from "@/lib/native/storage-bridge";

export function useHasNativeBridge(): boolean {
  const [hasBridge, setHasBridge] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasBridge(hasNativeStorageBridge());
  }, []);
  return hasBridge;
}
