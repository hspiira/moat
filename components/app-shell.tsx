import type { ReactNode } from "react";

import { AppNavigation } from "@/components/app-navigation";
import { NativeCaptureIntake } from "@/components/native-capture-intake";
import { PwaStatus } from "@/components/pwa-status";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  // Clears the floating capsule: 3.5rem of capsule plus a rem of breathing
  // room, above whichever is larger of the home-indicator inset or 0.625rem.
  // overflow-x-clip, not hidden: clip does not create a scroll container, so
  // the sticky top bar and the fixed capsule keep working.
  return (
    <div className="min-h-screen overflow-x-clip bg-background pb-[calc(4.5rem+max(0.625rem,env(safe-area-inset-bottom)))] lg:pb-0">
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <AppNavigation />
        <PwaStatus />
        <NativeCaptureIntake />
        {/* Clip stray horizontal overflow from page content so it can never
            widen the page and drag the sticky nav sideways. Vertical stays
            visible; nested scroll containers (e.g. wide tables) still scroll. */}
        <main className="min-w-0 overflow-x-clip">{children}</main>
      </div>
    </div>
  );
}
