import { isNativeApp } from "@/lib/sync/native-sign-in";

/**
 * Whether the device is known to be offline. In the app the page is served from
 * a capacitor: scheme rather than the network, and navigator.onLine reports
 * false there whatever the connection is doing, so it is not consulted and the
 * request itself is left to decide.
 */
export function isKnownOffline(
  native: boolean = isNativeApp(),
  online: boolean | undefined = typeof window === "undefined" ? undefined : window.navigator.onLine,
): boolean {
  if (native) return false;
  return online === false;
}
