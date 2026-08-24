"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { isNativeApp, isOurCallbackUrl } from "@/lib/sync/native-sign-in";
import { stashNativeSignInQuery } from "@/components/sync/sign-in-callback-workspace";

// Google returns to the app on a custom scheme, which arrives as a deep link
// rather than a page load, so nothing would notice it without this.
export function NativeSignInListener() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
    if (!clientId) return;

    let cancelled = false;
    let remove: (() => void) | undefined;

    void (async () => {
      const [{ App }, { Browser }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/browser"),
      ]);
      if (cancelled) return;

      const handle = await App.addListener("appUrlOpen", (event) => {
        if (!isOurCallbackUrl(event.url, clientId)) return;
        stashNativeSignInQuery(event.url);
        // The system browser stays over the app until it is told to close.
        void Browser.close().catch(() => undefined);
        router.push("/auth/callback");
      });

      remove = () => void handle.remove();
      if (cancelled) remove();
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [router]);

  return null;
}
