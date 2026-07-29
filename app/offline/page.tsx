import Link from "next/link";

import { AppPage, AppHeroCard } from "@/components/app-page";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    // This route renders outside AppShell, so it has no page gutter of its own.
    // AppHeroCard drops its padding under sm (the shell normally supplies it),
    // which would otherwise leave this content flush against the screen edge.
    <AppPage className="px-4 py-6 sm:px-0 sm:py-0">
      <AppHeroCard
        badge="Offline"
        title="You are offline"
        description="Moat can still load its local shell and saved data, but anything that needs a fresh network response will wait until you reconnect."
        actions={
          <>
            <Button asChild>
              <Link href="/">Back to dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/transactions">Open transactions</Link>
            </Button>
          </>
        }
      />
    </AppPage>
  );
}
