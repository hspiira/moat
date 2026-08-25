"use client";

import { useEffect, useState } from "react";

import { isIosApp } from "@/lib/native/platform";
import { hasNativeStorageBridge } from "@/lib/native/storage-bridge";

export function useHasNativeBridge(): boolean {
  const [hasBridge, setHasBridge] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasBridge(hasNativeStorageBridge());
  }, []);
  return hasBridge;
}

export function useIsIosApp(): boolean {
  const [isIos, setIsIos] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIos(isIosApp());
  }, []);
  return isIos;
}
