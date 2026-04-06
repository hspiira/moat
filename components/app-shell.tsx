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
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
