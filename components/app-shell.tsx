import type { ReactNode } from "react";

import { AppNavigation } from "@/components/app-navigation";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:min-h-screen lg:flex-row lg:items-start lg:gap-8 lg:px-8 lg:py-6">
        <AppNavigation />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
