import type { ReactNode } from "react";

import { AppNavigation } from "@/components/app-navigation";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <AppNavigation />
        {children}
      </div>
    </div>
  );
}
