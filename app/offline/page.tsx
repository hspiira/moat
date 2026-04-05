import Link from "next/link";

import { AppPage, AppHeroCard } from "@/components/app-page";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <AppPage>
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
