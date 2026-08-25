"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ingestNativeCapturePayload } from "@/lib/capture/persistence";
import {
  clearPendingNativeCaptureRouteHint,
  getPendingNativeCaptureRouteHint,
  subscribeToNativeCapture,
  type NativeCapturePayload,
} from "@/lib/native/capture-bridge";
import { chooseCaptureAccount } from "@/lib/capture/account-match";
import { loadCaptureAutomationSettings } from "@/lib/native/capture-settings";
import {
  accountIdForSender,
  readCaptureShortcutPreferences,
} from "@/lib/preferences/capture-shortcut";
import { repositories } from "@/lib/repositories/instance";

export function NativeCaptureIntake() {
  const router = useRouter();
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void repositories.userProfile
      .get()
      .then((profile) => {
        if (!cancelled) {
          setUserId(profile?.id ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUserId(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    return subscribeToNativeCapture((payload: NativeCapturePayload) => {
      void (async () => {
        if (payload.channel === "notification") {
          const settings = loadCaptureAutomationSettings();
          const packageAllowed =
            payload.sourceApp && settings.allowedNotificationPackages.includes(payload.sourceApp);
          if (!settings.notificationCaptureEnabled || !packageAllowed) {
            return;
          }
        }

        const accounts = await repositories.accounts.listByUser(userId);

        // The sender says which account the money moved on, so a message from
        // one provider no longer lands on whichever account came back first.
        const chosen = chooseCaptureAccount({
          accounts,
          sender: payload.sourceTitle,
          text: payload.rawContent,
          mappedAccountId: accountIdForSender(
            readCaptureShortcutPreferences(),
            payload.sourceTitle,
          ),
        });
        if (!chosen) {
          return;
        }

        await ingestNativeCapturePayload({
          repositories,
          userId,
          accountId: chosen.accountId,
          payload,
        });

        const routeHint = getPendingNativeCaptureRouteHint();
        if (routeHint) {
          clearPendingNativeCaptureRouteHint();
          router.replace(routeHint);
        }
      })();
    });
  }, [router, userId]);

  return null;
}
