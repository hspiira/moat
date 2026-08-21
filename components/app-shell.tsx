import type { ReactNode } from "react";

import { AppNavigation } from "@/components/app-navigation";
import { NativeCaptureIntake } from "@/components/native-capture-intake";
import { NavBottomSpacer } from "@/components/navigation/nav-bottom-spacer";
import { PwaStatus } from "@/components/pwa-status";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-dvh overflow-x-clip bg-background">
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4 px-4 pt-2 pb-4 sm:px-6 lg:gap-5 lg:px-8 lg:pt-3 lg:pb-6">
        <AppNavigation />
        <aside aria-label="App and storage status" className="empty:hidden">
          <PwaStatus />
        </aside>
        <NativeCaptureIntake />
        <main className="min-w-0 overflow-x-clip">{children}</main>
        <NavBottomSpacer />
      </div>
    </div>
  );
}
