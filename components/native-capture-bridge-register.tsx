"use client";

import { useEffect } from "react";

import { registerNativeCaptureGlobal } from "@/lib/native/capture-bridge";

export function NativeCaptureBridgeRegister() {
  useEffect(() => {
    registerNativeCaptureGlobal();
  }, []);

  return null;
}
