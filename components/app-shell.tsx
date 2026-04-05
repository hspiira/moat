import type { ReactNode } from "react";

import { AppNavigation } from "@/components/app-navigation";

type AppShellProps = {
  children: ReactNode;
};

/**
 * Layout component that renders the application navigation and page content within a centered container.
 *
 * @param children - Page content rendered below the top navigation
 * @returns The app shell element containing the navigation bar and the provided children
 */
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
