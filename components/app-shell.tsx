import type { ReactNode } from "react";

import { AppNavigation } from "@/components/app-navigation";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#faf7f2_0%,#f2ebdf_46%,#ebe2d3_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppNavigation />
        {children}
      </div>
    </main>
  );
}
