import type { ReactNode } from "react";

import { AppNavigation } from "@/components/app-navigation";
import { NativeCaptureIntake } from "@/components/native-capture-intake";
import { PwaStatus } from "@/components/pwa-status";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
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
