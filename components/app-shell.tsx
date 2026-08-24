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
      {/* Content scrolls under the status bar, so the strip it occupies is
          painted over. Navigation returns nothing while it works out whether a
          profile exists, so this cannot live there. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[env(safe-area-inset-top,0px)] bg-background"
      />
      <div
        className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4 pb-4 pt-[max(0.5rem,env(safe-area-inset-top,0px))] sm:px-6 lg:gap-5 lg:px-8 lg:pb-6 lg:pt-[max(0.75rem,env(safe-area-inset-top,0px))]"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
        }}
      >
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
