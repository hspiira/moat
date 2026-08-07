import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { ShoppingWorkspace } from "@/components/shopping-workspace";

export default function ShoppingPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <ShoppingWorkspace />
      </Suspense>
    </AppShell>
  );
}
